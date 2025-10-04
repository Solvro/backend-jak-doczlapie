import vine from "@vinejs/vine";

export const createReportValidator = vine.compile(
  vine.object({
    run: vine.number().optional(),
    type: vine.enum([
      "delay",
      "accident",
      "press",
      "failure",
      "did_not_arrive",
      "change",
      "other",
      "diffrent_stop_location",
      "request_stop",
    ]),
    description: vine.string().maxLength(255).optional(),
    coordinates: vine.object({
      latitude: vine.number().min(-90).max(90),
      longitude: vine.number().min(-180).max(180),
    }),
    image: vine
      .file({
        size: "2mb",
        extnames: ["jpg", "png", "jpeg", "gif"],
      })
      .optional(),
  }),
);
