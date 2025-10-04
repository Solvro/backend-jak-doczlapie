import { BaseSchema } from "@adonisjs/lucid/schema";

export default class extends BaseSchema {
  protected tableName = "tracks";

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments("id");
      table
        .integer("route_id")
        .references("id")
        .inTable("routes")
        .notNullable()
        .onDelete("CASCADE");
      table.integer("run").notNullable();
      table.specificType("location", "geography(Point, 4326)").notNullable();
      table.timestamp("created_at").defaultTo(this.now()).notNullable();
    });
  }

  async down() {
    this.schema.dropTable(this.tableName);
  }
}
