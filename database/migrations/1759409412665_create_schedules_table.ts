import { BaseSchema } from "@adonisjs/lucid/schema";

export default class extends BaseSchema {
  protected tableName = "schedules";

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments("id");
      table
        .integer("route_stop_id")
        .references("id")
        .inTable("route_stops")
        .onDelete("CASCADE");
      table.time("time");
      table.integer("sequence");
      table.integer("run");
      table.string("destination").nullable();
      table.timestamps(true);
    });
  }

  async down() {
    this.schema.dropTable(this.tableName);
  }
}
