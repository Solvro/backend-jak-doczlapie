import { DateTime } from "luxon";

import {
  BaseModel,
  column,
  hasMany,
  hasManyThrough,
  manyToMany,
} from "@adonisjs/lucid/orm";
import type {
  HasMany,
  HasManyThrough,
  ManyToMany,
} from "@adonisjs/lucid/types/relations";

import Report from "./report.js";
import RouteStop from "./route_stop.js";
import Schedule from "./schedule.js";
import Stop from "./stop.js";
import Track from "./track.js";

export default class Route extends BaseModel {
  @column({ isPrimary: true })
  declare id: number;

  @column()
  declare name: string;

  @column()
  declare operator: string;

  @column()
  declare type: "bus" | "train" | "tram";

  @hasMany(() => Track)
  declare tracks: HasMany<typeof Track>;

  @hasMany(() => Report)
  declare reports: HasMany<typeof Report>;

  @manyToMany(() => Stop, {
    pivotTable: "route_stops",
  })
  declare stops: ManyToMany<typeof Stop>;

  @hasMany(() => RouteStop)
  declare routeStops: HasMany<typeof RouteStop>;

  @hasManyThrough([() => Schedule, () => RouteStop])
  declare schedules: HasManyThrough<typeof Schedule>;

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime;

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime;
}
