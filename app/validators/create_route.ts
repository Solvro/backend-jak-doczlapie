import vine from "@vinejs/vine";

const stopSchema = vine.object({
  name: vine.string().trim(),
  time: vine.string().regex(/^\d{2}:\d{2}$/),
  conditions: vine.array(vine.string()),
  direction: vine.string(),
  run: vine.number(),
});

const routeSchema = vine.object({
  route: vine.string(),
  operator: vine.string(),
  type: vine.enum(["bus", "train", "tram"]),
  stops: vine.array(stopSchema),
});

export const createRouteValidator = vine.compile(
  vine.object({ data: vine.array(routeSchema) }),
);
