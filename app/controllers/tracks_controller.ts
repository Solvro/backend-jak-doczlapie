import type { HttpContext } from "@adonisjs/core/http";
import db from "@adonisjs/lucid/services/db";

import Track from "#models/track";
import { storeTrackingValidator } from "#validators/tracking_validator";

export default class TracksController {
  /**
   * @store
   * @summary Trackings - Store user tracking data
   * @paramPath id - The ID of the route to track @example(1)
   * @requestBody <storeTrackingValidator>
   * @responseBody 200 - <Track>.exclude(location)
   * @tag Tracks
   */
  public async store({ request }: HttpContext) {
    const data = await request.validateUsing(storeTrackingValidator);
    const track = await Track.create({
      routeId: Number(request.param("id")) || 0,
      run: data.run,
      location: db.raw("ST_GeomFromGeoJSON(?)", [
        JSON.stringify({
          type: "Point",
          coordinates: [data.coordinates.longitude, data.coordinates.latitude],
        }),
      ]) as unknown as Track["location"],
    });
    return track;
  }
}
