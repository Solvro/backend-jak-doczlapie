import vine from "@vinejs/vine";

export const findRouteValidator = vine.compile(
  vine.object({
    fromLatitude: vine.number().min(-90).max(90),
    fromLongitude: vine.number().min(-180).max(180),
    toLatitude: vine.number().min(-90).max(90),
    toLongitude: vine.number().min(-180).max(180),
    radius: vine.number().min(0).optional(),
  }),
);
