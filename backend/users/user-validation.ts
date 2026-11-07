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

export const updateUserSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((value) => value.toLocaleLowerCase("en-US")),
  phoneNumber: nullableText(32),
  campusId: z.string().min(1).max(64).nullable(),
  organizationalUnitId: z.string().min(1).max(64).nullable(),
});

export const userListQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  roleId: z.string().min(1).max(64).optional(),
  campusId: z.string().min(1).max(64).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "LOCKED"]).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export const roleAssignmentSchema = z.object({
  roleId: z.string().min(1).max(64),
});

export const accountStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]),
});

export const resetPasswordSchema = z.object({
  password,
});
