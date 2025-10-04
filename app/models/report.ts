import { DateTime } from "luxon";

import {
  BaseModel,
  beforeFetch,
  beforeFind,
  column,
  computed,
} from "@adonisjs/lucid/orm";
import db from "@adonisjs/lucid/services/db";
import * as model from "@adonisjs/lucid/types/model";

interface GeoJSONPoint {
  type: "Point";
  coordinates: [number, number];
}
export default class Report extends BaseModel {
  @column({ isPrimary: true })
  declare id: number;

  @column()
  declare run: number;

  @column()
  declare routeId: number;

  @column()
  declare type:
    | "delay"
    | "accident"
    | "press"
    | "failure"
    | "did_not_arrive"
    | "diffrent_stop_location"
    | "change"
    | "other"
    | "request_stop";

  @computed({ serializeAs: "coordinates" })
  get coordinates(): { longitude: number; latitude: number } | null {
    const geojson = this.$extras.location_geojson as string | undefined;
    if (geojson === undefined) {
      return null;
    }

    const parsed = JSON.parse(geojson) as GeoJSONPoint;

    return {
      longitude: parsed.coordinates[0],
      latitude: parsed.coordinates[1],
    };
  }

  @beforeFind()
  @beforeFetch()
  public static async fetchAsGeoJSON(
    query: model.ModelQueryBuilderContract<typeof Report>,
  ) {
    query.select("*", db.raw("ST_AsGeoJSON(location) as location_geojson"));
  }

  @column()
  declare description: string | null;

  @column()
  declare location: GeoJSONPoint;

  @column()
  declare image: string | null;

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime;

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime;
}
