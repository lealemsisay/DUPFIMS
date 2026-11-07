import { hashPassword } from "../../src/lib/password";
import { prisma } from "../prisma";
import {
  createAccountRequest,
  decideAccountRequest,
  getAccountRequest,
  listAccountRequests,
  updateReturnedAccountRequest,
  type AccountRequestInput,
} from "./account-request-repository";
import {
  accountRequestInputSchema,
  type accountRequestDecisionSchema,
  type accountRequestListSchema,
} from "./account-request-validation";
import { organizationalUnitRoleNames } from "./assignable-roles";
import type { z } from "zod";

type AccountRequestRole =
  | "Peace Forum President"
  | "Peace Forum Vice President"
  | "Secretary";

type RequestActorRole = {
  name: string;
  permissions: string[];
};

export class AccountRequestServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AccountRequestServiceError";
  }
}

export function getAccountRequestActor(roles: RequestActorRole[]) {
  const creatorRole = roles.find(
    ({ name, permissions }) =>
      ["Peace Forum President", "Peace Forum Vice President", "Secretary"].includes(
        name,
      ) && permissions.includes("users:request"),
  );
  const approverRole = roles.find(
    ({ name, permissions }) =>
      name === "Peace Forum President" && permissions.includes("users:approve"),
  );
  if (!creatorRole && !approverRole) {
    throw new AccountRequestServiceError(
      "You are not authorized to submit or review account requests.",
      403,
    );
  }
  return {
    role: (approverRole?.name ?? creatorRole?.name) as AccountRequestRole,
    canApprove: Boolean(approverRole),
    canRequest: Boolean(creatorRole),
  };
}

function assertCanSubmit(role: AccountRequestRole) {
  if (!["Peace Forum President", "Peace Forum Vice President", "Secretary"].includes(role)) {
    throw new AccountRequestServiceError(
      "Only the Peace Forum President, Vice President, or Secretary can submit account requests.",
      403,
    );
  }
}

async function validateInput(input: AccountRequestInput) {
  const role = await prisma.role.findUnique({
    where: { id: input.roleId },
    select: { id: true, name: true },
  });
  if (!role || role.name === "System Administrator") {
    throw new AccountRequestServiceError(
      "The selected role cannot be requested.",
      400,
    );
  }

  const requiresUnit = (organizationalUnitRoleNames as readonly string[]).includes(
    role.name,
  );
  if (requiresUnit !== Boolean(input.organizationalUnitId)) {
    throw new AccountRequestServiceError(
      requiresUnit
        ? "Select the organizational unit that matches the requested role."
        : "This role cannot be assigned to an organizational unit.",
      400,
    );
  }
  if (input.organizationalUnitId) {
    const unit = await prisma.organizationalUnit.findUnique({
      where: { id: input.organizationalUnitId },
      select: { name: true },
    });
    if (!unit || unit.name !== role.name) {
      throw new AccountRequestServiceError(
        "The organizational unit does not match the requested role.",
        400,
      );
    }
  }
  if (requiresUnit && !input.campusId) {
    throw new AccountRequestServiceError(
      "A campus is required for organizational unit account requests.",
      400,
    );
  }
  if (
    input.campusId &&
    !(await prisma.campus.findFirst({
      where: { id: input.campusId, isActive: true },
      select: { id: true },
    }))
  ) {
    throw new AccountRequestServiceError(
      "The selected campus does not exist or is inactive.",
      400,
    );
  }
}

async function toRepositoryInput(
  input: z.infer<typeof accountRequestInputSchema>,
) {
  const { password, ...details } = input;
  await validateInput(input);
  return {
    ...details,
    passwordHash: await hashPassword(password),
  };
}

export async function getRequestFormOptions() {
  const [roles, campuses, organizationalUnits] = await prisma.$transaction([
    prisma.role.findMany({
      where: { name: { not: "System Administrator" } },
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
  return { roles, campuses, organizationalUnits };
}

export async function submitAccountRequest(
  requesterId: string,
  role: AccountRequestRole,
  input: z.infer<typeof accountRequestInputSchema>,
) {
  assertCanSubmit(role);
  const normalized = await toRepositoryInput(input);
  return createAccountRequest(requesterId, normalized);
}

export async function listRequestsForActor(
  actorId: string,
  canApprove: boolean,
  input: z.infer<typeof accountRequestListSchema>,
) {
  return listAccountRequests({
    ...(canApprove ? {} : { requesterId: actorId }),
    ...(input.status ? { status: input.status } : {}),
  });
}

export async function getRequestForActor(
  requestId: string,
  actorId: string,
  canApprove: boolean,
) {
  const request = await getAccountRequest(requestId);
  if (!request || (!canApprove && request.requester.id !== actorId)) {
    throw new AccountRequestServiceError("Account request not found.", 404);
  }
  return request;
}

export async function decideRequest(
  requestId: string,
  actorId: string,
  canApprove: boolean,
  input: z.infer<typeof accountRequestDecisionSchema>,
) {
  if (!canApprove) {
    throw new AccountRequestServiceError(
      "Only the Peace Forum President can decide account requests.",
      403,
    );
  }
  return decideAccountRequest(requestId, actorId, input.decision, input.reason);
}

export async function resubmitAccountRequest(
  requestId: string,
  requesterId: string,
  role: AccountRequestRole,
  input: z.infer<typeof accountRequestInputSchema>,
) {
  assertCanSubmit(role);
  const normalized = await toRepositoryInput(input);
  return updateReturnedAccountRequest(requestId, requesterId, normalized);
}
