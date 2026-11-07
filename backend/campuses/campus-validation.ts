import { z } from "zod";

const campusFields = {
  code: z
    .string()
    .trim()
    .min(2)
    .max(24)
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/)
    .transform((value) => value.toLocaleUpperCase("en-US")),
  name: z.string().trim().min(2).max(120),
};

export const createCampusSchema = z.object(campusFields);
export const updateCampusSchema = z.object(campusFields);
export const campusStatusSchema = z.object({ isActive: z.boolean() });
