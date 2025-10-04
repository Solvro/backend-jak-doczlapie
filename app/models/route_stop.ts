import { BaseModel, belongsTo, column, hasMany } from "@adonisjs/lucid/orm";
import type { BelongsTo, HasMany } from "@adonisjs/lucid/types/relations";

import Route from "./route.js";
import Schedule from "./schedule.js";
import Stop from "./stop.js";

export default class RouteStop extends BaseModel {
  public static table = "route_stops";

  @column({ isPrimary: true })
  declare id: number;

  @column()
  declare routeId: number;

  @column()
  declare stopId: number;

  @belongsTo(() => Route)
  declare route: BelongsTo<typeof Route>;

  @belongsTo(() => Stop)
  declare stop: BelongsTo<typeof Stop>;

  @hasMany(() => Schedule, {
    foreignKey: "routeStopId",
  })
  declare schedules: HasMany<typeof Schedule>;
}
