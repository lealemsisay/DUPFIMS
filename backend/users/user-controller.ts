import { Prisma } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { UserManagementError } from "./user-service";

export function sendUserError(
  error: unknown,
  response: Response,
  next: NextFunction,
) {
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

export function invalidRequest(response: Response) {
  response.status(400).json({ error: "The user-management request is invalid." });
}

export function getActorId(request: Request) {
  const actorId = request.authenticatedUser?.id;
  if (!actorId) throw new UserManagementError("Authentication is required.", 401);
  return actorId;
}
