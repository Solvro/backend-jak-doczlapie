import type { HttpContext } from "@adonisjs/core/http";
import db from "@adonisjs/lucid/services/db";

import Report from "#models/report";
import { createReportValidator } from "#validators/report";

export default class ReportsController {
  /**
   * @store
   * @summary Reports - Submit a report for a specific route.
   * @description Types: 'delay','accident','press','failure','did_not_arrive','change','other','diffrent_stop_location','request_stop'
   * @paramPath id - The ID of the route to track @example(1)
   * @requestBody <createReportValidator>
   * @responseBody 200 - <Report>.exclude(location)
   * @tag Reports
   */
  public async store({ request, response }: HttpContext) {
    const payload = await request.validateUsing(createReportValidator);
    const routeId = Number(request.param("id")) || 0;
    const reportData: Partial<Report> = {
      run: payload.run,
      routeId,
      type: payload.type,
      description: payload.description,
      location: db.raw("ST_SetSRID(ST_MakePoint(?, ?), 4326)", [
        payload.coordinates.longitude,
        payload.coordinates.latitude,
      ]) as unknown as Report["location"],
    };

    if (payload.image !== undefined) {
      await payload.image.move("./tmp/uploads", {
        name: `${new Date().getTime()}.${payload.image.extname}`,
      });

      if (payload.image.state !== "moved") {
        return response.badRequest({
          message: "Could not process the uploaded image.",
        });
      }
      reportData.image = payload.image.filePath;
    }
    const report = await Report.create(reportData);
    return response.created({
      message: "Report submitted successfully.",
      report,
    });
  }

  /**
   * @index
   * @summary Reports - Get all reports for a specific route
   * @description Retrieves all reports associated with a specific route ID.
   * @paramPath id - The ID of the route to track @example(1)
   * @responseBody 200 - <Report>.exclude(location)
   * @tag Reports
   */
  public async index({ request, response }: HttpContext) {
    const routeId = Number(request.param("id")) || 0;

    const reports = await Report.query().where("routeId", routeId);
    return response.ok(reports);
  }

  public async destroy({ request, response }: HttpContext) {
    const trackId = Number(request.param("id")) || 0;

    await Report.query().where("id", trackId).delete();
    return response.ok({status:"ok"});
  }



}
