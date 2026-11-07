import { headers } from "next/headers";

const backendApiUrl =
  process.env.BACKEND_API_URL ?? "http://127.0.0.1:4000";

export type AppSession = {
  user: {
    id: string;
    username: string;
    email: string | null;
    name: string;
    mustChangePassword: boolean;
    roles: string[];
    permissions: string[];
  };
};

export type DashboardMetrics = {
  students: number | null;
  cases: number | null;
  openCases: number | null;
  resolvedCases: number | null;
  pendingSubmissions: number | null;
  campuses: Array<{
    id: string;
    name: string;
    code: string;
    students: number | null;
  }>;
  activities: Array<{
    id: string;
    action: string;
    entityType: string;
    createdAt: Date;
  }>;
  notifications: Array<{
    id: string;
    title: string;
    message: string | null;
    createdAt: Date;
    readAt: Date | null;
  }>;
  systemAdmin?: {
    totalUsers: number;
    activeUsers: number;
    suspendedUsers: number;
    totalCampuses: number;
    databaseConnected: boolean;
    recentAdminActivities: Array<{
      id: string;
      action: string;
      entityType: string;
      createdAt: Date;
    }>;
  };
};

async function backendFetch(path: string) {
  const requestHeaders = await headers();
  return fetch(`${backendApiUrl}${path}`, {
    headers: { cookie: requestHeaders.get("cookie") ?? "" },
    cache: "no-store",
  });
}

export async function getAppSession(): Promise<AppSession | null> {
  const response = await backendFetch("/api/auth/session");
  if (response.status === 401) return null;
  if (!response.ok) {
    throw new Error(`Backend session request failed (${response.status}).`);
  }
  return (await response.json()) as AppSession;
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const response = await backendFetch("/api/dashboard/metrics");
  if (!response.ok) {
    throw new Error(`Dashboard metrics request failed (${response.status}).`);
  }
  const data = (await response.json()) as Omit<
    DashboardMetrics,
    "activities" | "notifications"
  > & {
    activities: Array<
      Omit<DashboardMetrics["activities"][number], "createdAt"> & {
        createdAt: string;
      }
    >;
    notifications: Array<
      Omit<DashboardMetrics["notifications"][number], "createdAt" | "readAt"> & {
        createdAt: string;
        readAt: string | null;
      }
    >;
    systemAdmin?: Omit<
      NonNullable<DashboardMetrics["systemAdmin"]>,
      "recentAdminActivities"
    > & {
      recentAdminActivities: Array<
        Omit<
          NonNullable<DashboardMetrics["systemAdmin"]>["recentAdminActivities"][number],
          "createdAt"
        > & { createdAt: string }
      >;
    };
  };

  return {
    ...data,
    activities: data.activities.map((activity) => ({
      ...activity,
      createdAt: new Date(activity.createdAt),
    })),
    notifications: data.notifications.map((notification) => ({
      ...notification,
      createdAt: new Date(notification.createdAt),
      readAt: notification.readAt ? new Date(notification.readAt) : null,
    })),
    ...(data.systemAdmin
      ? {
          systemAdmin: {
            ...data.systemAdmin,
            recentAdminActivities:
              data.systemAdmin.recentAdminActivities.map((activity) => ({
                ...activity,
                createdAt: new Date(activity.createdAt),
              })),
          },
        }
      : {}),
  };
}
