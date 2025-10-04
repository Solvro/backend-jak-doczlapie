import type { HttpContext } from "@adonisjs/core/http";
import db from "@adonisjs/lucid/services/db";

import Stop from "#models/stop";
import { nearbyRouteValidator } from "#validators/nearby_route_validator";

export default class StopsController {
  /**
   * @index
   * @summary Stops - Get all nearby stops
   * @paramQuery longitude
   * @paramQuery latitude
   * @paramQuery radius - (Optional) in meters
   * @responseBody 200 - [{"id": 38 "name":"XYZ","coordinates": {"longitude": 18.303,"latitude": 50.412},"type": "bus","routes": [{"id": 2,"name": "LUZ Krapkowice Strzelce Opolskie","operator": "LUZ","type": "bus","destinations": ["KRAPKOWICE","STRZELCE OPOLSKIE"]}],"distance": 4396019}]
   * @tag Stops
   */
  public async index({ request }: HttpContext) {
    const { latitude, longitude, radius } =
      await request.validateUsing(nearbyRouteValidator);
    const searchRadiusInMeters = radius ?? 1000;

    const nearbyStops = await Stop.query()
      .select(
        "id",
        "name",
        "location",
        "type",
        db.raw(
          "ST_Distance(location::geography, ST_MakePoint(?, ?)::geography) as distance_in_meters",
          [longitude, latitude],
        ),
      )
      .whereRaw(
        "ST_DWithin(location::geography, ST_MakePoint(?, ?)::geography, ?)",
        [longitude, latitude, searchRadiusInMeters],
      )
      .orderBy("distance_in_meters", "asc");

    if (nearbyStops.length === 0) {
      return [];
    }

    const nearbyStopIds = nearbyStops.map((stop) => stop.id);

    const routesData = await db
      .from("routes")
      .join("route_stops", "routes.id", "route_stops.route_id")
      .join("schedules", "route_stops.id", "schedules.route_stop_id")
      .whereIn("route_stops.stop_id", nearbyStopIds)
      .select(
        "route_stops.stop_id",
        "routes.id",
        "routes.name",
        "routes.operator",
        "routes.type",
      )
      .select(
        db.raw("ARRAY_AGG(DISTINCT schedules.destination) as destinations"),
      )
      .groupBy(
        "route_stops.stop_id",
        "routes.id",
        "routes.name",
        "routes.operator",
        "routes.type",
      );

    const routesByStopId = new Map<number, unknown[]>();
    for (const route of routesData as {
      stop_id: number;
      id: number;
      name: string;
      operator: string;
      type: string;
      destinations: string[];
    }[]) {
      if (!routesByStopId.has(route.stop_id)) {
        routesByStopId.set(route.stop_id, []);
      }
      routesByStopId.get(route.stop_id)?.push({
        id: route.id,
        name: route.name,
        operator: route.operator,
        type: route.type,
        destinations: route.destinations.sort(),
      });
    }

    return nearbyStops.map((stop: Stop) => {
      if (stop.location === null || !("coordinates" in stop.location)) {
        throw new Error(`Invalid location data for stop with ID ${stop.id}`);
      }
      const routes = routesByStopId.get(stop.id) ?? [];

      return {
        id: stop.id,
        name: stop.name,
        coordinates: {
          longitude: stop.location.coordinates[0],
          latitude: stop.location.coordinates[1],
        },
        type: stop.type,
        routes,
        distance: Math.round(
          Number(
            (stop.$extras as { distance_in_meters: string }).distance_in_meters,
          ),
        ),
      };
    });
  }

  /**
   * @show
   * @summary Stops - Get stop details
   * @paramPath id - The ID of the stop to retrieve @example(1)
   * @responseBody 200 - {"id": 17,"name":"KRAPKOWICE | ul. Prudnicka", "type":"bus","coordinates": {"longitude": 17.965,"latitude": 50.471  },"routes": [{"name": "LUZ Krapkowice Strzelce Opolskie", "type":"bus","id": 2,"operator": "LUZ","destinations": ["KRAPKOWICE","STRZELCE OPOLSKIE"],"schedules": [{"id": 663,"time": "06:30:00","destination": "KRAPKOWICE","run": 1,"conditions": [{"name": "D","description": "Kursuje od poniedziałku do piątku oprócz świąt","id": 1}]}},{"id": 423,"time": "06:50:00","destination": "STRZELCE OPOLSKIE","run": 1,"conditions": [{"name": "D","description": "Kursuje od poniedziałku do piątku oprócz świąt","id": 1}]}]}]}
   * @tag Stops
   */
  async show({ params }: HttpContext) {
    const stop = await Stop.query()
      .where("id", Number(params.id) || 0)
      .preload("routes", (routeQuery) => {
        routeQuery.preload("schedules", (scheduleQuery) => {
          scheduleQuery.preload("conditions");
          scheduleQuery.whereHas("routeStop", (stopQuery) => {
            stopQuery.where("stop_id", Number(params.id) || 0);
          });
        });
      })
      .firstOrFail();

    // return stop

    const currentTime = new Date().toLocaleTimeString("sv-SE", {
      timeZone: "Europe/Warsaw",
    });

    return {
      id: stop.id,
      name: stop.name,
      coordinates: stop.coordinates,
      type: stop.type,
      routes: stop.routes.map((route) => {
        return {
          name: route.name,
          id: route.id,
          type: route.type,
          operator: route.operator,
          destinations: Array.from(
            new Set(route.schedules.map((schedule) => schedule.destination)),
          ).sort(),
          schedules: route.schedules
            .map((schedule) => {
              return {
                id: schedule.id,
                time: schedule.time,
                destination: schedule.destination,
                run: schedule.run,
                sequence: schedule.sequence,
                conditions: schedule.conditions.map((type) => {
                  return {
                    name: type.name,
                    description: type.description,
                    id: type.id,
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
