import { z } from "zod";

const nullableText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().trim().max(max).nullable(),
  );

const password = z
  .string()
  .min(6)
  .max(12)
  .refine((value) => Buffer.byteLength(value, "utf8") <= 72);

export const accountRequestInputSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  username: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(/^[a-zA-Z0-9._-]+$/)
    .transform((value) => value.toLocaleLowerCase("en-US")),
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((value) => value.toLocaleLowerCase("en-US")),
  phoneNumber: nullableText(32),
  password,
  roleId: z.string().min(1).max(64),
  campusId: z.string().min(1).max(64).nullable(),
  organizationalUnitId: z.string().min(1).max(64).nullable(),
  mustChangePassword: z.literal(true),
});

export const accountRequestDecisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED", "RETURNED_FOR_CORRECTION"]),
  reason: z.string().trim().min(2).max(1000),
});

export const accountRequestListSchema = z.object({
  status: z
    .enum([
      "PENDING_APPROVAL",
      "APPROVED",
      "REJECTED",
      "RETURNED_FOR_CORRECTION",
    ])
    .optional(),
});
