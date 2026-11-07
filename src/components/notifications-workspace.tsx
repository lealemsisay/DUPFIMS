"use client";

import { Bell, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { RowActionMenu } from "./row-action-menu";

type NotificationItem = {
  id: string;
  title: string;
  message: string | null;
  readAt: string | null;
  createdAt: string;
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  const result = (await response.json().catch(() => null)) as
    | ({ error?: string } & T)
    | null;
  if (!response.ok) {
    throw new Error(result?.error ?? `Request failed (${response.status}).`);
  }
  if (!result) throw new Error("The server returned an invalid response.");
  return result;
}

export function NotificationsWorkspace() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await requestJson<{ notifications: NotificationItem[] }>(
        "/api/notifications",
      );
      setNotifications(result.notifications);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function setRead(notification: NotificationItem, read: boolean) {
    setError("");
    try {
      await requestJson(
        `/api/notifications/${encodeURIComponent(notification.id)}/read`,
        {
          method: "PATCH",
          body: JSON.stringify({ read }),
        },
      );
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update notification.");
    }
  }

  return (
    <section className="user-management" aria-labelledby="notifications-title">
      <div className="dashboard-welcome user-management-heading">
        <div>
          <h1 id="notifications-title">Notifications</h1>
          <p>Personal account and workflow updates.</p>
        </div>
        <button type="button" className="user-icon-button" onClick={() => void load()} aria-label="Refresh notifications">
          <RefreshCw size={16} />
        </button>
      </div>
      {error ? <p className="user-alert is-error" role="alert">{error}</p> : null}
      <section className="user-list-card notification-list" aria-label="Your notifications">
        {loading ? (
          <p className="user-table-message">Loading notifications…</p>
        ) : notifications.length === 0 ? (
          <div className="module-placeholder">
            <Bell aria-hidden="true" size={34} />
            <h2>No notifications</h2>
            <p>New account and workflow updates will appear here.</p>
          </div>
        ) : notifications.map((notification) => (
          <article className={`notification-item${notification.readAt ? " is-read" : " is-unread"}`} key={notification.id}>
            <span className="notification-item-icon"><Bell aria-hidden="true" size={17} /></span>
            <div className="notification-item-content">
              <strong>{notification.title}</strong>
              {notification.message ? <p>{notification.message}</p> : null}
              <time dateTime={notification.createdAt}>{new Date(notification.createdAt).toLocaleString()}</time>
            </div>
            <RowActionMenu
              label={notification.title}
              actions={[
                {
                  label: notification.readAt ? "Mark as unread" : "Mark as read",
                  onSelect: () => void setRead(notification, !notification.readAt),
                },
              ]}
            />
          </article>
        ))}
      </section>
    </section>
  );
}
