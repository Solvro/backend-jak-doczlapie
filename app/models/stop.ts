/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { DateTime } from "luxon";

import {
  BaseModel,
  afterFetch,
  afterFind,
  beforeFetch,
  beforeFind,
  column,
  computed,
  hasManyThrough,
  manyToMany,
} from "@adonisjs/lucid/orm";
import db from "@adonisjs/lucid/services/db";
import * as model from "@adonisjs/lucid/types/model";
import type {
  HasManyThrough,
  ManyToMany,
} from "@adonisjs/lucid/types/relations";

import Route from "./route.js";
import RouteStop from "./route_stop.js";
import Schedule from "./schedule.js";

interface GeoJSONPoint {
  type: "Point";
  coordinates: [number, number];
}

export default class Stop extends BaseModel {
  @column({ isPrimary: true })
  declare id: number;

  @column()
  declare name: string;

  @hasManyThrough([() => Schedule, () => RouteStop])
  declare schedules: HasManyThrough<typeof Schedule>;

  @column({
    prepare: (value) => value,
    serializeAs: null,
  })
  declare location: GeoJSONPoint | null;

  @column()
  declare type: "bus" | "train" | "tram";

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

  serializeExtras() {
    if (this.$extras.distance_in_meters === undefined) {
      return {};
    }
    return {
      distance: Math.round(this.$extras.distance_in_meters as number),
    };
  }

  @beforeFind()
  @beforeFetch()
  public static async fetchAsGeoJSON(
    query: model.ModelQueryBuilderContract<typeof Stop>,
  ) {
    query.select("*", db.raw("ST_AsGeoJSON(location) as location_geojson"));
  }

  @afterFind()
  public static async parseGeoJSON(stop: Stop) {
    if (stop.$extras.location_geojson !== undefined) {
      stop.location = JSON.parse(stop.$extras.location_geojson);
    }
  }

  @afterFetch()
  public static async parseGeoJSONForMany(stops: Stop[]) {
    stops.forEach((stop) => {
      if (stop.$extras.location_geojson !== undefined) {
        stop.location = JSON.parse(stop.$extras.location_geojson);
      }
    });
  }

  @manyToMany(() => Route, {
    pivotTable: "route_stops",
    pivotForeignKey: "stop_id",
    pivotRelatedForeignKey: "route_id",
  })
  declare routes: ManyToMany<typeof Route>;

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime;

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime;
}
