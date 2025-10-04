import { DateTime } from "luxon";

import { BaseModel, column } from "@adonisjs/lucid/orm";

export default class Condition extends BaseModel {
  @column({ isPrimary: true })
  declare id: number;

  @column({ isPrimary: true })
  declare name: string;

  @column({ isPrimary: true })
  declare description: string;

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime;

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime;
}
