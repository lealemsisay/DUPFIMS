import {
  Router,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import {
  createCampus,
  isCampusDuplicate,
  isCampusMissing,
  listCampuses,
  setCampusStatus,
  updateCampus,
} from "./campus-repository";
import {
  campusStatusSchema,
  createCampusSchema,
  updateCampusSchema,
} from "./campus-validation";

type CampusRouteMiddleware = {
  requireSession: RequestHandler;
  requirePasswordChanged: RequestHandler;
  requireSameOrigin: RequestHandler;
};

function run(
  action: (request: Request, response: Response) => Promise<unknown>,
): RequestHandler {
  return (request, response, next) => {
    void action(request, response).catch((error: unknown) => {
      if (isCampusDuplicate(error)) {
        response.status(409).json({ error: "That campus identifier is already in use." });
      } else if (isCampusMissing(error)) {
        response.status(404).json({ error: "Campus not found." });
      } else {
        next(error);
      }
    });
  };
}

function getActorId(request: Request) {
  return request.authenticatedUser?.id;
}

function getCampusId(request: Request) {
  const { campusId } = request.params;
  if (typeof campusId !== "string" || !campusId) {
    throw new Error("Campus identifier is invalid.");
  }
  return campusId;
}

export function createCampusRouter(middleware: CampusRouteMiddleware) {
  const router = Router();
  router.use(middleware.requireSession, middleware.requirePasswordChanged);
  router.use((request, response, next) => {
    const authorized = request.authenticatedUser?.roles.some(
      ({ name, permissions }) =>
        name === "System Administrator" &&
        permissions.includes("campuses:manage"),
    );
    if (!authorized) {
      response.status(403).json({ error: "You are not authorized to manage campuses." });
      return;
    }
    next();
  });

  router.get(
    "/",
    run(async (_request, response) => {
      response.setHeader("Cache-Control", "private, no-store");
      response.json({ campuses: await listCampuses() });
    }),
  );

  router.post(
    "/",
    middleware.requireSameOrigin,
    run(async (request, response) => {
      const parsed = createCampusSchema.safeParse(request.body);
      if (!parsed.success) {
        response.status(400).json({
          error:
            "Campus identifier must be 2–24 characters, start with a letter or number, and contain only letters, numbers, underscores, or hyphens. Campus name must be 2–120 characters.",
        });
        return;
      }
      const actorId = getActorId(request);
      if (!actorId) {
        response.status(401).json({ error: "Authentication is required." });
        return;
      }
      response.status(201).json({
        campus: await createCampus(actorId, parsed.data),
      });
    }),
  );

  router.put(
    "/:campusId",
    middleware.requireSameOrigin,
    run(async (request, response) => {
      const parsed = updateCampusSchema.safeParse(request.body);
      if (!parsed.success) {
        response.status(400).json({
          error:
            "Campus identifier must be 2–24 characters, start with a letter or number, and contain only letters, numbers, underscores, or hyphens. Campus name must be 2–120 characters.",
        });
        return;
      }
      const actorId = getActorId(request);
      if (!actorId) {
        response.status(401).json({ error: "Authentication is required." });
        return;
      }
      response.json({
        campus: await updateCampus(actorId, getCampusId(request), parsed.data),
      });
    }),
  );

  router.patch(
    "/:campusId/status",
    middleware.requireSameOrigin,
    run(async (request, response) => {
      const parsed = campusStatusSchema.safeParse(request.body);
      if (!parsed.success) {
        response.status(400).json({ error: "Enter a valid campus status." });
        return;
      }
      const actorId = getActorId(request);
      if (!actorId) {
        response.status(401).json({ error: "Authentication is required." });
        return;
      }
      response.json({
        campus: await setCampusStatus(
          actorId,
          getCampusId(request),
          parsed.data.isActive,
        ),
      });
    }),
  );

  return router;
}
