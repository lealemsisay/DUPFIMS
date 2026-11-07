import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";

export async function listCampuses() {
  return prisma.campus.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ name: "asc" }, { code: "asc" }],
  });
}

export async function createCampus(
  actorId: string,
  input: { code: string; name: string },
) {
  return prisma.$transaction(async (transaction) => {
    const campus = await transaction.campus.create({ data: input });
    await transaction.auditLog.create({
      data: {
        actorId,
        campusId: campus.id,
        action: "CAMPUS_CREATED",
        entityType: "Campus",
        entityId: campus.id,
        detail: { code: campus.code, name: campus.name },
      },
    });
    return campus;
  });
}

export async function updateCampus(
  actorId: string,
  campusId: string,
  input: { code: string; name: string },
) {
  return prisma.$transaction(async (transaction) => {
    const campus = await transaction.campus.update({
      where: { id: campusId },
      data: input,
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        campusId,
        action: "CAMPUS_UPDATED",
        entityType: "Campus",
        entityId: campusId,
        detail: { code: campus.code, name: campus.name },
      },
    });
    return campus;
  });
}

export async function setCampusStatus(
  actorId: string,
  campusId: string,
  isActive: boolean,
) {
  return prisma.$transaction(async (transaction) => {
    const campus = await transaction.campus.update({
      where: { id: campusId },
      data: { isActive },
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        campusId,
        action: isActive ? "CAMPUS_ACTIVATED" : "CAMPUS_DEACTIVATED",
        entityType: "Campus",
        entityId: campusId,
        detail: { isActive },
      },
    });
    return campus;
  });
}

export function isCampusDuplicate(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export function isCampusMissing(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
}
