import { z } from "zod";

export const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Enter your user name or email.")
    .max(254, "User name or email is too long."),
  password: z
    .string()
    .min(1, "Enter your password.")
    .max(12)
    .refine(
      (value) => new TextEncoder().encode(value).length <= 72,
      "The password is too long.",
    ),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(12),
    newPassword: z
      .string()
      .min(6, "Use at least 6 characters for your new password.")
      .max(12, "Your new password must be no more than 12 characters.")
      .refine(
        (value) => new TextEncoder().encode(value).length <= 72,
        "Your new password must be no more than 72 bytes.",
      ),
    confirmPassword: z.string().min(1).max(128),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "The passwords do not match.",
  });

export type LoginInput = z.infer<typeof loginSchema>;
