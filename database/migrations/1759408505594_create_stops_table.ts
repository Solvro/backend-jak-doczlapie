import { BaseSchema } from "@adonisjs/lucid/schema";

export default class extends BaseSchema {
  protected tableName = "stops";

  async up() {
    this.db.raw('CREATE EXTENSION IF NOT EXISTS "postgis";');

    this.schema.createTable(this.tableName, (table) => {
      table.increments("id");
      table.string("name", 1024);
      table.specificType("location", "geography(Point, 4326)");
      table.enum("type", ["bus", "train", "tram"]);

      table.timestamp("created_at");
      table.timestamp("updated_at");
    });
    this.schema.raw(
      `CREATE INDEX stops_location_idx ON ${this.tableName} USING GIST (location)`,
    );
  }

  async down() {
    this.schema.dropTable(this.tableName);
  }
}
