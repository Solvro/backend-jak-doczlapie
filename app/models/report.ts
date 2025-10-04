import { DateTime } from "luxon";

import { BaseModel, column } from "@adonisjs/lucid/orm";

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
