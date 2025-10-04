// providers/postgis_provider.ts
import type { ApplicationService } from "@adonisjs/core/types";

export default class PostgisProvider {
  constructor(protected app: ApplicationService) {}

  async boot() {
    await import("../extensions/postgis.js");
  }
}
