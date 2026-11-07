import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { resolve } from "node:path";
import { z } from "zod";
import { hashPassword } from "../src/lib/password";

config({ path: resolve(process.cwd(), ".env"), override: true });
config({ path: resolve(process.cwd(), "backend", ".env"), override: true });

const prisma = new PrismaClient();

const initialAdminSchema = z.object({
  name: z.string().trim().min(1).max(160),
  username: z.string().trim().min(3).max(64),
  email: z.union([z.literal(""), z.string().trim().email().max(254)]),
  password: z
    .string()
    .min(6)
    .max(12)
    .refine((value) => Buffer.byteLength(value, "utf8") <= 72),
});

const permissionDefinitions = [
  ["dashboard:read", "View the Peace Forum dashboard."],
  ["student:read", "View student records in authorized campuses."],
  ["student:manage", "Create and update student records."],
  ["case:read", "View disciplinary case records in authorized campuses."],
  ["case:manage", "Create and manage disciplinary cases."],
  ["information:read", "View information submissions."],
  ["information:submit", "Submit information for review."],
  ["information:manage", "Review and manage information submissions."],
  ["notifications:read", "View personal notifications."],
  ["messages:read", "View messages addressed to the user."],
  ["reports:read", "View reports for authorized campuses."],
  ["users:manage", "Manage user accounts and role assignments."],
  ["campuses:manage", "Manage campus records and assignments."],
  ["settings:manage", "Manage university-wide system settings."],
  ["delegations:manage", "Create and revoke time-limited campus delegations."],
  ["audit:read", "View audit records within authorized scope."],
] as const;

const roleDefinitions = [
  {
    name: "Peace Forum President",
    description: "Oversees Peace Forum operations across all campuses.",
    isGlobal: true,
    permissions: [
      "dashboard:read",
      "users:manage",
      "student:read",
      "case:read",
      "case:manage",
      "information:read",
      "information:submit",
      "information:manage",
      "notifications:read",
      "messages:read",
      "reports:read",
      "delegations:manage",
      "audit:read",
    ],
  },
  {
    name: "Peace Forum Vice President",
    description: "Supports Peace Forum leadership.",
    permissions: ["dashboard:read", "information:read", "notifications:read", "messages:read"],
  },
  {
    name: "Secretary",
    description: "Coordinates Peace Forum records and communications.",
    permissions: [
      "dashboard:read",
      "information:read",
      "information:submit",
      "notifications:read",
      "messages:read",
    ],
  },
  {
    name: "President's Representative",
    description: "Acts on behalf of the President only under active delegation.",
    permissions: [
      "dashboard:read",
      "student:read",
      "case:read",
      "information:read",
      "notifications:read",
      "messages:read",
    ],
  },
  {
    name: "Peace Values Education",
    description: "Supports peace values education activities.",
    permissions: ["dashboard:read", "information:submit", "notifications:read"],
  },
  {
    name: "Women Affairs",
    description: "Supports women affairs activities.",
    permissions: ["dashboard:read", "information:submit", "notifications:read"],
  },
  {
    name: "Media and Communication",
    description: "Coordinates Peace Forum media and communications.",
    permissions: ["dashboard:read", "information:submit", "notifications:read", "messages:read"],
  },
  {
    name: "Rapid Response and Early Warning",
    description: "Coordinates early warning information and rapid response.",
    permissions: [
      "dashboard:read",
      "information:read",
      "information:submit",
      "information:manage",
      "notifications:read",
    ],
  },
  {
    name: "Command Post",
    description: "Coordinates command post information flow.",
    permissions: [
      "dashboard:read",
      "information:read",
      "information:submit",
      "notifications:read",
    ],
  },
  {
    name: "Campus Police",
    description: "Supports campus safety operations.",
    permissions: [
      "dashboard:read",
      "information:read",
      "information:submit",
      "notifications:read",
    ],
  },
  {
    name: "University President",
    description: "University leadership account.",
    isGlobal: true,
    permissions: [
      "dashboard:read",
      "information:read",
      "notifications:read",
      "messages:read",
      "reports:read",
    ],
  },
  ...Array.from({ length: 5 }, (_, index) => ({
    name: `University Vice President ${index + 1}`,
    description: `University Vice President seat ${index + 1}; assign the official portfolio when provisioning the account.`,
    isGlobal: true,
    permissions: [
      "dashboard:read",
      "information:read",
      "notifications:read",
      "messages:read",
      "reports:read",
    ],
  })),
  {
    name: "President's Office Staff",
    description: "Supports the University President's office.",
    permissions: ["dashboard:read", "information:read", "notifications:read", "messages:read"],
  },
  {
    name: "System Administrator",
    description:
      "Manages technical configuration and user accounts, without case access by default.",
    permissions: [
      "dashboard:read",
      "users:manage",
      "campuses:manage",
    ],
  },
];

const organizationalUnitNames = [
  "Peace Values Education",
  "Women Affairs",
  "Media and Communication",
  "Rapid Response and Early Warning",
  "Command Post",
  "Campus Police",
];

async function main() {
  const initialAdmin = initialAdminSchema.safeParse({
    name: process.env.INITIAL_ADMIN_NAME,
    username: process.env.INITIAL_ADMIN_USERNAME,
    email: process.env.INITIAL_ADMIN_EMAIL?.trim().toLocaleLowerCase("en-US") ?? "",
    password: process.env.INITIAL_ADMIN_PASSWORD,
  });

  if (!initialAdmin.success) {
    throw new Error(
      "Set INITIAL_ADMIN_NAME, INITIAL_ADMIN_USERNAME, an optional INITIAL_ADMIN_EMAIL, and a 6-12-character INITIAL_ADMIN_PASSWORD in backend/.env.",
    );
  }

  const permissions = await Promise.all(
    permissionDefinitions.map(([key, description]) =>
      prisma.permission.upsert({
        where: { key },
        update: { description },
        create: { key, description },
      }),
    ),
  );
  const permissionIds = new Map(permissions.map(({ key, id }) => [key, id]));

  for (const definition of roleDefinitions) {
    const role = await prisma.role.upsert({
      where: { name: definition.name },
      update: {
        description: definition.description,
        isGlobal: definition.isGlobal ?? false,
      },
      create: {
        name: definition.name,
        description: definition.description,
        isGlobal: definition.isGlobal ?? false,
      },
    });

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    const rolePermissions = definition.permissions.map((key) => {
      const permissionId = permissionIds.get(key);
      if (!permissionId) {
        throw new Error(`Unknown permission "${key}" in role "${role.name}".`);
      }
      return { roleId: role.id, permissionId };
    });
    await prisma.rolePermission.createMany({
      data: rolePermissions,
    });
  }

  for (const name of organizationalUnitNames) {
    await prisma.organizationalUnit.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const systemAdministrator = await prisma.role.findUniqueOrThrow({
    where: { name: "System Administrator" },
  });
  const { name, username, email, password } = initialAdmin.data;
  const matchingUsers = await prisma.user.findMany({
    where: {
      OR: [{ username }, ...(email ? [{ email }] : [])],
    },
    select: { id: true, username: true, email: true },
  });

  let adminUserId: string;
  if (matchingUsers.length > 0) {
    const existing = matchingUsers[0];
    if (
      matchingUsers.length !== 1 ||
      existing.username !== username ||
      (email !== "" && existing.email !== email)
    ) {
      throw new Error(
        "The initial administrator username or email is already assigned to a different account.",
      );
    }
    adminUserId = existing.id;
    await prisma.user.update({
      where: { id: adminUserId },
      data: { isProtectedAccount: true },
    });
  } else {
    const adminUser = await prisma.user.create({
      data: {
        username,
        email: email || null,
        fullName: name,
        passwordHash: await hashPassword(password),
        status: "ACTIVE",
        mustChangePassword: true,
        isProtectedAccount: true,
      },
      select: { id: true },
    });
    adminUserId = adminUser.id;
  }

  await prisma.userRole.upsert({
    where: {
      userId_roleId: { userId: adminUserId, roleId: systemAdministrator.id },
    },
    update: {},
    create: { userId: adminUserId, roleId: systemAdministrator.id },
  });
}

main()
  .catch((error: unknown) => {
    console.error("Database role seeding failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
