import { BaseSchema } from "@adonisjs/lucid/schema";

export default class extends BaseSchema {
  protected tableName = "reports";

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments("id");
      table.integer("run");
      table
        .integer("route_id")
        .unsigned()
        .references("id")
        .inTable("routes")
        .onDelete("CASCADE");
      table
        .enum("type", [
          "delay",
          "accident",
          "press",
          "failure",
          "did_not_arrive",
          "change",
          "diffrent_stop_location",
          "other",
          "request_stop",
        ])
        .notNullable();
      table.string("description", 255);
      table.specificType("location", "geography(Point, 4326)").notNullable();
      table.string("image", 255);

      table.timestamp("created_at");
      table.timestamp("updated_at");
    });
  }

  async down() {
    this.schema.dropTable(this.tableName);
  }
}
