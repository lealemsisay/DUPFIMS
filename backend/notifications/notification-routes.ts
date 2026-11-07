import {
  Router,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import { z } from "zod";
import {
  listNotifications,
  setNotificationReadState,
} from "./notification-repository";

type NotificationMiddleware = {
  requireSession: RequestHandler;
  requirePasswordChanged: RequestHandler;
  requireSameOrigin: RequestHandler;
};

const readStateSchema = z.object({ read: z.boolean() });

function actorId(request: Request) {
  return request.authenticatedUser?.id;
}

function hasPermission(request: Request, response: Response) {
  const canRead = request.authenticatedUser?.roles.some(({ permissions }) =>
    permissions.includes("notifications:read"),
  );
  if (!canRead) {
    response.status(403).json({
      error: "You are not authorized to access notifications.",
    });
    return false;
  }
  return true;
}

export function createNotificationRouter(middleware: NotificationMiddleware) {
  const router = Router();
  router.use(middleware.requireSession, middleware.requirePasswordChanged);

  router.get("/", async (request, response, next) => {
    if (!hasPermission(request, response)) return;
    const userId = actorId(request);
    if (!userId) {
      response.status(401).json({ error: "Authentication is required." });
      return;
    }
    try {
      response.setHeader("Cache-Control", "private, no-store");
      response.json({ notifications: await listNotifications(userId) });
    } catch (error) {
      next(error);
    }
  });

  router.patch(
    "/:notificationId/read",
    middleware.requireSameOrigin,
    async (request, response, next) => {
      if (!hasPermission(request, response)) return;
      const userId = actorId(request);
      if (!userId) {
        response.status(401).json({ error: "Authentication is required." });
        return;
      }
      const notificationId = request.params.notificationId;
      if (typeof notificationId !== "string" || !notificationId) {
        response.status(404).json({ error: "Notification not found." });
        return;
      }
      const parsed = readStateSchema.safeParse(request.body);
      if (!parsed.success) {
        response.status(400).json({ error: "Choose whether the notification is read." });
        return;
      }
      try {
        const updated = await setNotificationReadState(
          notificationId,
          userId,
          parsed.data.read,
        );
        if (!updated) {
          response.status(404).json({ error: "Notification not found." });
          return;
        }
        response.json({ ok: true });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
