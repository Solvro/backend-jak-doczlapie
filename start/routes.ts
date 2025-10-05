import AutoSwagger from "adonis-autoswagger";

import router from "@adonisjs/core/services/router";

import swagger from "#config/swagger";

const OperatorsController = () => import("#controllers/operators_controller");

const ReportsController = () => import("#controllers/reports_controller");

const TracksController = () => import("#controllers/tracks_controller");

const StopsController = () => import("#controllers/stops_controller");
const RoutesController = () => import("#controllers/routes_controller");

router.get("/swagger", async () => {
  return AutoSwagger.default.docs(router.toJSON(), swagger);
});

router.get("/docs", async () => {
  return AutoSwagger.default.scalar("/swagger");
});

router
  .group(() => {
    router.resource("routes", RoutesController).only(["show", "index"]);
    router.resource("stops", StopsController).only(["index", "show"]);
    router.resource("routes/:id/tracks", TracksController).only(["store"]);
    router.get("/operators", [OperatorsController, "index"]);
    router.get("/operators/:name", [OperatorsController, "show"]);

    router
      .resource("routes/:id/reports", ReportsController)
      .only(["store", "index"]);
  })
  .prefix("/api/v1");

router.get("/", async () => {
  return { message: "Elo żelo!" };
});
