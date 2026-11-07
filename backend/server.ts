import { createHash, randomBytes } from "node:crypto";
import { resolve } from "node:path";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { config } from "dotenv";
import { hashPassword, verifyPassword } from "../src/lib/password";
import { getDashboardMetrics } from "../src/lib/services/dashboard";
import { loginSchema, changePasswordSchema } from "../src/lib/validations/auth";
import { prisma } from "./prisma";
import { createUserRouter } from "./users/user-routes";
import { createCampusRouter } from "./campuses/campus-routes";

config({ path: resolve(process.cwd(), ".env"), override: true });
config({ path: resolve(process.cwd(), "backend", ".env") });

const app = express();
const port = Number(process.env.BACKEND_PORT ?? 4000);
const frontendOrigins = new Set(
  (process.env.FRONTEND_ORIGINS ??
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);
const sessionCookieName = "dupfims_session";
const sessionDurationMs = 8 * 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getCookie(request: Request, name: string) {
  const cookies = request.headers.cookie?.split(";") ?? [];
  for (const cookie of cookies) {
    const separator = cookie.indexOf("=");
    if (separator < 0 || cookie.slice(0, separator).trim() !== name) continue;
    return cookie.slice(separator + 1).trim();
  }
  return undefined;
}

function setSessionCookie(response: Response, token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader(
    "Set-Cookie",
    `${sessionCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionDurationMs / 1000}${secure}`,
  );
}

function clearSessionCookie(response: Response) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader(
    "Set-Cookie",
    `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
  );
}

function requireSameOrigin(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  if (!frontendOrigins.has(request.get("origin") ?? "")) {
    response.status(403).json({ error: "Forbidden." });
    return;
  }
  next();
}

async function requireSession(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const token = getCookie(request, sessionCookieName);
  if (!token) {
    response.status(401).json({ error: "Authentication is required." });
    return;
  }

  try {
    const session = await prisma.userSession.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            fullName: true,
            status: true,
            mustChangePassword: true,
            roles: {
              select: {
                role: {
                  select: {
                    name: true,
                    permissions: {
                      select: { permission: { select: { key: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!session || session.expiresAt <= new Date() || session.user.status !== "ACTIVE") {
      if (session) {
        await prisma.userSession.delete({ where: { id: session.id } });
      }
      clearSessionCookie(response);
      response.status(401).json({ error: "Authentication is required." });
      return;
    }

    request.sessionId = session.id;
    request.authenticatedUser = {
      id: session.user.id,
      username: session.user.username,
      email: session.user.email,
      fullName: session.user.fullName,
      mustChangePassword: session.user.mustChangePassword,
      roles: session.user.roles.map(({ role }) => ({
        name: role.name,
        permissions: role.permissions.map(({ permission }) => permission.key),
      })),
    };
    next();
  } catch (error) {
    next(error);
  }
}

function requirePasswordChanged(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  if (request.authenticatedUser?.mustChangePassword) {
    response.status(403).json({
      error: "Change your password to continue.",
      code: "PASSWORD_CHANGE_REQUIRED",
    });
    return;
  }
  next();
}

function requirePermission(permission: string) {
  return (request: Request, response: Response, next: NextFunction) => {
    const granted = request.authenticatedUser?.roles.some(({ permissions }) =>
      permissions.includes(permission),
    );
    if (!granted) {
      response.status(403).json({ error: "You are not authorized to access this resource." });
      return;
    }
    next();
  };
}

function moduleNotImplemented(moduleName: string) {
  return (_request: Request, response: Response) => {
    response.status(501).json({
      error: `${moduleName} records and workflows are not implemented yet.`,
    });
  };
}

app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.post(
  "/api/auth/login",
  requireSameOrigin,
  async (request, response, next) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Invalid login request." });
      return;
    }

    try {
      const identity = parsed.data.username.trim();
      const matches = await prisma.user.findMany({
        where: {
          OR: [
            { username: identity },
            { email: identity.toLocaleLowerCase("en-US") },
          ],
        },
        take: 2,
      });
      const user = matches.length === 1 ? matches[0] : null;
      if (
        !user ||
        user.status !== "ACTIVE" ||
        !(await verifyPassword(parsed.data.password, user.passwordHash))
      ) {
        response.status(401).json({
          error: "The username or password is incorrect.",
        });
        return;
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      const token = randomBytes(32).toString("base64url");
      await prisma.userSession.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + sessionDurationMs),
        },
      });
      setSessionCookie(response, token);
      response.setHeader("Cache-Control", "no-store");
      response.json({
        ok: true,
        redirectTo: user.mustChangePassword
          ? "/change-password"
          : "/dashboard",
      });
    } catch (error) {
      next(error);
    }
  },
);

app.post(
  "/api/auth/logout",
  requireSameOrigin,
  requireSession,
  async (request, response, next) => {
    try {
      if (request.sessionId) {
        await prisma.userSession.deleteMany({
          where: { id: request.sessionId },
        });
      }
      clearSessionCookie(response);
      response.setHeader("Cache-Control", "no-store");
      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  },
);

app.get("/api/auth/session", requireSession, (request, response) => {
  response.setHeader("Cache-Control", "private, no-store");
  response.json({
    user: {
      id: request.authenticatedUser?.id,
      username: request.authenticatedUser?.username,
      email: request.authenticatedUser?.email,
      name: request.authenticatedUser?.fullName,
      mustChangePassword: request.authenticatedUser?.mustChangePassword,
      roles: request.authenticatedUser?.roles.map(({ name }) => name) ?? [],
      permissions: [
        ...new Set(
          request.authenticatedUser?.roles.flatMap(
            ({ permissions }) => permissions,
          ) ?? [],
        ),
      ],
    },
  });
});

app.post(
  "/api/auth/change-password",
  requireSameOrigin,
  requireSession,
  async (request, response, next) => {
    const parsed = changePasswordSchema.safeParse(request.body);
    if (
      !parsed.success ||
      parsed.data.newPassword === parsed.data.currentPassword
    ) {
      response.status(400).json({
        error: "Enter a valid new password that differs from your current password.",
      });
      return;
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: request.authenticatedUser?.id },
        select: { passwordHash: true, status: true },
      });
      if (!user || user.status !== "ACTIVE") {
        clearSessionCookie(response);
        response.status(401).json({ error: "Authentication is required." });
        return;
      }

      if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
        response.status(401).json({
          error: "The current password is incorrect.",
        });
        return;
      }

      const updated = await prisma.user.updateMany({
        where: {
          id: request.authenticatedUser?.id,
          status: "ACTIVE",
          passwordHash: user.passwordHash,
        },
        data: {
          passwordHash: await hashPassword(parsed.data.newPassword),
          mustChangePassword: false,
        },
      });
      if (updated.count !== 1) {
        response.status(409).json({
          error: "Your account changed during this request. Please sign in again.",
        });
        return;
      }

      response.setHeader("Cache-Control", "no-store");
      response.json({ ok: true, redirectTo: "/dashboard" });
    } catch (error) {
      next(error);
    }
  },
);

app.use(
  "/api/users",
  createUserRouter({
    requireSession,
    requirePasswordChanged,
    requireSameOrigin,
  }),
);

app.use(
  "/api/campuses",
  createCampusRouter({
    requireSession,
    requirePasswordChanged,
    requireSameOrigin,
  }),
);

app.get(
  ["/api/students", "/api/students/:studentId"],
  requireSession,
  requirePasswordChanged,
  requirePermission("student:read"),
  moduleNotImplemented("Student management"),
);
app.use("/api/cases", requireSession, requirePasswordChanged);
app.get(
  ["/api/cases", "/api/cases/:caseId"],
  requirePermission("case:read"),
  moduleNotImplemented("Disciplinary case management"),
);
app.post(
  "/api/cases",
  requirePermission("case:manage"),
  moduleNotImplemented("Disciplinary case management"),
);
app.patch(
  "/api/cases/:caseId",
  requirePermission("case:manage"),
  moduleNotImplemented("Disciplinary case management"),
);
app.use("/api/information", requireSession, requirePasswordChanged);
app.get(
  ["/api/information", "/api/information/:submissionId"],
  requirePermission("information:read"),
  moduleNotImplemented("Information flow"),
);
app.post(
  "/api/information",
  requirePermission("information:submit"),
  moduleNotImplemented("Information flow"),
);
app.patch(
  "/api/information/:submissionId",
  requirePermission("information:manage"),
  moduleNotImplemented("Information flow"),
);

app.get(
  "/api/dashboard/metrics",
  requireSession,
  requirePasswordChanged,
  async (request, response, next) => {
    try {
      const metrics = await getDashboardMetrics(
        request.authenticatedUser!.id,
      );
      response.setHeader("Cache-Control", "private, no-store");
      response.json(metrics);
    } catch (error) {
      next(error);
    }
  },
);

app.get(
  "/api/system/health",
  requireSession,
  requirePasswordChanged,
  async (request, response, next) => {
    const isSystemAdministrator = request.authenticatedUser?.roles.some(
      ({ name }) => name === "System Administrator",
    );
    if (!isSystemAdministrator) {
      response.status(403).json({ error: "You are not authorized to view system health." });
      return;
    }
    try {
      await prisma.$queryRaw`SELECT 1`;
      response.setHeader("Cache-Control", "private, no-store");
      response.json({ status: "healthy", database: "connected" });
    } catch (error) {
      next(error);
    }
  },
);

app.use(
  (
    error: unknown,
    _request: Request,
    response: Response,
    _next: NextFunction,
  ) => {
    void _next;
    if (error instanceof SyntaxError) {
      response.status(400).json({ error: "Invalid JSON request body." });
      return;
    }
    console.error(
      "Backend API request failed.",
      error instanceof Error ? error.name : "Unknown error",
    );
    if (response.headersSent) return;
    response.status(500).json({ error: "The server could not complete the request." });
  },
);

const server = app.listen(port, "127.0.0.1", () => {
  console.log(`DUPFIMS backend API listening on http://127.0.0.1:${port}`);
});

async function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
