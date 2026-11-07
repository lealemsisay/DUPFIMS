import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import {
  exclusiveRoleNames,
  organizationalUnitRoleNames,
} from "./assignable-roles";

const requestSelect = {
  id: true,
  username: true,
  email: true,
  fullName: true,
  phoneNumber: true,
  role: { select: { id: true, name: true } },
  campus: { select: { id: true, name: true, code: true } },
  organizationalUnit: { select: { id: true, name: true } },
  status: true,
  decisionReason: true,
  createdAt: true,
  updatedAt: true,
  decidedAt: true,
  requester: {
    select: { id: true, username: true, fullName: true, email: true },
  },
  approvedUser: {
    select: { id: true, username: true, status: true },
  },
  decisions: {
    select: {
      id: true,
      action: true,
      reason: true,
      createdAt: true,
      actor: { select: { id: true, username: true, fullName: true } },
    },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.UserAccountRequestSelect;

export type AccountRequestInput = {
  username: string;
  email: string;
  fullName: string;
  phoneNumber: string | null;
  password: string;
  roleId: string;
  campusId: string | null;
  organizationalUnitId: string | null;
};

export class AccountRequestRepositoryError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AccountRequestRepositoryError";
  }
}

function assertNoDuplicateAccount(
  existingUser: { id: string } | null,
  existingRequest: { id: string } | null,
) {
  if (existingUser || existingRequest) {
    throw new AccountRequestRepositoryError(
      "That username or email address is already in use or pending approval.",
      409,
    );
  }
}

async function findActivePresident(transaction: Prisma.TransactionClient) {
  return transaction.user.findFirst({
    where: {
      status: "ACTIVE",
      roles: { some: { role: { name: "Peace Forum President" } } },
    },
    select: { id: true },
  });
}

export async function createAccountRequest(
  requesterId: string,
  input: Omit<AccountRequestInput, "password"> & {
    passwordHash: string;
  },
) {
  return prisma.$transaction(
    async (transaction) => {
      const [existingUser, existingRequest, president] = await Promise.all([
        transaction.user.findFirst({
          where: {
            OR: [{ username: input.username }, { email: input.email }],
          },
          select: { id: true },
        }),
        transaction.userAccountRequest.findFirst({
          where: {
            status: "PENDING_APPROVAL",
            OR: [{ username: input.username }, { email: input.email }],
          },
          select: { id: true },
        }),
        findActivePresident(transaction),
      ]);
      assertNoDuplicateAccount(existingUser, existingRequest);
      if (!president) {
        throw new AccountRequestRepositoryError(
          "Account requests cannot be submitted until an active Peace Forum President is provisioned.",
          409,
        );
      }

      const request = await transaction.userAccountRequest.create({
        data: {
          requesterId,
          username: input.username,
          email: input.email,
          fullName: input.fullName,
          phoneNumber: input.phoneNumber,
          passwordHash: input.passwordHash,
          roleId: input.roleId,
          campusId: input.campusId,
          organizationalUnitId: input.organizationalUnitId,
          decisions: {
            create: {
              actorId: requesterId,
              action: "SUBMITTED",
              reason: "Submitted for Peace Forum President approval.",
            },
          },
        },
        select: requestSelect,
      });

      await transaction.notification.create({
        data: {
          recipientId: president.id,
          title: "Account request awaiting approval",
          message: `${request.fullName} requested an account as ${request.role.name}.`,
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: requesterId,
          action: "ACCOUNT_REQUEST_SUBMITTED",
          entityType: "UserAccountRequest",
          entityId: request.id,
          detail: {
            username: request.username,
            role: request.role.name,
            campus: request.campus?.code ?? null,
          },
        },
      });
      return request;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function listAccountRequests(input: {
  requesterId?: string;
  status?: "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "RETURNED_FOR_CORRECTION";
}) {
  return prisma.userAccountRequest.findMany({
    where: {
      ...(input.requesterId ? { requesterId: input.requesterId } : {}),
      ...(input.status ? { status: input.status } : {}),
    },
    select: requestSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 200,
  });
}

export function getAccountRequest(requestId: string) {
  return prisma.userAccountRequest.findUnique({
    where: { id: requestId },
    select: requestSelect,
  });
}

export async function updateReturnedAccountRequest(
  requestId: string,
  requesterId: string,
  input: Omit<AccountRequestInput, "password"> & {
    passwordHash: string;
  },
) {
  return prisma.$transaction(
    async (transaction) => {
      const request = await transaction.userAccountRequest.findUnique({
        where: { id: requestId },
        select: { id: true, requesterId: true, status: true },
      });
      if (!request || request.requesterId !== requesterId) {
        throw new AccountRequestRepositoryError("Account request not found.", 404);
      }
      if (request.status !== "RETURNED_FOR_CORRECTION") {
        throw new AccountRequestRepositoryError(
          "Only a request returned for correction can be edited.",
          409,
        );
      }

      const [existingUser, existingRequest] = await Promise.all([
        transaction.user.findFirst({
          where: {
            OR: [{ username: input.username }, { email: input.email }],
          },
          select: { id: true },
        }),
        transaction.userAccountRequest.findFirst({
          where: {
            id: { not: requestId },
            status: "PENDING_APPROVAL",
            OR: [{ username: input.username }, { email: input.email }],
          },
          select: { id: true },
        }),
      ]);
      assertNoDuplicateAccount(existingUser, existingRequest);

      const updated = await transaction.userAccountRequest.update({
        where: { id: requestId },
        data: {
          username: input.username,
          email: input.email,
          fullName: input.fullName,
          phoneNumber: input.phoneNumber,
          passwordHash: input.passwordHash,
          roleId: input.roleId,
          campusId: input.campusId,
          organizationalUnitId: input.organizationalUnitId,
          status: "PENDING_APPROVAL",
          decisionReason: null,
          decidedAt: null,
          decisions: {
            create: {
              actorId: requesterId,
              action: "RESUBMITTED",
              reason: "Updated and resubmitted for approval.",
            },
          },
        },
        select: requestSelect,
      });
      const president = await findActivePresident(transaction);
      if (!president) {
        throw new AccountRequestRepositoryError(
          "No active Peace Forum President is available to receive this request.",
          409,
        );
      }
      await transaction.notification.create({
        data: {
          recipientId: president.id,
          title: "Updated account request awaiting approval",
          message: `${updated.fullName} resubmitted an account request as ${updated.role.name}.`,
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: requesterId,
          action: "ACCOUNT_REQUEST_RESUBMITTED",
          entityType: "UserAccountRequest",
          entityId: requestId,
          detail: { username: updated.username, role: updated.role.name },
        },
      });
      return updated;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function decideAccountRequest(
  requestId: string,
  presidentId: string,
  decision: "APPROVED" | "REJECTED" | "RETURNED_FOR_CORRECTION",
  reason: string,
) {
  return prisma.$transaction(
    async (transaction) => {
      const request = await transaction.userAccountRequest.findUnique({
        where: { id: requestId },
        select: {
          id: true,
          requesterId: true,
          username: true,
          email: true,
          fullName: true,
          phoneNumber: true,
          passwordHash: true,
          roleId: true,
          campusId: true,
          organizationalUnitId: true,
          status: true,
          role: { select: { name: true } },
          campus: { select: { code: true } },
        },
      });
      if (!request) {
        throw new AccountRequestRepositoryError("Account request not found.", 404);
      }
      if (request.requesterId === presidentId) {
        throw new AccountRequestRepositoryError(
          "You cannot decide your own account request.",
          403,
        );
      }
      if (request.status !== "PENDING_APPROVAL") {
        throw new AccountRequestRepositoryError(
          "This account request is no longer pending approval.",
          409,
        );
      }

      let approvedUserId: string | null = null;
      if (decision === "APPROVED") {
        const roleRequiresUnit = (
          organizationalUnitRoleNames as readonly string[]
        ).includes(request.role.name);
        const [campus, organizationalUnit] = await Promise.all([
          request.campusId
            ? transaction.campus.findFirst({
                where: { id: request.campusId, isActive: true },
                select: { id: true },
              })
            : null,
          request.organizationalUnitId
            ? transaction.organizationalUnit.findUnique({
                where: { id: request.organizationalUnitId },
                select: { name: true },
              })
            : null,
        ]);
        if (
          (Boolean(request.campusId) && !campus) ||
          (roleRequiresUnit && !request.campusId) ||
          (roleRequiresUnit !== Boolean(request.organizationalUnitId)) ||
          request.role.name === "System Administrator" ||
          (request.organizationalUnitId &&
            organizationalUnit?.name !== request.role.name)
        ) {
          throw new AccountRequestRepositoryError(
            "The requested role or campus assignment is no longer valid. Return the request for correction.",
            409,
          );
        }
        if (!request.passwordHash) {
          throw new AccountRequestRepositoryError(
            "The request no longer has a usable initial password. Return it for correction.",
            409,
          );
        }
        const [existingUser, existingRequest, roleAssignmentCount] =
          await Promise.all([
            transaction.user.findFirst({
              where: {
                OR: [{ username: request.username }, { email: request.email }],
              },
              select: { id: true },
            }),
            transaction.userAccountRequest.findFirst({
              where: {
                id: { not: requestId },
                status: "PENDING_APPROVAL",
                OR: [{ username: request.username }, { email: request.email }],
              },
              select: { id: true },
            }),
            transaction.userRole.count({
              where: { roleId: request.roleId },
            }),
          ]);
        assertNoDuplicateAccount(existingUser, existingRequest);
        const roleIsExclusive = (
          exclusiveRoleNames as readonly string[]
        ).includes(request.role.name);
        if (roleIsExclusive && roleAssignmentCount > 0) {
          throw new AccountRequestRepositoryError(
            `The ${request.role.name} role is already assigned to an account.`,
            409,
          );
        }

        const user = await transaction.user.create({
          data: {
            username: request.username,
            email: request.email,
            fullName: request.fullName,
            phoneNumber: request.phoneNumber,
            passwordHash: request.passwordHash,
            status: "ACTIVE",
            mustChangePassword: true,
            roles: {
              create: { role: { connect: { id: request.roleId } } },
            },
            ...(request.campusId
              ? {
                  campuses: {
                    create: {
                      campus: { connect: { id: request.campusId } },
                      isPrimary: true,
                    },
                  },
                }
              : {}),
            ...(request.organizationalUnitId
              ? {
                  organizationalUnits: {
                    create: {
                      organizationalUnit: {
                        connect: { id: request.organizationalUnitId },
                      },
                    },
                  },
                }
              : {}),
          },
          select: { id: true },
        });
        approvedUserId = user.id;
        await transaction.auditLog.create({
          data: {
            actorId: presidentId,
            action: "USER_CREATED_FROM_APPROVED_REQUEST",
            entityType: "User",
            entityId: user.id,
            detail: {
              username: request.username,
              role: request.role.name,
              requestId,
            },
          },
        });
      }

      const updatedRequest = await transaction.userAccountRequest.update({
        where: { id: requestId },
        data: {
          status: decision,
          decisionReason: reason,
          decidedAt: new Date(),
          ...(decision === "APPROVED" || decision === "REJECTED"
            ? { passwordHash: null }
            : {}),
          ...(approvedUserId
            ? { approvedUser: { connect: { id: approvedUserId } } }
            : {}),
          decisions: {
            create: {
              actorId: presidentId,
              action: decision,
              reason,
            },
          },
        },
        select: requestSelect,
      });
      const notificationTitle = {
        APPROVED: "Account request approved",
        REJECTED: "Account request rejected",
        RETURNED_FOR_CORRECTION: "Account request returned for correction",
      }[decision];
      await transaction.notification.create({
        data: {
          recipientId: request.requesterId,
          title: notificationTitle,
          message:
            decision === "APPROVED"
              ? `The request for ${request.fullName} (${request.username}) was approved. The account is active and requires a password change at first login.`
              : `The request for ${request.fullName} (${request.username}) was ${decision === "REJECTED" ? "rejected" : "returned for correction"}: ${reason}`,
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: presidentId,
          action: `ACCOUNT_REQUEST_${decision}`,
          entityType: "UserAccountRequest",
          entityId: requestId,
          detail: {
            username: request.username,
            role: request.role.name,
            campus: request.campus?.code ?? null,
            reason,
            approvedUserId,
          },
        },
      });
      return updatedRequest;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
