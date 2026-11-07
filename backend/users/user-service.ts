import { hashPassword } from "../../src/lib/password";
import {
  changeUserRole,
  changeUserStatus,
  createUserRecord,
  createUserDelegation,
  getAssignableRole,
  getCampus,
  getOrganizationalUnit,
  getOrganizationalUnitByName,
  getUser,
  getUserAudit,
  getUserOptions,
  listUserDelegations,
  listUsers,
  resetUserPassword,
  updateUserRecord,
  revokeUserDelegation,
} from "./user-repository";
import type { delegationSchema } from "./delegation-validation";
import type {
  accountStatusSchema,
  createUserSchema,
  roleAssignmentSchema,
  updateUserSchema,
  userListQuerySchema,
  resetPasswordSchema,
} from "./user-validation";
import type { z } from "zod";
import {
  managedRoleNamesFor,
  type UserManagerRole,
  organizationalUnitRoleNames,
} from "./assignable-roles";

const organizationalUnitRoles = new Set<string>(organizationalUnitRoleNames);

export class UserManagementError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "UserManagementError";
  }
}

type CreateUserInput = z.infer<typeof createUserSchema>;
type UpdateUserInput = z.infer<typeof updateUserSchema>;
type ListUsersInput = z.infer<typeof userListQuerySchema>;

async function validateAssignments(
  roleId: string,
  campusId: string | null,
  organizationalUnitId: string | null,
  actorRole: UserManagerRole,
  allowPresidentRole = false,
) {
  const role = await getAssignableRole(roleId);
  const allowedRoleNames = new Set<string>(managedRoleNamesFor(actorRole));
  if (
    !role ||
    !allowedRoleNames.has(role.name) ||
    (role.name === "Peace Forum President" && !allowPresidentRole)
  ) {
    throw new UserManagementError("The selected role cannot be assigned.", 400);
  }

  const requiresUnit = organizationalUnitRoles.has(role.name);
  if (requiresUnit !== Boolean(organizationalUnitId)) {
    throw new UserManagementError(
      requiresUnit
        ? "Select the organizational unit that matches the assigned role."
        : "This role cannot be assigned to an organizational unit.",
      400,
    );
  }
  if (organizationalUnitId) {
    const unit = await getOrganizationalUnit(organizationalUnitId);
    if (!unit || unit.name !== role.name) {
      throw new UserManagementError(
        "The organizational unit does not match the selected role.",
        400,
      );
    }
  }

  if (requiresUnit && !campusId) {
    throw new UserManagementError(
      "A campus is required for organizational unit accounts.",
      400,
    );
  }
  if (campusId && !(await getCampus(campusId))) {
    throw new UserManagementError(
      "The selected campus does not exist or is inactive.",
      400,
    );
  }
  return role;
}

async function getMutableUser(
  userId: string,
  actorId: string,
  actorRole: UserManagerRole,
) {
  const user = await getUser(userId);
  if (!user) throw new UserManagementError("User account not found.", 404);
  const managedRoleNames = new Set<string>(managedRoleNamesFor(actorRole));
  if (
    user.id === actorId ||
    user.isProtectedAccount ||
    user.roles.some(
      ({ role }) =>
        role.name === "System Administrator" ||
        !managedRoleNames.has(role.name),
    )
  ) {
    throw new UserManagementError(
      "This account cannot be modified through user management.",
      403,
    );
  }
  return user;
}

async function getVisibleManagedUser(
  userId: string,
  actorRole: UserManagerRole,
) {
  const user = await getUser(userId);
  const managedRoleNames = new Set<string>(managedRoleNamesFor(actorRole));
  if (
    !user ||
    !user.roles.some(({ role }) => managedRoleNames.has(role.name))
  ) {
    throw new UserManagementError("User account not found.", 404);
  }
  return user;
}

export async function getManagementOptions(actorRole: UserManagerRole) {
  const [roles, campuses, organizationalUnits] = await getUserOptions();
  const managedRoleNames = new Set<string>(managedRoleNamesFor(actorRole));
  return {
    roles: roles.map((role) => ({
      ...role,
      createAllowed: managedRoleNames.has(role.name),
      changeAllowed:
        managedRoleNames.has(role.name) &&
        role.name !== "Peace Forum President",
    })),
    campuses,
    organizationalUnits,
  };
}

export async function searchUsers(
  actorRole: UserManagerRole,
  input: ListUsersInput,
) {
  const { page, pageSize, ...filters } = input;
  const { users, total } = await listUsers(
    actorRole,
    filters,
    page,
    pageSize,
  );
  return {
    users,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function getUserDetails(
  userId: string,
  actorRole: UserManagerRole,
) {
  return getVisibleManagedUser(userId, actorRole);
}

export async function createManagedUser(
  actorId: string,
  actorRole: UserManagerRole,
  input: CreateUserInput,
) {
  const role = await validateAssignments(
    input.roleId,
    input.campusId,
    input.organizationalUnitId,
    actorRole,
    true,
  );
  if (role.name === "Peace Forum President") {
    if (actorRole !== "System Administrator") {
      throw new UserManagementError(
        "Only the System Administrator may provision the Peace Forum President account.",
        403,
      );
    }
  }
  return createUserRecord(actorId, {
    ...input,
    passwordHash: await hashPassword(input.password),
    roleId: role.id,
    roleName: role.name,
    mustChangePassword: true,
  });
}

export async function editManagedUser(
  actorId: string,
  userId: string,
  actorRole: UserManagerRole,
  input: UpdateUserInput,
) {
  const user = await getMutableUser(userId, actorId, actorRole);
  const roleName = user.roles[0]?.role.name;
  if (!roleName) {
    throw new UserManagementError("The account has no assigned role.", 409);
  }
  const requiresUnit = organizationalUnitRoles.has(roleName);
  if (requiresUnit !== Boolean(input.organizationalUnitId)) {
    throw new UserManagementError(
      requiresUnit
        ? "This account requires its matching organizational unit."
        : "This account cannot be assigned to an organizational unit.",
      400,
    );
  }
  if (input.organizationalUnitId) {
    const unit = await getOrganizationalUnit(input.organizationalUnitId);
    if (!unit || unit.name !== roleName) {
      throw new UserManagementError(
        "The organizational unit does not match the account role.",
        400,
      );
    }
  }
  if (requiresUnit && !input.campusId) {
    throw new UserManagementError(
      "A campus is required for organizational unit accounts.",
      400,
    );
  }
  if (input.campusId && !(await getCampus(input.campusId))) {
    throw new UserManagementError(
      "The selected campus does not exist or is inactive.",
      400,
    );
  }
  return updateUserRecord(actorId, userId, input);
}

export async function reassignManagedUser(
  actorId: string,
  userId: string,
  actorRole: UserManagerRole,
  input: z.infer<typeof roleAssignmentSchema>,
) {
  const user = await getMutableUser(userId, actorId, actorRole);
  if (user.roles.some(({ role }) => role.name === "Peace Forum President")) {
    throw new UserManagementError(
      "The Peace Forum President role cannot be changed through account administration.",
      403,
    );
  }
  const role = await getAssignableRole(input.roleId);
  const managedRoleNames = new Set<string>(managedRoleNamesFor(actorRole));
  if (
    !role ||
    !managedRoleNames.has(role.name) ||
    role.name === "Peace Forum President"
  ) {
    throw new UserManagementError("The selected role cannot be assigned.", 400);
  }
  const organizationalUnit = organizationalUnitRoles.has(role.name)
    ? await getOrganizationalUnitByName(role.name)
    : null;
  await validateAssignments(
    input.roleId,
    user.campuses[0]?.campus.id ?? null,
    organizationalUnit?.id ?? null,
    actorRole,
  );
  return changeUserRole(
    actorId,
    userId,
    role.id,
    role.name,
    organizationalUnit?.id ?? null,
  );
}

export async function setManagedUserStatus(
  actorId: string,
  userId: string,
  actorRole: UserManagerRole,
  input: z.infer<typeof accountStatusSchema>,
) {
  await getMutableUser(userId, actorId, actorRole);
  return changeUserStatus(actorId, userId, input.status);
}

export async function resetManagedUserPassword(
  actorId: string,
  userId: string,
  actorRole: UserManagerRole,
  input: z.infer<typeof resetPasswordSchema>,
) {
  await getMutableUser(userId, actorId, actorRole);
  return resetUserPassword(actorId, userId, await hashPassword(input.password));
}

export async function getManagedUserAudit(
  userId: string,
  actorRole: UserManagerRole,
) {
  await getVisibleManagedUser(userId, actorRole);
  return getUserAudit(userId);
}

async function getRepresentativeAccount(
  userId: string,
  actorRole: UserManagerRole,
) {
  if (actorRole !== "Peace Forum President") {
    throw new UserManagementError(
      "Only the Peace Forum President may manage representative delegations.",
      403,
    );
  }
  const user = await getUser(userId);
  if (
    !user ||
    !user.roles.some(
      ({ role }) => role.name === "President's Representative",
    )
  ) {
    throw new UserManagementError(
      "The selected account is not a President's Representative.",
      400,
    );
  }
  return user;
}

export async function getRepresentativeDelegations(
  userId: string,
  actorRole: UserManagerRole,
) {
  await getRepresentativeAccount(userId, actorRole);
  return listUserDelegations(userId);
}

export async function grantRepresentativeDelegation(
  actorId: string,
  actorRole: UserManagerRole,
  userId: string,
  input: z.infer<typeof delegationSchema>,
) {
  await getRepresentativeAccount(userId, actorRole);
  if (!(await getCampus(input.campusId))) {
    throw new UserManagementError(
      "The selected campus does not exist or is inactive.",
      400,
    );
  }
  return createUserDelegation(
    actorId,
    userId,
    input.campusId,
    input.startsAt,
    input.endsAt,
  );
}

export async function revokeRepresentativeDelegation(
  actorId: string,
  actorRole: UserManagerRole,
  userId: string,
  delegationId: string,
) {
  await getRepresentativeAccount(userId, actorRole);
  const revoked = await revokeUserDelegation(actorId, userId, delegationId);
  if (!revoked) {
    throw new UserManagementError(
      "The active delegation was not found.",
      404,
    );
  }
}

export async function requireUserManagerRole(
  roles: Array<{ name: string; permissions: string[] }>,
): Promise<UserManagerRole> {
  const role = roles.find(
    ({ name, permissions }) =>
      (name === "System Administrator" ||
        name === "Peace Forum President") &&
      permissions.includes("users:manage"),
  );
  if (!role) {
    throw new UserManagementError(
      "You are not authorized to manage these user accounts.",
      403,
    );
  }
  return role.name as UserManagerRole;
}
