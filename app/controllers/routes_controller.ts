/* eslint-disable @unicorn/no-await-expression-member */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { DateTime } from "luxon";

import type { HttpContext } from "@adonisjs/core/http";
import db from "@adonisjs/lucid/services/db";

import Report from "#models/report";
import Route from "#models/route";
import Schedule from "#models/schedule";
import Stop from "#models/stop";
import { findRouteValidator } from "#validators/find_route";

export default class RoutesController {
  /**
   * @index
   * @summary Routes - Get routes based on start and end locations
   * @description Find routes that connect two geographical points within a specified radius, including transfers, reports and live vehicle locations.
   * @paramQuery fromLatitude - Latitude of the starting point.
   * @paramQuery fromLongitude - Longitude of the starting point.
   * @paramQuery toLatitude - Latitude of the destination point.
   * @paramQuery toLongitude - Longitude of the destination point.
   * @paramQuery radius - (Optional) in meters, default is 1000.
   * @paramQuery transferRadius - (Optional) in meters, default is 200. Determines how far you are willing to walk to a transfer stop.
   * @paramQuery maxTransfers - (Optional) default is 2, maximum number of transfers allowed.
   * @responseBody 200 - [{"departure": {"name": "GOGOLIN","id": 44,"coordinates": {"longitude": 18.025,"latitude": 50.49},"time": "03:43:00","distance": 3888},"arrival": {"name": "OPOLE GŁÓWNE","id": 49,"coordinates": {"longitude": 17.925,"latitude": 50.662},"time": "04:50:00","distance": 0},"travel_time": 67,"transfers": 0,"routes": [{"id": 3,"name": "POLREGIO Kędzierzyn-Koźle  Opole Główne","operator": "POLREGIO","type": "train","run": 53,"current_location": {"coordinates": [18.115, 50.459],"timestamp": "20251004T23:15:58.748Z"},"departure": {"name": "GOGOLIN","id": 44,"coordinates": {"longitude": 18.025,"latitude": 50.49},"time": "04:30:00"},"arrival": {"name": "OPOLE GŁÓWNE","id": 49,"coordinates": {"longitude": 17.925,"latitude": 50.662},"time": "04:50:00"},"travel_time": 20,"destination": "OPOLE GŁÓWNE","reports": [{"id": 2,"run": 53,"type": "other","description": "Zgłoszenie od użytkownika.","created_at": "20251004T22:45:17.559+00:00","coordinates": {"longitude": 19.025,"latitude": 50.49}}]}]}]
   * @tag Routes
   */
  public async index({ request, response }: HttpContext) {
    const payload = await request.validateUsing(findRouteValidator);
    const radius = request.input("radius", 1000) as number;
    const maxTransfers = request.input("maxTransfers", 2) as number;
    const minTransferMinutes = 3;
    const maxTransferMinutes = 1200;
    const WALKING_SPEED_MPS = 1.4;
    const transferRadius = request.input("transferRadius", 200) as number;
    const startTime = DateTime.now()
      .setZone("Europe/Warsaw")
      .toFormat("HH:mm:ss");
    const todayStart =
      DateTime.now().setZone("Europe/Warsaw").startOf("day").toSQL() ?? "";

    const fromPoint = `ST_SetSRID(ST_MakePoint(${payload.fromLongitude}, ${payload.fromLatitude}), 4326)`;
    const toPoint = `ST_SetSRID(ST_MakePoint(${payload.toLongitude}, ${payload.toLatitude}), 4326)`;

    const startStopIds = (
      await Stop.query()
        .whereRaw(
          `ST_DWithin(location::geography, ${fromPoint}::geography, ?)`,
          [radius],
        )
        .select("id")
    ).map((s) => s.id);
    const endStopIds = (
      await Stop.query()
        .whereRaw(`ST_DWithin(location::geography, ${toPoint}::geography, ?)`, [
          radius,
        ])
        .select("id")
    ).map((s) => s.id);

    if (startStopIds.length === 0 || endStopIds.length === 0) {
      return response.ok([]);
    }

    const bindings = {
      startStopIds,
      endStopIds,
      startTime,
      maxTransfers,
      transferRadius,
    };

    const recursiveQuery = `
      WITH RECURSIVE route_search AS (
        -- KROK BAZOWY (PIERWSZY ETAP)
        SELECT
          ss.id AS departure_schedule_id, es.id AS arrival_schedule_id,
          start_rs.stop_id AS start_stop_id, end_rs.stop_id AS end_stop_id,
          es.time AS final_arrival_time, 0 AS transfers,
          end_stop.location AS last_arrival_location,
          ARRAY[start_rs.stop_id, end_rs.stop_id] AS path,
          ARRAY[
            jsonb_build_object(
              'route_id', r.id, 'route_name', r.name, 'operator', r.operator, 'route_type', r.type, 'run', ss.run, 'destination', ss.destination,
              'departure_schedule_id', ss.id, 'departure_sequence', ss.sequence, 'arrival_sequence', es.sequence,
              'departure_stop_id', start_rs.stop_id, 'departure_stop_name', start_stop.name, 'departure_time', ss.time, 'departure_coords', ST_AsGeoJSON(start_stop.location),
              'arrival_stop_id', end_rs.stop_id, 'arrival_stop_name', end_stop.name, 'arrival_time', es.time, 'arrival_coords', ST_AsGeoJSON(end_stop.location)
            )
          ] AS legs
        FROM schedules ss
        JOIN schedules es ON ss.run = es.run AND ss.destination = es.destination AND ss.sequence < es.sequence
        JOIN route_stops start_rs ON ss.route_stop_id = start_rs.id
        JOIN route_stops end_rs ON es.route_stop_id = end_rs.id AND start_rs.route_id = end_rs.route_id
        JOIN routes r ON start_rs.route_id = r.id
        JOIN stops start_stop ON start_rs.stop_id = start_stop.id
        JOIN stops end_stop ON end_rs.stop_id = end_stop.id
        WHERE start_rs.stop_id = ANY(:startStopIds::int[]) AND ss.time >= :startTime
        UNION ALL
        -- KROK REKURENCYJNY (PRZESIADKI)
        SELECT
          next_ss.id, next_es.id,
          rs.start_stop_id, next_end_rs.stop_id,
          next_es.time, rs.transfers + 1,
          next_end_stop.location,
          rs.path || next_end_rs.stop_id,
          rs.legs || jsonb_build_object(
            'route_id', next_r.id, 'route_name', next_r.name, 'operator', next_r.operator, 'route_type', next_r.type, 'run', next_ss.run, 'destination', next_ss.destination,
            'departure_schedule_id', next_ss.id, 'departure_sequence', next_ss.sequence, 'arrival_sequence', next_es.sequence,
            'departure_stop_id', transfer_stop.id, 'departure_stop_name', transfer_stop.name, 'departure_time', next_ss.time, 'departure_coords', ST_AsGeoJSON(transfer_stop.location),
            'arrival_stop_id', next_end_rs.stop_id, 'arrival_stop_name', next_end_stop.name, 'arrival_time', next_es.time, 'arrival_coords', ST_AsGeoJSON(next_end_stop.location)
          )
        FROM route_search rs
        JOIN stops transfer_stop ON ST_DWithin(rs.last_arrival_location::geography, transfer_stop.location::geography, :transferRadius)
        JOIN route_stops next_start_rs ON next_start_rs.stop_id = transfer_stop.id
        JOIN schedules next_ss ON next_ss.route_stop_id = next_start_rs.id
        JOIN schedules next_es ON next_ss.run = next_es.run AND next_ss.destination = next_es.destination AND next_ss.sequence < next_es.sequence
        JOIN route_stops next_end_rs ON next_es.route_stop_id = next_end_rs.id AND next_start_rs.route_id = next_end_rs.route_id
        JOIN routes next_r ON next_start_rs.route_id = next_r.id
        JOIN stops next_end_stop ON next_end_rs.stop_id = next_end_stop.id
        WHERE
          rs.transfers < :maxTransfers
          AND next_ss.time BETWEEN rs.final_arrival_time + INTERVAL '${minTransferMinutes} minutes' AND rs.final_arrival_time + INTERVAL '${maxTransferMinutes} minutes'
          AND NOT (next_end_rs.stop_id = ANY(rs.path))
      )
      -- FINALNE ZAPYTANIE
      SELECT
        rs.*,
        ROUND(ST_Distance(overall_start_stop.location::geography, ${fromPoint}::geography)) as distance_from_start,
        ROUND(ST_Distance(overall_end_stop.location::geography, ${toPoint}::geography)) as distance_to_end
      FROM route_search rs
      JOIN stops overall_start_stop ON rs.start_stop_id = overall_start_stop.id
      JOIN stops overall_end_stop ON rs.end_stop_id = overall_end_stop.id
      WHERE rs.end_stop_id = ANY(:endStopIds::int[])
      ORDER BY final_arrival_time, transfers
      LIMIT 100;
    `;
    const { rows: journeys } = await db.rawQuery(recursiveQuery, bindings);

    if (journeys.length === 0) {
      return response.ok([]);
    }

    const routeRuns = new Set<string>();
    journeys.forEach((j: any) =>
      j.legs.forEach((leg: any) => routeRuns.add(`${leg.route_id}:${leg.run}`)),
    );
    const routeIds = [
      ...new Set(
        journeys.flatMap((j: any) =>
          j.legs.map((leg: any) => leg.route_id.toString()),
        ),
      ),
    ] as number[];
    const runs = [
      ...new Set(
        journeys.flatMap((j: any) => j.legs.map((leg: any) => leg.run)),
      ),
    ] as number[];

    const reports = await Report.query()
      .where((query) => {
        query.whereIn("route_id", routeIds).andWhere((builder) => {
          builder
            .whereNull("run")
            .orWhereIn(db.raw("(route_id, run)"), [
              db.raw(
                [...routeRuns]
                  .map((rr) => `(${rr.replace(":", ",")})`)
                  .join(","),
              ),
            ]);
        });
      })
      .andWhere("created_at", ">=", todayStart)
      .select(
        "id",
        "route_id",
        "run",
        "type",
        "description",
        "created_at",
        "location",
      );

    // NOWE ZAPYTANIE O LOKALIZACJE Z FILTROWANIEM
    let latestLocations: any[] = [];
    if (runs.length > 0) {
      const { rows } = await db.rawQuery(
        `
        WITH recent_tracks_with_counts AS (
          -- Krok 1: Pobierz tracki z ostatnich 15 minut i policz, ile ich jest dla każdego 'run'
          SELECT
            id, run, location, created_at,
            COUNT(*) OVER(PARTITION BY run) as track_count
          FROM tracks
          WHERE run = ANY(:runs::int[]) AND created_at >= NOW() - INTERVAL '15 minutes'
        ),
        valid_moving_tracks AS (
          -- Krok 2: Odfiltruj "zamrożone" punkty
          SELECT id, run, location, created_at
          FROM recent_tracks_with_counts t1
          WHERE
            -- Jeśli jest mało punktów, zawsze je akceptuj
            t1.track_count <= 2
            OR
            -- Jeśli jest więcej, sprawdź, czy w promieniu 100m jest inny punkt z tego samego kursu
            EXISTS (
              SELECT 1 FROM recent_tracks_with_counts t2
              WHERE t2.run = t1.run AND t2.id != t1.id
              AND ST_DWithin(t1.location::geography, t2.location::geography, 100)
            )
        ),
        latest_valid_tracks AS (
            -- Krok 3: Z przefiltrowanej listy wybierz najnowszy punkt dla każdego 'run'
            SELECT *, ROW_NUMBER() OVER(PARTITION BY run ORDER BY created_at DESC) as rn
            FROM valid_moving_tracks
        )
        SELECT run, ST_AsGeoJSON(location) as location, created_at
        FROM latest_valid_tracks
        WHERE rn = 1;
      `,
        { runs },
      );
      latestLocations = rows;
    }

    const reportsMap = new Map<string, any[]>();
    for (const report of reports) {
      const key = `${report.routeId}:${report.run}`;
      if (!reportsMap.has(key)) {
        reportsMap.set(key, []);
      }
      reportsMap.get(key)?.push({
        id: report.id,
        run: report.run,
        type: report.type,
        description: report.description,
        created_at: report.createdAt,
        coordinates: report.coordinates,
      });
    }

    const locationsMap = new Map<number, any>();
    for (const loc of latestLocations) {
      const locations = JSON.parse(loc.location).coordinates;
      locationsMap.set(loc.run, {
        longitude: locations[0],
        latitude: locations[1],
        timestamp: loc.created_at,
      });
    }

    const result = journeys.map((j: any) => {
      const firstLeg = j.legs[0];
      const lastLeg = j.legs[j.legs.length - 1];
      const walkingTimeToStartMinutes = Math.ceil(
        j.distance_from_start / WALKING_SPEED_MPS / 60,
      );
      const walkingTimeFromEndMinutes = Math.ceil(
        j.distance_to_end / WALKING_SPEED_MPS / 60,
      );
      const busDepartureTime = DateTime.fromISO(firstLeg.departure_time, {
        zone: "Europe/Warsaw",
      });
      const busArrivalTime = DateTime.fromISO(lastLeg.arrival_time, {
        zone: "Europe/Warsaw",
      });
      const effectiveDepartureTime = busDepartureTime.minus({
        minutes: walkingTimeToStartMinutes,
      });
      const effectiveArrivalTime = busArrivalTime.plus({
        minutes: walkingTimeFromEndMinutes,
      });
      const firstLegDepartureCoords = JSON.parse(
        firstLeg.departure_coords,
      ).coordinates;
      const lastLegArrivalCoords = JSON.parse(
        lastLeg.arrival_coords,
      ).coordinates;

      return {
        departure: {
          name: firstLeg.departure_stop_name,
          id: firstLeg.departure_stop_id,
          coordinates: {
            longitude: firstLegDepartureCoords[0],
            latitude: firstLegDepartureCoords[1],
          },
          time: effectiveDepartureTime.toFormat("HH:mm:ss"),
          distance: j.distance_from_start,
        },
        arrival: {
          name: lastLeg.arrival_stop_name,
          id: lastLeg.arrival_stop_id,
          coordinates: {
            longitude: lastLegArrivalCoords[0],
            latitude: lastLegArrivalCoords[1],
          },
          time: effectiveArrivalTime.toFormat("HH:mm:ss"),
          distance: j.distance_to_end,
        },
        travel_time: Math.round(
          effectiveArrivalTime.diff(effectiveDepartureTime, "minutes").minutes,
        ),
        transfers: j.transfers,
        routes: j.legs.map((leg: any) => {
          const legDepartureTime = DateTime.fromISO(leg.departure_time, {
            zone: "Europe/Warsaw",
          });
          const legArrivalTime = DateTime.fromISO(leg.arrival_time, {
            zone: "Europe/Warsaw",
          });
          const legDepartureCoords = JSON.parse(
            leg.departure_coords,
          ).coordinates;
          const legArrivalCoords = JSON.parse(leg.arrival_coords).coordinates;
          const runKey = `${leg.route_id}:${leg.run}`;
          const nullRunKey = `${leg.route_id}:null`;
          const runReports = reportsMap.get(runKey) ?? [];
          const nullRunReports = reportsMap.get(nullRunKey) ?? [];
          const currentLocation = locationsMap.get(leg.run) ?? null;

          return {
            id: leg.route_id,
            name: leg.route_name,
            operator: leg.operator,
            type: leg.route_type,
            run: leg.run,
            current_location: currentLocation,
            departure: {
              name: leg.departure_stop_name,
              id: leg.departure_stop_id,
              coordinates: {
                longitude: legDepartureCoords[0],
                latitude: legDepartureCoords[1],
              },
              time: leg.departure_time,
            },
            arrival: {
              name: leg.arrival_stop_name,
              id: leg.arrival_stop_id,
              coordinates: {
                longitude: legArrivalCoords[0],
                latitude: legArrivalCoords[1],
              },
              time: leg.arrival_time,
            },
            travel_time: Math.round(
              legArrivalTime.diff(legDepartureTime, "minutes").minutes,
            ),
            destination: leg.destination,
            reports: [...nullRunReports, ...runReports],
          };
        }),
        _effective_departure_time: effectiveDepartureTime.toFormat("HH:mm:ss"),
      };
    });

    result.sort(
      (
        a: { _effective_departure_time: string; travel_time: number },
        b: { _effective_departure_time: any; travel_time: number },
      ) => {
        const departureComparison = a._effective_departure_time.localeCompare(
          b._effective_departure_time,
        );
        if (departureComparison !== 0) {
          return departureComparison;
        }
        return a.travel_time - b.travel_time;
      },
    );

    result.forEach((r: any) => delete r._effective_departure_time);

    return response.ok(result);
  }

  /**
   * @show
   * @summary Routes - Get route details
   * @description Get detailed information about a specific route, including its stops and schedules.
   * @paramPath id - The ID of the route to retrieve @example(1)
   * @paramQuery destination - (Optional) Filter schedules by destination
   * @responseBody 200 - {"id": 2,"name": "LUZ Krapkowice Strzelce Opolskie","type":"bus", "operator": "LUZ", "destinations": ["KRAPKOWICE","STRZELCE OPOLSKIE"],"stops": [{"id": 17,"name": "KRAPKOWICE ul. Prudnicka","type":"bus","coordinates": {"longitude": 17.965,"latitude": 50.471},"schedules": [{"id": 663, "time": "06:30:00", "destination": "KRAPKOWICE","run": 1, "conditions": [{"id": 1, "name": "D", "description": "Kursuje od poniedziałku do piątku oprócz świąt"}]},{"id": 423, "time": "06:50:00", "destination": "STRZELCE OPOLSKIE", "run": 1, "conditions": [{"id": 1,"name": "D","description": "Kursuje od poniedziałku do piątku oprócz świąt"}]}]}]}
   * @tag Routes
   */
  async show({ params, request }: HttpContext) {
    const routeId = Number(params.id) || 0;
    const destination = request.input("destination", false) as string | false;

    const route = await Route.query()
      .where("id", routeId)
      .preload("stops", (stopQuery) => {
        stopQuery.preload("schedules", (scheduleQuery) => {
          scheduleQuery.whereHas("routeStop", (routeStopQuery) => {
            routeStopQuery.where("route_id", routeId);
          });
          scheduleQuery.preload("conditions");
          if (destination !== false) {
            scheduleQuery.where("destination", destination);
          }
        });
      })
      .firstOrFail();

    const allRouteDestinations = await Schedule.query()
      .whereHas("routeStop", (routeStopQuery) => {
        routeStopQuery.where("route_id", routeId);
      })
      .distinct("destination")
      .orderBy("destination")
      .select("destination")
      .then((schedules) => schedules.map((s) => s.destination));

    const currentTime = new Date().toLocaleTimeString("sv-SE", {
      timeZone: "Europe/Warsaw",
    });

    return {
      id: route.id,
      name: route.name,
      operator: route.operator,
      type: route.type,
      destinations: allRouteDestinations,
      stops: route.stops.map((stop) => {
        return {
          id: stop.id,
          name: stop.name,
          type: stop.type,
          coordinates: stop.coordinates,
          schedules: stop.schedules
            .map((schedule) => {
              return {
                id: schedule.id,
                time: schedule.time,
                destination: schedule.destination,
                run: schedule.run,
                sequence: schedule.sequence,
                conditions: schedule.conditions.map((type) => {
                  return {
                    id: type.id,
                    name: type.name,
                    description: type.description,
                  };
                }),
              };
            })
            .sort(
              (a, b) =>
                Number(a.time < currentTime) - Number(b.time < currentTime) ||
                a.time.localeCompare(b.time),
            ),
        };
      }),
    };
  }
}
