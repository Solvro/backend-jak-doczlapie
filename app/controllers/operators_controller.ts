import type { HttpContext } from "@adonisjs/core/http";
import db from "@adonisjs/lucid/services/db";

import Route from "#models/route";

export default class OperatorsController {
  /**
   * @index
   * @summary List all unique operators
   * @description Retrieves a list of all unique operator names from the database.
   * @responseBody 200 - ["PKS w Strzelcach Op. S.A.", "LUZ", "POLREGIO"]
   * @tag Operators
   */
  public async index({ response }: HttpContext) {
    try {
      const operators = (await db
        .from("routes")
        .distinct("operator")
        .orderBy("operator", "asc")) as { operator: string }[];

      const operatorNames = operators.map((op) => op.operator);

      return response.ok(operatorNames);
    } catch (error) {
      console.error("Error fetching operators:", error);
      return response.internalServerError({
        message: "Failed to fetch operators.",
      });
    }
  }

  /**
   * @show
   * @summary Get all routes for a specific operator
   * @description Retrieves a list of all routes operated by the given operator name.
   * @paramPath id - The ID of the stop to retrieve @example(1)
   * @responseBody 200 - [{"id": 1, "name": "PKS Krapkowice -> Gogolin", "type": "bus"}]
   * @tag Operators
   */
  public async show({ request, response }: HttpContext) {
    const routes = await Route.query()
      .where(
        "operator",
        decodeURIComponent(request.param("name", "test") as string),
      )
      .preload("tracks")
      .preload("reports")
      .preload("stops", (stopQuery) => {
        stopQuery.preload("schedules", (scheduleQuery) => {
          scheduleQuery.whereHas("routeStop", (routeStopQuery) => {
            routeStopQuery.whereRaw("route_id = route_stops.route_id");
          });
          scheduleQuery.preload("conditions");
        });
      })
      .orderBy("name", "asc");

    return response.ok(routes);
  }
}
