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
   * @responseBody 200 - {"id": 17,"type":"bus","name": "KRAPKOWICE | ul. Prudnicka", "routes": [{"id": 2,"name": "LUZ Krapkowice Strzelce Opolskie","operator": "LUZ"}],"coordinates": {"longitude": 17.965,"latitude": 50.471},"distance": 355}
   * @tag Stops
   */
  async index({ request, response }: HttpContext) {
    const { latitude, longitude, radius } =
      await request.validateUsing(nearbyRouteValidator);
    const searchRadiusInMeters = radius ?? 1000;

    const nearbyStops = await Stop.query()
      .select(
        db.raw(
          "ST_Distance(location, ST_MakePoint(?, ?)::geography) as distance_in_meters",
          [longitude, latitude],
        ),
      )
      .whereRaw("ST_DWithin(location, ST_MakePoint(?, ?)::geography, ?)", [
        longitude,
        latitude,
        searchRadiusInMeters,
      ])
      .preload("routes")
      .orderBy("distance_in_meters", "asc");

    return response.ok(nearbyStops);
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
