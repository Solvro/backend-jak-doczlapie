import { DateTime } from "luxon";

import { BaseModel, belongsTo, column, manyToMany } from "@adonisjs/lucid/orm";
import type { BelongsTo, ManyToMany } from "@adonisjs/lucid/types/relations";

import Condition from "./condition.js";
import RouteStop from "./route_stop.js";

export default class Schedule extends BaseModel {
  @column({ isPrimary: true })
  declare id: number;

  @column()
  declare time: string;

  @column()
  declare sequence: number;

  @column()
  declare destination: string;

  @manyToMany(() => Condition, {
    pivotTable: "schedule_conditions",
    pivotForeignKey: "schedule_id",
    pivotRelatedForeignKey: "condition_id",
  })
  declare conditions: ManyToMany<typeof Condition>;

  @column()
  declare routeStopId: number;

  @column()
  declare run: number;

  @belongsTo(() => RouteStop)
  declare routeStop: BelongsTo<typeof RouteStop>;

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime;

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime;
}
