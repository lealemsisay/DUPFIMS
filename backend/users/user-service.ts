import { hashPassword } from "../../src/lib/password";
import {
  changeUserRole,
  changeUserStatus,
  createUserRecord,
  getAssignableRole,
  getCampus,
  getOrganizationalUnit,
  getOrganizationalUnitByName,
  getUser,
  getUserAudit,
  getUserOptions,
  listUsers,
  resetUserPassword,
  updateUserRecord,
} from "./user-repository";
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
  systemAdministratorAssignableRoleNames,
  organizationalUnitRoleNames,
} from "./assignable-roles";

const assignableRoles = new Set<string>(systemAdministratorAssignableRoleNames);
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
) {
  const role = await getAssignableRole(roleId);
  if (!role || !assignableRoles.has(role.name)) {
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

async function getMutableUser(userId: string, actorId: string) {
  const user = await getUser(userId);
  if (!user) throw new UserManagementError("User account not found.", 404);
  if (
    user.id === actorId ||
    user.isProtectedAccount ||
    user.roles.some(({ role }) => role.name === "System Administrator")
  ) {
    throw new UserManagementError(
      "This account cannot be modified through user management.",
      403,
    );
  }
  return user;
}

export async function getManagementOptions() {
  const [roles, campuses, organizationalUnits] = await getUserOptions();
  return {
    roles: roles.map((role) => ({
      ...role,
      assignable: assignableRoles.has(role.name),
    })),
    campuses,
    organizationalUnits,
  };
}

export async function searchUsers(input: ListUsersInput) {
  const { page, pageSize, ...filters } = input;
  const { users, total } = await listUsers(filters, page, pageSize);
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

export async function getUserDetails(userId: string) {
  const user = await getUser(userId);
  if (!user) throw new UserManagementError("User account not found.", 404);
  return user;
}

export async function createManagedUser(actorId: string, input: CreateUserInput) {
  const role = await validateAssignments(
    input.roleId,
    input.campusId,
    input.organizationalUnitId,
  );
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
  input: UpdateUserInput,
) {
  const user = await getMutableUser(userId, actorId);
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
  input: z.infer<typeof roleAssignmentSchema>,
) {
  const user = await getMutableUser(userId, actorId);
  const role = await getAssignableRole(input.roleId);
  if (!role || !assignableRoles.has(role.name)) {
    throw new UserManagementError("The selected role cannot be assigned.", 400);
  }
  const organizationalUnit = organizationalUnitRoles.has(role.name)
    ? await getOrganizationalUnitByName(role.name)
    : null;
  await validateAssignments(
    input.roleId,
    user.campuses[0]?.campus.id ?? null,
    organizationalUnit?.id ?? null,
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
  input: z.infer<typeof accountStatusSchema>,
) {
  await getMutableUser(userId, actorId);
  return changeUserStatus(actorId, userId, input.status);
}

export async function resetManagedUserPassword(
  actorId: string,
  userId: string,
  input: z.infer<typeof resetPasswordSchema>,
) {
  await getMutableUser(userId, actorId);
  return resetUserPassword(actorId, userId, await hashPassword(input.password));
}

export async function getManagedUserAudit(userId: string) {
  const user = await getUser(userId);
  if (!user) throw new UserManagementError("User account not found.", 404);
  return getUserAudit(userId);
}
