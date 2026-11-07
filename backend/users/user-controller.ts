import { Prisma } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { ExclusiveRoleAlreadyAssignedError } from "./user-repository";
import { UserManagementError } from "./user-service";

export function sendUserError(
  error: unknown,
  response: Response,
  next: NextFunction,
) {
  if (error instanceof ExclusiveRoleAlreadyAssignedError) {
    response.status(409).json({ error: error.message });
    return;
  }
  if (error instanceof UserManagementError) {
    response.status(error.status).json({ error: error.message });
    return;
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    response.status(409).json({
      error: "That username or email address is already in use.",
    });
    return;
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  ) {
    response.status(404).json({ error: "User account not found." });
    return;
  }
  next(error);
}

const userFieldLabels: Record<string, string> = {
  fullName: "Full name",
  username: "Username",
  email: "Email address",
  phoneNumber: "Phone number",
  password: "Password",
  roleId: "User role",
  campusId: "Campus assignment",
  organizationalUnitId: "Organizational unit",
  status: "Account status",
  mustChangePassword: "First-login password-change requirement",
};

export function invalidRequest(response: Response, fields?: string[]) {
  const invalidFields = [
    ...new Set(
      (fields ?? [])
        .map((field) => userFieldLabels[field])
        .filter((field): field is string => Boolean(field)),
    ),
  ];
  response.status(400).json({
    error: invalidFields.length
      ? `Check these fields: ${invalidFields.join(", ")}.`
      : "The user-management request is invalid.",
  });
}

export function getActorId(request: Request) {
  const actorId = request.authenticatedUser?.id;
  if (!actorId) throw new UserManagementError("Authentication is required.", 401);
  return actorId;
}
