import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import {
  exclusiveRoleNames,
  managedRoleNamesFor,
  type UserManagerRole,
} from "./assignable-roles";

export class ExclusiveRoleAlreadyAssignedError extends Error {
  constructor(roleName: string) {
    super(`The ${roleName} role is already assigned to an account.`);
    this.name = "ExclusiveRoleAlreadyAssignedError";
  }
}

const userSelect = {
  id: true,
  username: true,
  email: true,
  fullName: true,
  phoneNumber: true,
  status: true,
  mustChangePassword: true,
  isProtectedAccount: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  roles: {
    select: { role: { select: { id: true, name: true } } },
  },
  campuses: {
    select: { campus: { select: { id: true, name: true, code: true } } },
  },
  organizationalUnits: {
    select: {
      organizationalUnit: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.UserSelect;

export type CreateUserRecord = {
  username: string;
  email: string | null;
  fullName: string;
  phoneNumber: string | null;
  passwordHash: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  mustChangePassword: boolean;
  roleId: string;
  roleName: string;
  campusId: string | null;
  organizationalUnitId: string | null;
};

export async function listUsers(
  actorRole: UserManagerRole,
  filters: {
    search?: string;
    roleId?: string;
    campusId?: string;
    status?: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "LOCKED";
  },
  page: number,
  pageSize: number,
) {
  const where: Prisma.UserWhereInput = {
    roles: {
      some: {
        role: { name: { in: [...managedRoleNamesFor(actorRole)] } },
      },
    },
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.roleId
      ? {
          AND: [
            {
              roles: {
                some: { role: { name: { in: [...managedRoleNamesFor(actorRole)] } } },
              },
            },
            { roles: { some: { roleId: filters.roleId } } },
          ],
        }
      : {}),
    ...(filters.campusId
      ? { campuses: { some: { campusId: filters.campusId } } }
      : {}),
    ...(filters.search
      ? {
          OR: [
            { fullName: { contains: filters.search, mode: "insensitive" } },
            { username: { contains: filters.search, mode: "insensitive" } },
            { email: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: userSelect,
      orderBy: [{ fullName: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { total, users };
}

export function getUser(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: userSelect,
  });
}

export function getUserOptions() {
  return prisma.$transaction([
    prisma.role.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.campus.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
    prisma.organizationalUnit.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
}

export function getAssignableRole(roleId: string) {
  return prisma.role.findUnique({
    where: { id: roleId },
    select: { id: true, name: true },
  });
}

export function getCampus(id: string) {
  return prisma.campus.findFirst({
    where: { id, isActive: true },
    select: { id: true, name: true },
  });
}

export function getOrganizationalUnit(id: string) {
  return prisma.organizationalUnit.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
}

export function getOrganizationalUnitByName(name: string) {
  return prisma.organizationalUnit.findUnique({
    where: { name },
    select: { id: true, name: true },
  });
}

export async function createUserRecord(
  actorId: string,
  user: CreateUserRecord,
) {
  return prisma.$transaction(async (transaction) => {
    if ((exclusiveRoleNames as readonly string[]).includes(user.roleName)) {
      const existingRoleAssignment = await transaction.userRole.count({
        where: {
          roleId: user.roleId,
        },
      });
      if (existingRoleAssignment > 0) {
        throw new ExclusiveRoleAlreadyAssignedError(user.roleName);
      }
    }
    const created = await transaction.user.create({
      data: {
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        passwordHash: user.passwordHash,
        status: user.status,
        mustChangePassword: user.mustChangePassword,
        roles: { create: { role: { connect: { id: user.roleId } } } },
        ...(user.campusId
          ? {
              campuses: {
                create: {
                  campus: { connect: { id: user.campusId } },
                  isPrimary: true,
                },
              },
            }
          : {}),
        ...(user.organizationalUnitId
          ? {
              organizationalUnits: {
                create: {
                  organizationalUnit: {
                    connect: { id: user.organizationalUnitId },
                  },
                },
              },
            }
          : {}),
      },
      select: userSelect,
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "USER_CREATED",
        entityType: "User",
        entityId: created.id,
        detail: { username: created.username, role: user.roleName },
      },
    });
    return created;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function updateUserRecord(
  actorId: string,
  userId: string,
  data: {
    fullName: string;
    email: string | null;
    phoneNumber: string | null;
    campusId: string | null;
    organizationalUnitId: string | null;
  },
) {
  return prisma.$transaction(async (transaction) => {
    await transaction.user.update({
      where: { id: userId },
      data: {
        fullName: data.fullName,
        email: data.email,
        phoneNumber: data.phoneNumber,
        campuses: {
          deleteMany: {},
          ...(data.campusId
            ? {
                create: {
                  campus: { connect: { id: data.campusId } },
                  isPrimary: true,
                },
              }
            : {}),
        },
        organizationalUnits: {
          deleteMany: {},
          ...(data.organizationalUnitId
            ? {
                create: {
                  organizationalUnit: {
                    connect: { id: data.organizationalUnitId },
                  },
                },
              }
            : {}),
        },
      },
    });
    const updated = await transaction.user.findUniqueOrThrow({
      where: { id: userId },
      select: userSelect,
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "USER_UPDATED",
        entityType: "User",
        entityId: userId,
        detail: { fullName: data.fullName, campusId: data.campusId },
      },
    });
    return updated;
  });
}

export async function changeUserRole(
  actorId: string,
  userId: string,
  roleId: string,
  roleName: string,
  organizationalUnitId: string | null,
) {
  return prisma.$transaction(async (transaction) => {
    if ((exclusiveRoleNames as readonly string[]).includes(roleName)) {
      const existingRoleAssignment = await transaction.userRole.count({
        where: { roleId, userId: { not: userId } },
      });
      if (existingRoleAssignment > 0) {
        throw new ExclusiveRoleAlreadyAssignedError(roleName);
      }
    }
    await transaction.userRole.deleteMany({ where: { userId } });
    await transaction.userRole.create({ data: { userId, roleId } });
    await transaction.userOrganizationalUnit.deleteMany({ where: { userId } });
    if (organizationalUnitId) {
      await transaction.userOrganizationalUnit.create({
        data: { userId, organizationalUnitId },
      });
    }
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "USER_ROLE_CHANGED",
        entityType: "User",
        entityId: userId,
        detail: { role: roleName },
      },
    });
    return transaction.user.findUniqueOrThrow({
      where: { id: userId },
      select: userSelect,
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function changeUserStatus(
  actorId: string,
  userId: string,
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED",
) {
  return prisma.$transaction(async (transaction) => {
    const updated = await transaction.user.update({
      where: { id: userId },
      data: { status },
      select: userSelect,
    });
    if (status !== "ACTIVE") {
      await transaction.userSession.deleteMany({ where: { userId } });
    }
    await transaction.auditLog.create({
      data: {
        actorId,
        action:
          status === "ACTIVE"
            ? "USER_ACTIVATED"
            : status === "SUSPENDED"
              ? "USER_SUSPENDED"
              : "USER_DEACTIVATED",
        entityType: "User",
        entityId: userId,
        detail: { status },
      },
    });
    return updated;
  });
}

export async function resetUserPassword(
  actorId: string,
  userId: string,
  passwordHash: string,
) {
  return prisma.$transaction(async (transaction) => {
    const updated = await transaction.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: true },
      select: userSelect,
    });
    await transaction.userSession.deleteMany({ where: { userId } });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "USER_PASSWORD_RESET",
        entityType: "User",
        entityId: userId,
        detail: { mustChangePassword: true },
      },
    });
    return updated;
  });
}

export function getUserAudit(userId: string) {
  return prisma.auditLog.findMany({
    where: { entityType: "User", entityId: userId },
    select: {
      id: true,
      action: true,
      detail: true,
      createdAt: true,
      actor: { select: { id: true, username: true, fullName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export function listUserDelegations(userId: string) {
  return prisma.delegation.findMany({
    where: { delegateId: userId },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      revokedAt: true,
      campus: { select: { id: true, name: true, code: true } },
      grantor: { select: { fullName: true, username: true } },
    },
    orderBy: { startsAt: "desc" },
  });
}

export async function createUserDelegation(
  actorId: string,
  userId: string,
  campusId: string,
  startsAt: Date,
  endsAt: Date,
) {
  return prisma.$transaction(async (transaction) => {
    const delegation = await transaction.delegation.create({
      data: {
        grantorId: actorId,
        delegateId: userId,
        campusId,
        startsAt,
        endsAt,
      },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        revokedAt: true,
        campus: { select: { id: true, name: true, code: true } },
        grantor: { select: { fullName: true, username: true } },
      },
    });
    await transaction.auditLog.createMany({
      data: [
        {
          actorId,
          campusId,
          action: "DELEGATION_CREATED",
          entityType: "Delegation",
          entityId: delegation.id,
          detail: { delegateId: userId, startsAt, endsAt },
        },
        {
          actorId,
          campusId,
          action: "REPRESENTATIVE_DELEGATED",
          entityType: "User",
          entityId: userId,
          detail: {
            delegationId: delegation.id,
            campus: delegation.campus.name,
            startsAt,
            endsAt,
          },
        },
      ],
    });
    return delegation;
  });
}

export async function revokeUserDelegation(
  actorId: string,
  userId: string,
  delegationId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.delegation.findFirst({
      where: { id: delegationId, delegateId: userId, revokedAt: null },
      select: { campusId: true },
    });
    if (!existing) return false;
    await transaction.delegation.update({
      where: { id: delegationId },
      data: { revokedAt: new Date() },
    });
    await transaction.auditLog.createMany({
      data: [
        {
          actorId,
          campusId: existing.campusId,
          action: "DELEGATION_REVOKED",
          entityType: "Delegation",
          entityId: delegationId,
          detail: { delegateId: userId },
        },
        {
          actorId,
          campusId: existing.campusId,
          action: "REPRESENTATIVE_DELEGATION_REVOKED",
          entityType: "User",
          entityId: userId,
          detail: { delegationId },
        },
      ],
    });
    return true;
  });
}
