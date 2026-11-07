import {
  Router,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import {
  getActorId,
  invalidRequest,
  sendUserError,
} from "./user-controller";
import {
  UserManagementError,
  createManagedUser,
  editManagedUser,
  getManagedUserAudit,
  getManagementOptions,
  getUserDetails,
  getRepresentativeDelegations,
  grantRepresentativeDelegation,
  reassignManagedUser,
  resetManagedUserPassword,
  requireUserManagerRole,
  revokeRepresentativeDelegation,
  searchUsers,
  setManagedUserStatus,
} from "./user-service";
import {
  accountStatusSchema,
  createUserSchema,
  resetPasswordSchema,
  roleAssignmentSchema,
  updateUserSchema,
  userListQuerySchema,
} from "./user-validation";
import { delegationSchema } from "./delegation-validation";

type UserRouterMiddleware = {
  requireSession: RequestHandler;
  requirePasswordChanged: RequestHandler;
  requireSameOrigin: RequestHandler;
};

function route(
  action: (request: Request, response: Response) => Promise<unknown>,
): RequestHandler {
  return (request, response, next) => {
    void action(request, response).catch((error: unknown) =>
      sendUserError(error, response, next),
    );
  };
}

function getUserId(request: Request) {
  const { userId } = request.params;
  if (typeof userId !== "string" || userId.length === 0) {
    throw new UserManagementError("User account not found.", 404);
  }
  return userId;
}

function getDelegationId(request: Request) {
  const { delegationId } = request.params;
  if (typeof delegationId !== "string" || delegationId.length === 0) {
    throw new UserManagementError("Active delegation not found.", 404);
  }
  return delegationId;
}

export function createUserRouter(middleware: UserRouterMiddleware) {
  const router = Router();

  router.use(middleware.requireSession, middleware.requirePasswordChanged);
  router.use((request, response, next) => {
    const mayManageUsers = request.authenticatedUser?.roles.some(
      ({ name, permissions }) =>
        (name === "System Administrator" ||
          name === "Peace Forum President") &&
        permissions.includes("users:manage"),
    );
    if (!mayManageUsers) {
      response.status(403).json({ error: "You are not authorized to manage users." });
      return;
    }
    next();
  });

  router.get(
    "/options",
    route(async (_request, response) => {
      response.setHeader("Cache-Control", "private, no-store");
      const actorRole = await requireUserManagerRole(
        _request.authenticatedUser?.roles ?? [],
      );
      response.json(await getManagementOptions(actorRole));
    }),
  );

  router.get(
    "/",
    route(async (request, response) => {
      const parsed = userListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        invalidRequest(response);
        return;
      }
      response.setHeader("Cache-Control", "private, no-store");
      const actorRole = await requireUserManagerRole(
        request.authenticatedUser?.roles ?? [],
      );
      response.json(await searchUsers(actorRole, parsed.data));
    }),
  );

  router.post(
    "/",
    middleware.requireSameOrigin,
    route(async (request, response) => {
      const parsed = createUserSchema.safeParse(request.body);
      if (!parsed.success) {
        invalidRequest(
          response,
          parsed.error.issues.map(({ path }) => String(path[0] ?? "")),
        );
        return;
      }
      const actorRole = await requireUserManagerRole(
        request.authenticatedUser?.roles ?? [],
      );
      const user = await createManagedUser(
        getActorId(request),
        actorRole,
        parsed.data,
      );
      response.status(201).json({ user });
    }),
  );

  router.get(
    "/:userId/delegations",
    route(async (request, response) => {
      const actorRole = await requireUserManagerRole(
        request.authenticatedUser?.roles ?? [],
      );
      response.setHeader("Cache-Control", "private, no-store");
      response.json({
        delegations: await getRepresentativeDelegations(
          getUserId(request),
          actorRole,
        ),
      });
    }),
  );

  router.post(
    "/:userId/delegations",
    middleware.requireSameOrigin,
    route(async (request, response) => {
      const parsed = delegationSchema.safeParse(request.body);
      if (!parsed.success) {
        invalidRequest(response);
        return;
      }
      const actorRole = await requireUserManagerRole(
        request.authenticatedUser?.roles ?? [],
      );
      const delegation = await grantRepresentativeDelegation(
        getActorId(request),
        actorRole,
        getUserId(request),
        parsed.data,
      );
      response.status(201).json({ delegation });
    }),
  );

  router.delete(
    "/:userId/delegations/:delegationId",
    middleware.requireSameOrigin,
    route(async (request, response) => {
      const actorRole = await requireUserManagerRole(
        request.authenticatedUser?.roles ?? [],
      );
      await revokeRepresentativeDelegation(
        getActorId(request),
        actorRole,
        getUserId(request),
        getDelegationId(request),
      );
      response.json({ ok: true });
    }),
  );

  router.get(
    "/:userId/audit",
    route(async (request, response) => {
      response.setHeader("Cache-Control", "private, no-store");
      const actorRole = await requireUserManagerRole(
        request.authenticatedUser?.roles ?? [],
      );
      response.json({
        entries: await getManagedUserAudit(getUserId(request), actorRole),
      });
    }),
  );

  router.get(
    "/:userId",
    route(async (request, response) => {
      response.setHeader("Cache-Control", "private, no-store");
      const actorRole = await requireUserManagerRole(
        request.authenticatedUser?.roles ?? [],
      );
      response.json({
        user: await getUserDetails(getUserId(request), actorRole),
      });
    }),
  );

  router.put(
    "/:userId",
    middleware.requireSameOrigin,
    route(async (request, response) => {
      const parsed = updateUserSchema.safeParse(request.body);
      if (!parsed.success) {
        invalidRequest(response);
        return;
      }
      const actorRole = await requireUserManagerRole(
        request.authenticatedUser?.roles ?? [],
      );
      const user = await editManagedUser(
        getActorId(request),
        getUserId(request),
        actorRole,
        parsed.data,
      );
      response.json({ user });
    }),
  );

  router.patch(
    "/:userId/status",
    middleware.requireSameOrigin,
    route(async (request, response) => {
      const parsed = accountStatusSchema.safeParse(request.body);
      if (!parsed.success) {
        invalidRequest(response);
        return;
      }
      const actorRole = await requireUserManagerRole(
        request.authenticatedUser?.roles ?? [],
      );
      const user = await setManagedUserStatus(
        getActorId(request),
        getUserId(request),
        actorRole,
        parsed.data,
      );
      response.json({ user });
    }),
  );

  router.patch(
    "/:userId/role",
    middleware.requireSameOrigin,
    route(async (request, response) => {
      const parsed = roleAssignmentSchema.safeParse(request.body);
      if (!parsed.success) {
        invalidRequest(response);
        return;
      }
      const actorRole = await requireUserManagerRole(
        request.authenticatedUser?.roles ?? [],
      );
      const user = await reassignManagedUser(
        getActorId(request),
        getUserId(request),
        actorRole,
        parsed.data,
      );
      response.json({ user });
    }),
  );

  router.post(
    "/:userId/reset-password",
    middleware.requireSameOrigin,
    route(async (request, response) => {
      const parsed = resetPasswordSchema.safeParse(request.body);
      if (!parsed.success) {
        invalidRequest(response);
        return;
      }
      const actorRole = await requireUserManagerRole(
        request.authenticatedUser?.roles ?? [],
      );
      const user = await resetManagedUserPassword(
        getActorId(request),
        getUserId(request),
        actorRole,
        parsed.data,
      );
      response.json({ user });
    }),
  );

  return router;
}
