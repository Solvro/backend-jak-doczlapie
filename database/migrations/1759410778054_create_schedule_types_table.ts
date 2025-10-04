import { BaseSchema } from "@adonisjs/lucid/schema";

export default class extends BaseSchema {
  protected tableName = "schedule_conditions";

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments("id");
      table
        .integer("condition_id")
        .references("id")
        .inTable("conditions")
        .onDelete("CASCADE");
      table
        .integer("schedule_id")
        .references("id")
        .inTable("schedules")
        .onDelete("CASCADE");
    });
  }

  async down() {
    this.schema.dropTable(this.tableName);
  }
}
