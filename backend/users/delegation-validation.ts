import { z } from "zod";

export const delegationSchema = z
  .object({
    campusId: z.string().min(1).max(64),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
  })
  .refine(
    ({ startsAt, endsAt }) =>
      startsAt.getTime() >= Date.now() - 60_000 &&
      endsAt.getTime() > startsAt.getTime(),
    {
      message: "Delegation must have a valid start and a later end time.",
    },
  );
