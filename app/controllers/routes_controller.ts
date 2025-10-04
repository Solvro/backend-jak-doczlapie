import type { HttpContext } from "@adonisjs/core/http";
import db from "@adonisjs/lucid/services/db";

import Route from "#models/route";
import Schedule from "#models/schedule";
import Stop from "#models/stop";
import { findRouteValidator } from "#validators/find_route";

export default class RoutesController {
  /**
   * @index
   * @summary Routes - Get routes based on start and end locations
   * @description Find routes that connect two geographical points within a specified radius.
   * @paramQuery  fromLatitude - (Optional) Filter schedules by starting latitude
   * @paramQuery  fromLongitude - (Optional) Filter schedules by starting longitude
   * @paramQuery  toLatitude - (Optional) Filter schedules by destination latitude
   * @paramQuery  toLongitude - (Optional) Filter schedules by destination longitude
   * @responseBody 200 - [{"id": 1, "name": "PKS Krapkowice Gogolin", "operator": "PKS w Strzelcach Op. S.A.", "departure_stop": {"id": 5, "name": "Krapkowice ul. Opolska I", "time": "12:28:00", "distance": 789, "coordinates": { "longitude": 17.962, "latitude": 50.478}},"arrival_stop": {"id": 14,"name": "Gogolin ul. Krapkowicka I", "time": "12:47:00", "distance": 929, "coordinates": {"longitude": 18.013, "latitude": 50.489}},"run": 3, "destination": "KRAPKOWICE OS. 1000L", "travel_time": 19, "conditions": [{"name": "6x","description": "Kursuje w soboty powszednie oprócz Wielkiej Soboty"}]}]
   * @paramQuery radius - (Optional) in meters, default is 1000
   * @tag Routes
   */
  public async index({ request, response }: HttpContext) {
    const payload = await request.validateUsing(findRouteValidator);
    const radius = request.input("radius", 1000) as number;

    const fromPoint = `ST_SetSRID(ST_MakePoint(${payload.fromLongitude}, ${payload.fromLatitude}), 4326)`;
    const toPoint = `ST_SetSRID(ST_MakePoint(${payload.toLongitude}, ${payload.toLatitude}), 4326)`;

    const startStopT = await Stop.query()
      .whereRaw(`ST_DWithin(location::geography, ${fromPoint}::geography, ?)`, [
        radius,
      ])
      .select("id");
    const startStopIds = startStopT.map((s) => s.id);

    const endStopT = await Stop.query()
      .whereRaw(`ST_DWithin(location::geography, ${toPoint}::geography, ?)`, [
        radius,
      ])
      .select("id");

    const endStopIds = endStopT.map((s) => s.id);

    if (startStopIds.length === 0 || endStopIds.length === 0) {
      return response.ok([]);
    }

    const journeys = (await db
      .from("schedules as start_schedule")
      .join(
        "route_stops as start_rs",
        "start_schedule.route_stop_id",
        "start_rs.id",
      )
      .join(
        "stops as start_stop_details",
        "start_rs.stop_id",
        "start_stop_details.id",
      )
      .join("routes", "start_rs.route_id", "routes.id")
      .join("route_stops as end_rs", "routes.id", "end_rs.route_id")
      .join("schedules as end_schedule", (join) => {
        join
          .on("end_rs.id", "end_schedule.route_stop_id")
          .andOn("start_schedule.run", "end_schedule.run")
          .andOn("start_schedule.destination", "end_schedule.destination");
      })
      .join(
        "stops as end_stop_details",
        "end_rs.stop_id",
        "end_stop_details.id",
      )
      .whereIn("start_rs.stop_id", startStopIds)
      .whereIn("end_rs.stop_id", endStopIds)
      .whereRaw("start_rs.id < end_rs.id")
      .whereRaw("end_schedule.time > start_schedule.time")
      .select(
        "routes.id as route_id",
        "routes.name as route_name",
        "routes.operator",
        "start_schedule.id as departure_schedule_id",
        "start_schedule.time as departure_time",
        "start_schedule.run",
        "start_schedule.destination",
        "start_stop_details.id as start_stop_id",
        "start_stop_details.name as start_stop_name",
        "end_schedule.time as arrival_time",
        "end_stop_details.id as end_stop_id",
        "end_stop_details.name as end_stop_name",
        db.raw(
          `ST_AsGeoJSON(start_stop_details.location) as start_stop_coords`,
        ),
        db.raw(`ST_AsGeoJSON(end_stop_details.location) as end_stop_coords`),
        db.raw(
          `ROUND(ST_Distance(start_stop_details.location::geography, ${fromPoint}::geography)) as distance_to_start_stop`,
        ),
        db.raw(
          `ROUND(ST_Distance(end_stop_details.location::geography, ${toPoint}::geography)) as distance_from_end_stop`,
        ),
        db.raw(
          `EXTRACT(EPOCH FROM (end_schedule.time - start_schedule.time)) / 60 as travel_time_minutes`,
        ),
      )
      .distinct()) as {
      route_id: number;
      route_name: string;
      operator: string;
      departure_schedule_id: number;
      departure_time: string;
      run: number;
      destination: string;
      start_stop_id: number;
      start_stop_name: string;
      arrival_time: string;
      end_stop_id: number;
      end_stop_name: string;
      start_stop_coords: string;
      end_stop_coords: string;
      distance_to_start_stop: number;
      distance_from_end_stop: number;
      travel_time_minutes: number;
    }[];

    if (journeys.length === 0) {
      return response.ok([]);
    }

    const departureScheduleIds = journeys.map((j) => j.departure_schedule_id);
    const scheduleConditions = (await db
      .from("schedule_conditions")
      .join("conditions", "schedule_conditions.condition_id", "conditions.id")
      .whereIn("schedule_conditions.schedule_id", departureScheduleIds)
      .select(
        "schedule_conditions.schedule_id",
        "conditions.name",
        "conditions.description",
      )) as { schedule_id: number; name: string; description: string }[];

    const conditionsMap = new Map<
      number,
      { name: string; description: string }[]
    >();
    for (const sc of scheduleConditions) {
      if (!conditionsMap.has(sc.schedule_id)) {
        conditionsMap.set(sc.schedule_id, []);
      }
      conditionsMap
        .get(sc.schedule_id)
        ?.push({ name: sc.name, description: sc.description });
    }

    const result = journeys.map((j) => {
      const departureCoords = JSON.parse(j.start_stop_coords) as {
        type: string;
        coordinates: [number, number];
      };
      const arrivalCoords = JSON.parse(j.end_stop_coords) as {
        type: string;
        coordinates: [number, number];
      };

      return {
        id: j.route_id,
        name: j.route_name,
        operator: j.operator,
        departure_stop: {
          id: j.start_stop_id,
          name: j.start_stop_name,
          time: j.departure_time,
          distance: j.distance_to_start_stop,
          coordinates: {
            longitude: departureCoords.coordinates[0],
            latitude: departureCoords.coordinates[1],
          },
        },
        arrival_stop: {
          id: j.end_stop_id,
          name: j.end_stop_name,
          time: j.arrival_time,
          distance: j.distance_from_end_stop,
          coordinates: {
            longitude: arrivalCoords.coordinates[0],
            latitude: arrivalCoords.coordinates[1],
          },
        },
        run: j.run,
        destination: j.destination,
        travel_time: Math.round(j.travel_time_minutes),
        conditions: conditionsMap.get(j.departure_schedule_id) ?? [],
      };
    });

    const currentTime = new Date().toLocaleTimeString("sv-SE", {
      timeZone: "Europe/Warsaw",
    });
    result.sort(
      (a, b) =>
        (a.departure_stop.time < currentTime ? 1 : 0) -
          (b.departure_stop.time < currentTime ? 1 : 0) ||
        a.departure_stop.time.localeCompare(b.departure_stop.time),
    );

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
