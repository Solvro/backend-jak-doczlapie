import { BaseSchema } from "@adonisjs/lucid/schema";

export default class extends BaseSchema {
  protected tableName = "route_stops";

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments("id");
      table
        .integer("route_id")
        .references("id")
        .inTable("routes")
        .onDelete("CASCADE");
      table
        .integer("stop_id")
        .references("id")
        .inTable("stops")
        .onDelete("CASCADE");

      table.timestamp("created_at");
      table.timestamp("updated_at");
    });
  }

  async down() {
    this.schema.dropTable(this.tableName);
  }
}
