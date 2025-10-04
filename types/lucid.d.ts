import { KnexPostgis } from "knex-postgis";

declare module "@adonisjs/lucid/services/db" {
  interface Database {
    st(): KnexPostgis;
  }
}
