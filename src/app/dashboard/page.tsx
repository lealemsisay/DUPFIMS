import {
  Bell,
  Building2,
  CalendarDays,
  ClipboardCheck,
  FileClock,
  ShieldAlert,
  UsersRound,
} from "lucide-react";
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
  const metricCards = [
    { label: "Registered students", value: metrics.students, icon: UsersRound },
    { label: "Disciplinary cases", value: metrics.cases, icon: ShieldAlert },
    { label: "Open cases", value: metrics.openCases, icon: FileClock },
    { label: "Resolved cases", value: metrics.resolvedCases, icon: ClipboardCheck },
    {
      label: "Pending submissions",
      value: metrics.pendingSubmissions,
      icon: Bell,
    },
  ];

  return (
    <>
      <div className="dashboard-welcome">
        <div>
          <h1>Dashboard</h1>
          <p>Peace Forum overview for the campuses you are authorized to access.</p>
        </div>
        <div className="dashboard-period">
          <CalendarDays aria-hidden="true" size={14} />
          Live university data
        </div>
      </div>

      <section className="metric-grid" aria-label="University overview">
        {metricCards.map(({ label, value, icon: Icon }) => (
          <article className="metric-card" key={label}>
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
          </article>
        ))}
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
            </div>
          ) : (
            <div className="campus-list">
              {metrics.campuses.map((campus) => (
                <div className="campus-row" key={campus.id}>
                  <strong>{campus.name}</strong>
                  <span className="campus-counts">
                    {campus.code} ·{" "}
                    {campus.students === null
                      ? "student data restricted"
                      : `${campus.students} students`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="dashboard-section" aria-labelledby="notifications-title">
          <div className="section-heading">
            <h2 id="notifications-title">Notifications</h2>
            <span>{metrics.notifications.length} recent</span>
          </div>
          {metrics.notifications.length === 0 ? (
            <div className="empty-state">
              <Bell aria-hidden="true" size={25} />
              <p>You have no notifications.</p>
            </div>
          ) : (
            <div className="activity-list">
              {metrics.notifications.map((notification) => (
                <article className="activity-row" key={notification.id}>
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
                </article>
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
                <article className="activity-row" key={activity.id}>
                  <span className="activity-dot" aria-hidden="true" />
                  <div className="activity-copy">
                    <p>
                      {formatActivity(activity.action, activity.entityType)}
                    </p>
                    <time dateTime={activity.createdAt.toISOString()}>
                      {activity.createdAt.toLocaleString()}
                    </time>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
