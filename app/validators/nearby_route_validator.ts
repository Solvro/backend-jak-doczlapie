import vine from "@vinejs/vine";

export const nearbyRouteValidator = vine.compile(
  vine.object({
    latitude: vine.number().range([-90, 90]),
    longitude: vine.number().range([-180, 180]),
    radius: vine.number().positive().optional(),
  }),
);
