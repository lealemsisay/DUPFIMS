import { Prisma } from "@prisma/client";
import {
  Router,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import {
  AccountRequestRepositoryError,
} from "./account-request-repository";
import {
  getAccountRequestActor,
  AccountRequestServiceError,
  decideRequest,
  getRequestForActor,
  getRequestFormOptions,
  listRequestsForActor,
  resubmitAccountRequest,
  submitAccountRequest,
} from "./account-request-service";
import {
  accountRequestDecisionSchema,
  accountRequestInputSchema,
  accountRequestListSchema,
} from "./account-request-validation";

type AccountRequestRouteMiddleware = {
  requireSession: RequestHandler;
  requirePasswordChanged: RequestHandler;
  requireSameOrigin: RequestHandler;
};

function run(
  action: (request: Request, response: Response) => Promise<unknown>,
): RequestHandler {
  return (request, response, next) => {
    void action(request, response).catch((error: unknown) => {
      if (
        error instanceof AccountRequestServiceError ||
        error instanceof AccountRequestRepositoryError
      ) {
        response.status(error.status).json({ error: error.message });
        return;
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        response.status(409).json({
          error: "That username or email address is already in use.",
        });
        return;
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034"
      ) {
        response.status(409).json({
          error: "The account request changed concurrently. Refresh and try again.",
        });
        return;
      }
      next(error);
    });
  };
}

function getActorId(request: Request) {
  const actorId = request.authenticatedUser?.id;
  if (!actorId) {
    throw new AccountRequestServiceError("Authentication is required.", 401);
  }
  return actorId;
}

function getActor(request: Request) {
  return getAccountRequestActor(request.authenticatedUser?.roles ?? []);
}

function getRequestId(request: Request) {
  const { requestId } = request.params;
  if (typeof requestId !== "string" || !requestId) {
    throw new AccountRequestServiceError("Account request not found.", 404);
  }
  return requestId;
}

function invalidInputFields(
  response: Response,
  fields: string[],
) {
  const labels: Record<string, string> = {
    fullName: "Full name",
    username: "Username",
    email: "Email address",
    phoneNumber: "Phone number",
    password: "Password",
    roleId: "User role",
    campusId: "Campus assignment",
    organizationalUnitId: "Organizational unit",
  };
  const invalidFields = [
    ...new Set(fields.map((field) => labels[field]).filter(Boolean)),
  ];
  response.status(400).json({
    error: invalidFields.length
      ? `Check these fields: ${invalidFields.join(", ")}.`
      : "The account request is invalid.",
  });
}

export function createAccountRequestRouter(
  middleware: AccountRequestRouteMiddleware,
) {
  const router = Router();
  router.use(middleware.requireSession, middleware.requirePasswordChanged);

  router.get(
    "/options",
    run(async (request, response) => {
      if (!getActor(request).canRequest) {
        response.status(403).json({
          error: "You are not authorized to request user accounts.",
        });
        return;
      }
      response.setHeader("Cache-Control", "private, no-store");
      response.json(await getRequestFormOptions());
    }),
  );

  router.get(
    "/",
    run(async (request, response) => {
      const actor = getActor(request);
      if (!actor.canRequest && !actor.canApprove) {
        response.status(403).json({
          error: "You are not authorized to view account requests.",
        });
        return;
      }
      const parsed = accountRequestListSchema.safeParse(request.query);
      if (!parsed.success) {
        response.status(400).json({ error: "The request filter is invalid." });
        return;
      }
      response.setHeader("Cache-Control", "private, no-store");
      response.json({
        requests: await listRequestsForActor(
          getActorId(request),
          actor.canApprove,
          parsed.data,
        ),
      });
    }),
  );

  router.post(
    "/",
    middleware.requireSameOrigin,
    run(async (request, response) => {
      const actor = getActor(request);
      if (!actor.canRequest) {
        response.status(403).json({
          error: "Only authorized Peace Forum leadership can submit account requests.",
        });
        return;
      }
      const parsed = accountRequestInputSchema.safeParse(request.body);
      if (!parsed.success) {
        invalidInputFields(
          response,
          parsed.error.issues.map(({ path }) => String(path[0] ?? "")),
        );
        return;
      }
      const requestRecord = await submitAccountRequest(
        getActorId(request),
        actor.role,
        parsed.data,
      );
      response.status(201).json({ request: requestRecord });
    }),
  );

  router.get(
    "/:requestId",
    run(async (request, response) => {
      const actor = getActor(request);
      if (!actor.canRequest && !actor.canApprove) {
        response.status(403).json({
          error: "You are not authorized to view account requests.",
        });
        return;
      }
      response.setHeader("Cache-Control", "private, no-store");
      response.json({
        request: await getRequestForActor(
          getRequestId(request),
          getActorId(request),
          actor.canApprove,
        ),
      });
    }),
  );

  router.put(
    "/:requestId",
    middleware.requireSameOrigin,
    run(async (request, response) => {
      const actor = getActor(request);
      if (!actor.canRequest) {
        response.status(403).json({
          error: "You are not authorized to update account requests.",
        });
        return;
      }
      const parsed = accountRequestInputSchema.safeParse(request.body);
      if (!parsed.success) {
        invalidInputFields(
          response,
          parsed.error.issues.map(({ path }) => String(path[0] ?? "")),
        );
        return;
      }
      response.json({
        request: await resubmitAccountRequest(
          getRequestId(request),
          getActorId(request),
          actor.role,
          parsed.data,
        ),
      });
    }),
  );

  router.post(
    "/:requestId/decision",
    middleware.requireSameOrigin,
    run(async (request, response) => {
      const actor = getActor(request);
      const parsed = accountRequestDecisionSchema.safeParse(request.body);
      if (!parsed.success) {
        response.status(400).json({
          error: "Choose an approval decision and provide a reason (2–1000 characters).",
        });
        return;
      }
      response.json({
        request: await decideRequest(
          getRequestId(request),
          getActorId(request),
          actor.canApprove,
          parsed.data,
        ),
      });
    }),
  );

  return router;
}
