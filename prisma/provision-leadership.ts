import { Prisma, PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { resolve } from "node:path";
import { z } from "zod";
import { hashPassword } from "../src/lib/password";

config({ path: resolve(process.cwd(), ".env"), override: true });
config({ path: resolve(process.cwd(), "backend", ".env"), override: true });

const prisma = new PrismaClient();

const credentialSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  username: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(/^[A-Za-z0-9._-]+$/)
    .transform((value) => value.toLocaleLowerCase("en-US")),
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((value) => value.toLocaleLowerCase("en-US")),
  password: z
    .string()
    .min(6)
    .max(12)
    .refine((value) => Buffer.byteLength(value, "utf8") <= 72),
});

type LeadershipRoleName =
  | "Peace Forum President"
  | "Peace Forum Vice President"
  | "Secretary";
type LeadershipAccount = {
  roleName: LeadershipRoleName;
  credential: z.infer<typeof credentialSchema>;
};
const leadershipRoles: Array<{
  roleName: LeadershipRoleName;
  prefix: string;
  label: string;
}> = [
  {
    roleName: "Peace Forum President",
    prefix: "INITIAL_PEACE_FORUM_PRESIDENT",
    label: "President",
  },
  {
    roleName: "Peace Forum Vice President",
    prefix: "INITIAL_PEACE_FORUM_VICE_PRESIDENT",
    label: "Vice President",
  },
  { roleName: "Secretary", prefix: "INITIAL_PEACE_FORUM_SECRETARY", label: "Secretary" },
];

function readCredential(prefix: string, label: string) {
  const values = [
    process.env[`${prefix}_NAME`],
    process.env[`${prefix}_USERNAME`],
    process.env[`${prefix}_EMAIL`],
    process.env[`${prefix}_PASSWORD`],
  ];
  if (values.every((value) => !value?.trim())) return null;
  const parsed = credentialSchema.safeParse({
    fullName: process.env[`${prefix}_NAME`],
    username: process.env[`${prefix}_USERNAME`],
    email: process.env[`${prefix}_EMAIL`],
    password: process.env[`${prefix}_PASSWORD`],
  });
  if (!parsed.success) {
    throw new Error(
      `Set ${prefix}_NAME, ${prefix}_USERNAME, ${prefix}_EMAIL, and ${prefix}_PASSWORD in backend/.env with valid ${label} credentials.`,
    );
  }
  return parsed.data;
}

async function getRoleIncumbent(
  transaction: Prisma.TransactionClient,
  roleName: LeadershipRoleName,
) {
  return transaction.userRole.findFirst({
    where: { role: { name: roleName } },
    select: { user: { select: { id: true, username: true } } },
  });
}

async function createLeadershipAccount(
  transaction: Prisma.TransactionClient,
  actorId: string | null,
  account: LeadershipAccount,
): Promise<string> {
  const role = await transaction.role.findUnique({
    where: { name: account.roleName },
    select: { id: true },
  });
  if (!role) throw new Error(`The ${account.roleName} role has not been seeded.`);

  const incumbent = await transaction.userRole.findFirst({
    where: { roleId: role.id },
    select: { user: { select: { id: true, username: true } } },
  });
  if (incumbent) {
    if (incumbent.user.username === account.credential.username) {
      return incumbent.user.id;
    }
    throw new Error(
      `The ${account.roleName} role is already assigned. Use the documented President succession procedure if a replacement is required.`,
    );
  }

  const existing = await transaction.user.findFirst({
    where: {
      OR: [
        { username: account.credential.username },
        { email: account.credential.email },
      ],
    },
    select: { id: true },
  });
  if (existing) {
    throw new Error(
      `The configured ${account.roleName} username or email is already assigned to another account.`,
    );
  }

  const user = await transaction.user.create({
    data: {
      username: account.credential.username,
      email: account.credential.email,
      fullName: account.credential.fullName,
      passwordHash: await hashPassword(account.credential.password),
      status: "ACTIVE",
      mustChangePassword: true,
      roles: { create: { role: { connect: { id: role.id } } } },
    },
    select: { id: true },
  });
  await transaction.auditLog.create({
    data: {
      actorId,
      action: "INITIAL_LEADERSHIP_ACCOUNT_PROVISIONED",
      entityType: "User",
      entityId: user.id,
      detail: { username: account.credential.username, role: account.roleName },
    },
  });
  return user.id;
}

async function provisionPresidentSuccession(
  transaction: Prisma.TransactionClient,
  account: LeadershipAccount,
  previousUsername: string,
  reason: string,
): Promise<string> {
  const role = await transaction.role.findUnique({
    where: { name: "Peace Forum President" },
    select: { id: true },
  });
  if (!role) throw new Error("The Peace Forum President role has not been seeded.");
  const incumbent = await transaction.userRole.findFirst({
    where: {
      roleId: role.id,
      user: { username: previousUsername, status: "ACTIVE" },
    },
    select: { user: { select: { id: true, username: true } } },
  });
  if (!incumbent) {
    throw new Error(
      "The named active President was not found. No succession changes were made.",
    );
  }

  const existing = await transaction.user.findFirst({
    where: {
      OR: [
        { username: account.credential.username },
        { email: account.credential.email },
      ],
    },
    select: { id: true },
  });
  if (existing) {
    throw new Error(
      "The successor username or email is already assigned. No succession changes were made.",
    );
  }

  const user = await transaction.user.create({
    data: {
      username: account.credential.username,
      email: account.credential.email,
      fullName: account.credential.fullName,
      passwordHash: await hashPassword(account.credential.password),
      status: "ACTIVE",
      mustChangePassword: true,
      roles: { create: { role: { connect: { id: role.id } } } },
    },
    select: { id: true },
  });
  await transaction.userRole.delete({
    where: {
      userId_roleId: {
        userId: incumbent.user.id,
        roleId: role.id,
      },
    },
  });
  await transaction.user.update({
    where: { id: incumbent.user.id },
    data: {
      status: "INACTIVE",
      sessions: { deleteMany: {} },
    },
  });
  await transaction.auditLog.createMany({
    data: [
      {
        actorId: incumbent.user.id,
        action: "PEACE_FORUM_PRESIDENT_SUCCESSION",
        entityType: "User",
        entityId: incumbent.user.id,
        detail: {
          successorUserId: user.id,
          successorUsername: account.credential.username,
          reason,
        },
      },
      {
        actorId: incumbent.user.id,
        action: "PEACE_FORUM_PRESIDENT_SUCCESSION",
        entityType: "User",
        entityId: user.id,
        detail: {
          predecessorUserId: incumbent.user.id,
          predecessorUsername: incumbent.user.username,
          reason,
        },
      },
    ],
  });
  return user.id;
}

async function main() {
  const accounts = leadershipRoles.map(({ roleName, prefix, label }) => ({
    roleName,
    credential: readCredential(prefix, label),
  }));

  const predecessorUsername =
    process.env.PEACE_FORUM_PRESIDENT_SUCCESSION_FROM?.trim().toLocaleLowerCase(
      "en-US",
    );
  const successionReason = process.env.PEACE_FORUM_PRESIDENT_SUCCESSION_REASON?.trim();
  let presidentId: string | null = null;
  if (predecessorUsername || successionReason) {
    if (!predecessorUsername || !successionReason || successionReason.length < 8) {
      throw new Error(
        "For a President succession, set both PEACE_FORUM_PRESIDENT_SUCCESSION_FROM and PEACE_FORUM_PRESIDENT_SUCCESSION_REASON (at least 8 characters).",
      );
    }
  }

  await prisma.$transaction(
    async (transaction) => {
      const president = accounts[0];
      if (predecessorUsername && successionReason) {
        if (!president.credential) {
          throw new Error(
            "Set initial Peace Forum President credentials to provision a successor.",
          );
        }
        presidentId = await provisionPresidentSuccession(
          transaction,
          {
            roleName: president.roleName,
            credential: president.credential,
          },
          predecessorUsername,
          successionReason,
        );
      } else {
        const incumbent = await getRoleIncumbent(
          transaction,
          "Peace Forum President",
        );
        if (incumbent) {
          presidentId = incumbent.user.id;
          if (
            president.credential &&
            president.credential.username !== incumbent.user.username
          ) {
            throw new Error(
              "The Peace Forum President role is already assigned to a different username. Use the documented succession procedure for replacement.",
            );
          }
        } else if (president.credential) {
          presidentId = await createLeadershipAccount(
            transaction,
            null,
            {
              roleName: president.roleName,
              credential: president.credential,
            },
          );
        } else {
          throw new Error(
            "Set initial Peace Forum President credentials, or provision the account before the Vice President and Secretary.",
          );
        }
      }
      for (const account of accounts.slice(1)) {
        const incumbent = await getRoleIncumbent(
          transaction,
          account.roleName,
        );
        if (incumbent) {
          if (
            account.credential &&
            account.credential.username !== incumbent.user.username
          ) {
            throw new Error(
              `The ${account.roleName} role is assigned to a different username; existing credentials were not changed.`,
            );
          }
          continue;
        }
        if (!account.credential) {
          throw new Error(
            `Set ${leadershipRoles.find(({ roleName }) => roleName === account.roleName)?.prefix} credentials to provision the missing ${account.roleName} account.`,
          );
        }
        await createLeadershipAccount(transaction, presidentId, {
          roleName: account.roleName,
          credential: account.credential,
        });
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

main()
  .catch((error: unknown) => {
    console.error("Leadership account provisioning failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
