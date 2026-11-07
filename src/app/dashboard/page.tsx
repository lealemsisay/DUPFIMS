import {
  Bell,
  Building2,
  CalendarDays,
  ClipboardCheck,
  Database,
  FileClock,
  ShieldAlert,
  UsersRound,
  UserCheck,
  UserX,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppSession, getDashboardMetrics } from "@/lib/backend-api";

function formatActivity(action: string, entityType: string) {
  return `${action.replaceAll("_", " ")} · ${entityType.replaceAll("_", " ")}`;
}

export default async function DashboardPage() {
  const session = await getAppSession();
  if (!session?.user.id) redirect("/");
  if (session.user.mustChangePassword) redirect("/change-password");

  const metrics = await getDashboardMetrics();
  const primaryRole = session.user.roles[0] ?? "Peace Forum member";
  const dashboardIntro: Record<string, string> = {
    "Peace Forum President":
      "Organization-wide Peace Forum oversight across authorized campuses.",
    "Peace Forum Vice President":
      "Peace Forum leadership responsibilities and authorized information.",
    Secretary:
      "Coordination, records, and reporting available to your account.",
    "President's Representative":
      "Delegated campus responsibilities and authorized information.",
    "University President":
      "Institutional overview of information authorized for your office.",
    "University Vice President 1":
      "University Vice President 1 workspace and personal notification inbox.",
    "University Vice President 2":
      "University Vice President 2 workspace and personal notification inbox.",
    "University Vice President 3":
      "University Vice President 3 workspace and personal notification inbox.",
    "University Vice President 4":
      "University Vice President 4 workspace and personal notification inbox.",
    "University Vice President 5":
      "University Vice President 5 workspace and personal notification inbox.",
    "President's Office Staff":
      "Authorized office workflows and forwarded information.",
    "System Administrator":
      "Technical administration and account management. Confidential case records are not available to this role.",
  };
  if (primaryRole === "System Administrator") {
    const system = metrics.systemAdmin;
    if (!system) {
      throw new Error("System administration metrics are unavailable.");
    }

    const systemCards = [
      { label: "Total user accounts", value: system.totalUsers, icon: UsersRound },
      { label: "Active accounts", value: system.activeUsers, icon: UserCheck },
      { label: "Suspended accounts", value: system.suspendedUsers, icon: UserX },
      { label: "Total campuses", value: system.totalCampuses, icon: Building2 },
    ];

    return (
      <>
        <div className="dashboard-welcome">
          <div>
            <h1>System Administrator Dashboard</h1>
            <p>Technical account and campus administration.</p>
          </div>
          <div className="dashboard-period">
            <Database aria-hidden="true" size={14} />
            Database {system.databaseConnected ? "connected" : "unavailable"}
          </div>
        </div>
        <section className="metric-grid" aria-label="System administration overview">
          {systemCards.map(({ label, value, icon: Icon }) => (
            <div className="metric-card" key={label}>
              <span className="metric-label">
                <Icon
                  aria-hidden="true"
                  size={14}
                  style={{ marginRight: 6, verticalAlign: "middle" }}
                />
                {label}
              </span>
              <strong className="metric-value">{value.toLocaleString()}</strong>
            </div>
          ))}
        </section>
        <section className="dashboard-section system-admin-activity" aria-labelledby="system-activity-title">
          <div className="section-heading">
            <h2 id="system-activity-title">Recent account and campus administration</h2>
            <span>Audited activity</span>
          </div>
          {system.recentAdminActivities.length === 0 ? (
            <div className="empty-state">
              <FileClock aria-hidden="true" size={25} />
              <p>No account or campus administration activity has been recorded.</p>
            </div>
          ) : (
            <div className="activity-list">
              {system.recentAdminActivities.map((activity) => (
                <div className="activity-row" key={activity.id}>
                  <span className="activity-dot" aria-hidden="true" />
                  <div className="activity-copy">
                    <p>{formatActivity(activity.action, activity.entityType)}</p>
                    <time dateTime={activity.createdAt.toISOString()}>
                      {activity.createdAt.toLocaleString()}
                    </time>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </>
    );
  }

  const metricCards = [
    {
      label: "Registered students",
      value: metrics.students,
      icon: UsersRound,
      href: "/dashboard/students",
    },
    {
      label: "Disciplinary cases",
      value: metrics.cases,
      icon: ShieldAlert,
      href: "/dashboard/cases",
    },
    {
      label: "Open cases",
      value: metrics.openCases,
      icon: FileClock,
      href: "/dashboard/cases?status=OPEN",
    },
    {
      label: "Resolved cases",
      value: metrics.resolvedCases,
      icon: ClipboardCheck,
      href: "/dashboard/cases?status=RESOLVED",
    },
    {
      label: "Pending submissions",
      value: metrics.pendingSubmissions,
      icon: Bell,
      href: "/dashboard/information?status=PENDING",
    },
  ];

  function activityHref(entityType: string) {
    const type = entityType.toLocaleLowerCase("en-US");
    if (type.includes("student")) return "/dashboard/students";
    if (type.includes("case") || type.includes("disciplin")) {
      return "/dashboard/cases";
    }
    if (type.includes("submission") || type.includes("information")) {
      return "/dashboard/information";
    }
    if (type.includes("notification")) return "/dashboard/notifications";
    if (type.includes("message")) return "/dashboard/messages";
    if (type.includes("campus")) return "/dashboard/campuses";
    if (type.includes("user") || type.includes("account")) {
      return "/dashboard/users";
    }
    if (type.includes("setting")) return "/dashboard/settings";
    return "/dashboard/reports";
  }

  return (
    <>
      <div className="dashboard-welcome">
        <div>
          <h1>{primaryRole} Dashboard</h1>
          <p>{dashboardIntro[primaryRole] ?? `${primaryRole} workspace and authorized responsibilities.`}</p>
        </div>
        <div className="dashboard-period">
          <CalendarDays aria-hidden="true" size={14} />
          Live university data
        </div>
      </div>

      <section className="metric-grid" aria-label="University overview">
        {metricCards.map(({ label, value, icon: Icon, href }) => {
          const content = (
            <>
            <span className="metric-label">
              <Icon
                aria-hidden="true"
                size={14}
                style={{ marginRight: 6, verticalAlign: "middle" }}
              />
              {label}
            </span>
            <strong className={value === null ? "metric-value metric-restricted" : "metric-value"}>
              {value === null ? "Restricted" : value.toLocaleString()}
            </strong>
            </>
          );
          return value === null ? (
            <div className="metric-card" key={label}>{content}</div>
          ) : (
            <Link
              className="metric-card metric-card-link"
              href={href}
              key={label}
              aria-label={`Open ${label}`}
            >
              {content}
            </Link>
          );
        })}
      </section>

      <div className="dashboard-sections">
        <section className="dashboard-section" aria-labelledby="campus-title">
          <div className="section-heading">
            <h2 id="campus-title">Campus overview</h2>
            <span>{metrics.campuses.length} accessible</span>
          </div>
          {metrics.campuses.length === 0 ? (
            <div className="empty-state">
              <Building2 aria-hidden="true" size={25} />
              <p>
                No campus access is assigned to this account yet. Contact a
                system administrator to request an assignment.
              </p>
              <Link className="module-action-link" href="/dashboard/campuses">
                Open campus management
              </Link>
            </div>
          ) : (
            <div className="campus-list">
              {metrics.campuses.map((campus) => (
                <Link
                  className="campus-row campus-row-link"
                  href={`/dashboard/campuses?campus=${encodeURIComponent(campus.id)}`}
                  key={campus.id}
                >
                  <strong>{campus.name}</strong>
                  <span className="campus-counts">
                    {campus.code} ·{" "}
                    {campus.students === null
                      ? "student data restricted"
                      : `${campus.students} students`}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="dashboard-section" aria-labelledby="notifications-title">
          <div className="section-heading">
            <h2 id="notifications-title">Notifications</h2>
            <span>{metrics.notifications.length} recent</span>
          </div>
          {!session.user.permissions.includes("notifications:read") ? (
            <div className="empty-state">
              <Bell aria-hidden="true" size={25} />
              <p>Your role does not include notification access.</p>
            </div>
          ) : metrics.notifications.length === 0 ? (
            <div className="empty-state">
              <Bell aria-hidden="true" size={25} />
              <p>You have no notifications.</p>
            </div>
          ) : (
            <div className="activity-list">
              {metrics.notifications.map((notification) => (
                <Link
                  className="activity-row activity-row-link"
                  href="/dashboard/notifications"
                  key={notification.id}
                >
                  <span className="activity-dot" aria-hidden="true" />
                  <div className="activity-copy">
                    <p>
                      <strong>{notification.title}</strong>
                      {notification.message ? ` — ${notification.message}` : ""}
                    </p>
                    <time dateTime={notification.createdAt.toISOString()}>
                      {notification.createdAt.toLocaleDateString()}
                      {notification.readAt ? "" : " · Unread"}
                    </time>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="dashboard-section" aria-labelledby="activity-title">
          <div className="section-heading">
            <h2 id="activity-title">Recent activity</h2>
            <span>Account activity</span>
          </div>
          {metrics.activities.length === 0 ? (
            <div className="empty-state">
              <FileClock aria-hidden="true" size={25} />
              <p>There is no recorded activity for this account yet.</p>
            </div>
          ) : (
            <div className="activity-list">
              {metrics.activities.map((activity) => (
                <Link
                  className="activity-row activity-row-link"
                  href={activityHref(activity.entityType)}
                  key={activity.id}
                >
                  <span className="activity-dot" aria-hidden="true" />
                  <div className="activity-copy">
                    <p>
                      {formatActivity(activity.action, activity.entityType)}
                    </p>
                    <time dateTime={activity.createdAt.toISOString()}>
                      {activity.createdAt.toLocaleString()}
                    </time>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
