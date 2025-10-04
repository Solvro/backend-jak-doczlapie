import knexPostgis, { KnexPostgis } from "knex-postgis";

import { Database } from "@adonisjs/lucid/database";

declare module "knex" {
  interface Knex {
    postgis?: KnexPostgis;
  }
}

declare module "@adonisjs/lucid/database" {
  interface Database {
    st(): KnexPostgis;
  }
}

Database.macro("st", function (this: Database, connectionName?: string) {
  connectionName ??= this.primaryConnectionName;
  this.manager.connect(connectionName);

  const connection = this.getRawConnection(connectionName)?.connection;

  if (connection?.client === undefined) {
    throw new Error(`Cannot find connection named "${connectionName}"`);
  }

  knexPostgis(connection.client);

  if (connection.client.postgis === undefined) {
    throw new Error("PostGIS extension is not configured properly");
  }
  return connection.client.postgis;
});
