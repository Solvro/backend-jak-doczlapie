/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { DateTime } from "luxon";

import {
  BaseModel,
  afterFetch,
  afterFind,
  beforeFetch,
  beforeFind,
  belongsTo,
  column,
  computed,
} from "@adonisjs/lucid/orm";
import db from "@adonisjs/lucid/services/db";
import * as model from "@adonisjs/lucid/types/model";
import type { BelongsTo } from "@adonisjs/lucid/types/relations";

import Route from "./route.js";

interface GeoJSONPoint {
  type: "Point";
  coordinates: [number, number];
}

export default class Track extends BaseModel {
  @column({ isPrimary: true })
  declare id: number;

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime;

  @column()
  declare routeId: number;

  @column()
  declare run: number;

  @column({
    prepare: (value) => value,
    serializeAs: null,
  })
  declare location: GeoJSONPoint;

  @belongsTo(() => Route)
  declare route: BelongsTo<typeof Route>;

  @computed()
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
    query: model.ModelQueryBuilderContract<typeof Track>,
  ) {
    query.select("*", db.raw("ST_AsGeoJSON(location) as location_geojson"));
  }

  @afterFind()
  public static async parseGeoJSON(track: Track) {
    if (track.$extras.location_geojson !== undefined) {
      track.location = JSON.parse(track.$extras.location_geojson);
    }
  }

  @afterFetch()
  public static async parseGeoJSONForMany(tracks: Track[]) {
    tracks.forEach((track) => {
      if (track.$extras.location_geojson !== undefined) {
        track.location = JSON.parse(track.$extras.location_geojson);
      }
    });
  }
}
