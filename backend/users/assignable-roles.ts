export const systemAdministratorManagedRoleNames = [
  "Peace Forum President",
  "Peace Forum Vice President",
  "Secretary",
  "University President",
  "University Vice President 1",
  "University Vice President 2",
  "University Vice President 3",
  "University Vice President 4",
  "University Vice President 5",
  "President's Office Staff",
] as const;

export const peaceForumPresidentManagedRoleNames = [
  "President's Representative",
  "Peace Values Education",
  "Women Affairs",
  "Media and Communication",
  "Rapid Response and Early Warning",
  "Command Post",
  "Campus Police",
] as const;

export const organizationalUnitRoleNames = [
  "Peace Values Education",
  "Women Affairs",
  "Media and Communication",
  "Rapid Response and Early Warning",
  "Command Post",
  "Campus Police",
] as const;

export const exclusiveRoleNames = [
  "Peace Forum President",
  "Peace Forum Vice President",
  "Secretary",
  "President's Representative",
  "University President",
  "University Vice President 1",
  "University Vice President 2",
  "University Vice President 3",
  "University Vice President 4",
  "University Vice President 5",
] as const;

export const peaceForumAccountRoleNames = [
  "Peace Forum President",
  "Peace Forum Vice President",
  "Secretary",
  "President's Representative",
  ...organizationalUnitRoleNames,
] as const;

export const allAccountRoleNames = [
  ...peaceForumAccountRoleNames,
  "University President",
  "University Vice President 1",
  "University Vice President 2",
  "University Vice President 3",
  "University Vice President 4",
  "University Vice President 5",
  "President's Office Staff",
  "System Administrator",
] as const;

export type UserManagerRole = "System Administrator" | "Peace Forum President";
export type UserDirectoryRole =
  | UserManagerRole
  | "Peace Forum Vice President"
  | "Secretary";

export function managedRoleNamesFor(actorRole: UserManagerRole) {
  return actorRole === "System Administrator"
    ? systemAdministratorManagedRoleNames
    : peaceForumPresidentManagedRoleNames;
}

export function visibleRoleNamesFor(actorRole: UserDirectoryRole) {
  if (actorRole === "System Administrator") return allAccountRoleNames;
  return peaceForumAccountRoleNames;
}
