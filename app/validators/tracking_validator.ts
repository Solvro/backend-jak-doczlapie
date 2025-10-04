import vine from "@vinejs/vine";

export const storeTrackingValidator = vine.compile(
  vine.object({
    coordinates: vine.object({
      latitude: vine.number().min(-90).max(90),
      longitude: vine.number().min(-180).max(180),
    }),
    run: vine.number().min(1),
  }),
);
