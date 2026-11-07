"use client";

import {
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Search,
  Shield,
  UserPlus,
  X,
} from "lucide-react";
import Link from "next/link";
import { RowActionMenu } from "./row-action-menu";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";

type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "LOCKED";
type Assignment = {
  id: string;
  name: string;
  code?: string;
  createAllowed?: boolean;
  changeAllowed?: boolean;
};
type ManagedUser = {
  id: string;
  username: string;
  email: string | null;
  fullName: string;
  phoneNumber: string | null;
  status: UserStatus;
  mustChangePassword: boolean;
  isProtectedAccount: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  roles: Array<{ role: Assignment }>;
  campuses: Array<{ campus: Assignment }>;
  organizationalUnits: Array<{ organizationalUnit: Assignment }>;
};
type UserOptions = {
  roles: Assignment[];
  campuses: Assignment[];
  organizationalUnits: Assignment[];
};
type UserManagerRole = "System Administrator" | "Peace Forum President";
type AuditEntry = {
  id: string;
  action: string;
  detail: unknown;
  createdAt: string;
  actor: { id: string; username: string; fullName: string } | null;
};
type Delegation = {
  id: string;
  startsAt: string;
  endsAt: string;
  revokedAt: string | null;
  campus: Assignment;
  grantor: { fullName: string; username: string };
};
type UserForm = {
  fullName: string;
  email: string;
  phoneNumber: string;
  campusId: string;
  organizationalUnitId: string;
};
type Panel = "view" | "edit" | "role" | "reset" | null;

const emptyForm: UserForm = {
  fullName: "",
  email: "",
  phoneNumber: "",
  campusId: "",
  organizationalUnitId: "",
};

const pageSize = 10;

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Never";
}

function roleName(user: ManagedUser) {
  return user.roles.map(({ role }) => role.name).join(", ") || "No role";
}

function unitName(user: ManagedUser) {
  return (
    user.organizationalUnits
      .map(({ organizationalUnit }) => organizationalUnit.name)
      .join(", ") || "—"
  );
}

function campusName(user: ManagedUser) {
  return (
    user.campuses
      .map(({ campus }) => campus.name)
      .join(", ") || "All campuses / not assigned"
  );
}

function generatePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#";
  const random = new Uint32Array(12);
  crypto.getRandomValues(random);
  return Array.from(random, (value) => alphabet[value % alphabet.length]).join("");
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as
    | ({ error?: string } & T)
    | null;
  if (!response.ok) {
    throw new Error(payload?.error ?? `Request failed (${response.status}).`);
  }
  if (!payload) throw new Error("The server returned an invalid response.");
  return payload;
}

function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="user-dialog-backdrop" onMouseDown={onClose}>
      <section
        className="user-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="user-dialog-header">
          <h2 id="user-dialog-title">{title}</h2>
          <button
            type="button"
            className="user-icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function UserManagement({
  managerRole,
}: {
  managerRole: UserManagerRole;
}) {
  const [options, setOptions] = useState<UserOptions>();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [campusFilter, setCampusFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  const [activeUser, setActiveUser] = useState<ManagedUser>();
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [delegationOpen, setDelegationOpen] = useState(false);
  const [delegationCampusId, setDelegationCampusId] = useState("");
  const [delegationStartsAt, setDelegationStartsAt] = useState("");
  const [delegationEndsAt, setDelegationEndsAt] = useState("");
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [roleValue, setRoleValue] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const organizationalRoleNames = useMemo(
    () =>
      new Set([
        "Peace Values Education",
        "Women Affairs",
        "Media and Communication",
        "Rapid Response and Early Warning",
        "Command Post",
        "Campus Police",
      ]),
    [],
  );
  const manageableRoleNames = useMemo(
    () =>
      new Set(
        managerRole === "System Administrator"
          ? [
              "Peace Forum President",
              "Peace Forum Vice President",
              "Secretary",
              "University President",
              "University Vice President 1",
              "University Vice President 2",
              "University Vice President 3",
              "University Vice President 4",
              "University Vice President 5",
              "President's Office Staff",
            ]
          : [
              "President's Representative",
              "Peace Values Education",
              "Women Affairs",
              "Media and Communication",
              "Rapid Response and Early Warning",
              "Command Post",
              "Campus Police",
            ],
      ),
    [managerRole],
  );

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search.trim()) query.set("search", search.trim());
      if (roleFilter) query.set("roleId", roleFilter);
      if (campusFilter) query.set("campusId", campusFilter);
      if (statusFilter) query.set("status", statusFilter);
      const result = await requestJson<{
        users: ManagedUser[];
        pagination: { total: number };
      }>(`/api/users?${query}`);
      setUsers(result.users);
      setTotal(result.pagination.total);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load users.");
    } finally {
      setLoading(false);
    }
  }, [campusFilter, page, roleFilter, search, statusFilter]);

  useEffect(() => {
    void (async () => {
      try {
        setOptions(await requestJson<UserOptions>("/api/users/options"));
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Unable to load user options.",
        );
      }
    })();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadUsers(), 180);
    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  function closePanel() {
    setPanel(null);
    setActiveUser(undefined);
    setAuditEntries([]);
    setError("");
  }

  function startEdit(user: ManagedUser) {
    setError("");
    setActiveUser(user);
    setForm({
      ...emptyForm,
      fullName: user.fullName,
      email: user.email ?? "",
      phoneNumber: user.phoneNumber ?? "",
      campusId: user.campuses[0]?.campus.id ?? "",
      organizationalUnitId: organizationalRoleNames.has(roleName(user))
        ? user.organizationalUnits[0]?.organizationalUnit.id ?? ""
        : "",
    });
    setPanel("edit");
  }

  async function viewUser(user: ManagedUser) {
    setError("");
    setActiveUser(user);
    setPanel("view");
    try {
      const requests: Promise<unknown>[] = [
        requestJson<{ entries: AuditEntry[] }>(
          `/api/users/${encodeURIComponent(user.id)}/audit`,
        ).then((result) => setAuditEntries(result.entries)),
      ];
      if (
        managerRole === "Peace Forum President" &&
        roleName(user) === "President's Representative"
      ) {
        requests.push(
          requestJson<{ delegations: Delegation[] }>(
            `/api/users/${encodeURIComponent(user.id)}/delegations`,
          ).then((result) => setDelegations(result.delegations)),
        );
      }
      await Promise.all(requests);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load history.");
    }
  }

  function localDateTimeValue(value: Date) {
    const localDate = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
    return localDate.toISOString().slice(0, 16);
  }

  function openDelegationForm() {
    const now = new Date();
    const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    setDelegationCampusId(options?.campuses[0]?.id ?? "");
    setDelegationStartsAt(localDateTimeValue(now));
    setDelegationEndsAt(localDateTimeValue(end));
    setDelegationOpen(true);
    setError("");
  }

  async function grantDelegation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeUser) return;
    setBusy(true);
    setError("");
    try {
      const result = await requestJson<{ delegation: Delegation }>(
        `/api/users/${encodeURIComponent(activeUser.id)}/delegations`,
        {
          method: "POST",
          body: JSON.stringify({
            campusId: delegationCampusId,
            startsAt: new Date(delegationStartsAt).toISOString(),
            endsAt: new Date(delegationEndsAt).toISOString(),
          }),
        },
      );
      setDelegations((current) => [result.delegation, ...current]);
      setDelegationOpen(false);
      setNotice("Time-limited campus delegation granted.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to grant delegation.");
    } finally {
      setBusy(false);
    }
  }

  async function revokeDelegation(delegation: Delegation) {
    if (!activeUser) return;
    if (
      !window.confirm(
        `Revoke ${activeUser.fullName}'s delegation for ${delegation.campus.name}?`,
      )
    ) {
      return;
    }
    setError("");
    try {
      await requestJson(
        `/api/users/${encodeURIComponent(activeUser.id)}/delegations/${encodeURIComponent(delegation.id)}`,
        { method: "DELETE" },
      );
      setDelegations((current) =>
        current.map((item) =>
          item.id === delegation.id
            ? { ...item, revokedAt: new Date().toISOString() }
            : item,
        ),
      );
      setNotice("Delegation revoked.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to revoke delegation.");
    }
  }

  function setField<K extends keyof UserForm>(key: K, value: UserForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submitUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const body = {
        fullName: form.fullName,
        email: form.email,
        phoneNumber: form.phoneNumber,
        campusId: form.campusId || null,
        organizationalUnitId: form.organizationalUnitId || null,
      };
      if (activeUser) {
        await requestJson(`/api/users/${encodeURIComponent(activeUser.id)}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        setNotice("Account details were updated.");
      } else {
        throw new Error("Select an account before saving changes.");
      }
      closePanel();
      await loadUsers();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save the account.");
    } finally {
      setBusy(false);
    }
  }

  async function changeRole() {
    if (!activeUser || !roleValue || roleValue === activeUser.roles[0]?.role.id) {
      closePanel();
      return;
    }
    if (!window.confirm("Change this user's assigned role? Their permissions will change immediately.")) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await requestJson(`/api/users/${encodeURIComponent(activeUser.id)}/role`, {
        method: "PATCH",
        body: JSON.stringify({ roleId: roleValue }),
      });
      setNotice("The user's role was changed.");
      closePanel();
      await loadUsers();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to change role.");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(user: ManagedUser, status: "ACTIVE" | "INACTIVE" | "SUSPENDED") {
    const label =
      status === "ACTIVE"
        ? "reactivate"
        : status === "INACTIVE"
          ? "deactivate"
          : "suspend";
    if (!window.confirm(`Are you sure you want to ${label} ${user.fullName}?`)) {
      return;
    }
    setError("");
    setNotice("");
    try {
      await requestJson(`/api/users/${encodeURIComponent(user.id)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setNotice(
        status === "ACTIVE"
          ? "Account reactivated."
          : status === "INACTIVE"
            ? "Account deactivated."
            : "Account suspended.",
      );
      await loadUsers();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to change account status.");
    }
  }

  function startRoleChange(user: ManagedUser) {
    setActiveUser(user);
    setRoleValue(user.roles[0]?.role.id ?? "");
    setError("");
    setPanel("role");
  }

  function startPasswordReset(user: ManagedUser) {
    setActiveUser(user);
    setResetPassword("");
    setResetConfirmation("");
    setError("");
    setPanel("reset");
  }

  async function submitPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeUser || resetPassword !== resetConfirmation) {
      setError("Password and confirmation must match.");
      return;
    }
    if (!window.confirm(`Reset the password for ${activeUser.fullName}? Their active sessions will be revoked.`)) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await requestJson(
        `/api/users/${encodeURIComponent(activeUser.id)}/reset-password`,
        {
          method: "POST",
          body: JSON.stringify({ password: resetPassword }),
        },
      );
      setNotice("Password reset. The user must change it at their next login.");
      closePanel();
      await loadUsers();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to reset the password.");
    } finally {
      setBusy(false);
    }
  }

  const unitRequired =
    Boolean(activeUser && organizationalRoleNames.has(roleName(activeUser)));
  const maxPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section className="user-management" aria-labelledby="users-title">
      <div className="dashboard-welcome user-management-heading">
        <div>
          <h1 id="users-title">
            {managerRole === "Peace Forum President"
              ? "Peace Forum Executive Accounts"
              : "User Management"}
          </h1>
          <p>
            {managerRole === "Peace Forum President"
              ? "Manage authorized Peace Forum representative and organizational-unit accounts."
              : "Manage appointed Peace Forum and university leadership accounts."}
          </p>
        </div>
        {managerRole === "Peace Forum President" ? (
          <Link className="user-primary-button" href="/dashboard/account-requests">
            <UserPlus size={16} aria-hidden="true" />
            Submit account request
          </Link>
        ) : null}
      </div>

      {error && !panel ? <p className="user-alert is-error" role="alert">{error}</p> : null}
      {notice ? <p className="user-alert is-success" role="status">{notice}</p> : null}

      <section className="user-list-card" aria-label="User accounts">
        <div className="user-filters">
          <label className="user-search">
            <Search size={16} aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
              placeholder="Search name, username, or email"
              aria-label="Search users"
            />
          </label>
          <select
            aria-label="Filter by role"
            value={roleFilter}
            onChange={(event) => {
              setPage(1);
              setRoleFilter(event.target.value);
            }}
          >
            <option value="">All roles</option>
            {options?.roles.map((role) => (
              <option value={role.id} key={role.id}>{role.name}</option>
            ))}
          </select>
          <select
            aria-label="Filter by campus"
            value={campusFilter}
            onChange={(event) => {
              setPage(1);
              setCampusFilter(event.target.value);
            }}
          >
            <option value="">All campuses</option>
            {options?.campuses.map((campus) => (
              <option value={campus.id} key={campus.id}>{campus.name}</option>
            ))}
          </select>
          <select
            aria-label="Filter by account status"
            value={statusFilter}
            onChange={(event) => {
              setPage(1);
              setStatusFilter(event.target.value);
            }}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="LOCKED">Locked</option>
          </select>
          <button
            type="button"
            className="user-icon-button user-refresh-button"
            onClick={() => void loadUsers()}
            aria-label="Refresh user list"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        <div className="user-table-wrap">
          <table className="user-table">
            <thead>
              <tr>
                <th scope="col">Full name / username</th>
                <th scope="col">Role</th>
                <th scope="col">Campus / unit</th>
                <th scope="col">Status</th>
                <th scope="col">Created</th>
                <th scope="col">Last login</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="user-table-message">Loading accounts…</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={7} className="user-table-message">No accounts match these filters.</td></tr>
              ) : users.map((user) => {
                const protectedAccount =
                  user.isProtectedAccount ||
                  user.roles.some(({ role }) => role.name === "System Administrator");
                const inManagedScope =
                  user.roles.length > 0 &&
                  user.roles.every(({ role }) => manageableRoleNames.has(role.name));
                const canManageAccount = inManagedScope && !protectedAccount;
                const actions = [
                  {
                    label: "View account and history",
                    onSelect: () => void viewUser(user),
                  },
                  ...(canManageAccount
                    ? [
                        {
                          label: "Edit account",
                          onSelect: () => startEdit(user),
                        },
                        ...(managerRole === "Peace Forum President" &&
                        roleName(user) !== "Peace Forum President"
                          ? [
                              {
                                label: "Change role",
                                onSelect: () => startRoleChange(user),
                              },
                            ]
                          : []),
                        {
                          label: "Reset password",
                          onSelect: () => startPasswordReset(user),
                        },
                        {
                          label:
                            user.status === "ACTIVE"
                              ? "Suspend account"
                              : "Activate account",
                          onSelect: () =>
                            void setStatus(
                              user,
                              user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
                            ),
                        },
                        ...(user.status === "ACTIVE"
                          ? [
                              {
                                label: "Deactivate account",
                                onSelect: () => void setStatus(user, "INACTIVE"),
                                destructive: true,
                              },
                            ]
                          : []),
                      ]
                    : []),
                ];
                return (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.fullName}</strong>
                      <span className="user-table-secondary">@{user.username} · {user.email ?? "No email"}</span>
                      {protectedAccount ? <span className="user-protected-label"><Shield size={12} /> Protected</span> : null}
                    </td>
                    <td>{roleName(user)}</td>
                    <td>
                      <span>{campusName(user)}</span>
                      <span className="user-table-secondary">{unitName(user)}</span>
                    </td>
                    <td><span className={`user-status user-status-${user.status.toLocaleLowerCase("en-US")}`}>{user.status}</span></td>
                    <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td>{formatDate(user.lastLoginAt)}</td>
                    <td>
                      <RowActionMenu label={user.fullName} actions={actions} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <footer className="user-pagination">
          <span>{total} account{total === 1 ? "" : "s"}</span>
          <div>
            <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label="Previous page"><ChevronLeft size={17} /> Previous</button>
            <span>Page {page} of {maxPages}</span>
            <button type="button" disabled={page >= maxPages || loading} onClick={() => setPage((value) => Math.min(maxPages, value + 1))} aria-label="Next page">Next <ChevronRight size={17} /></button>
          </div>
        </footer>
      </section>

      {panel === "edit" ? (
        <Dialog title="Edit user account" onClose={closePanel}>
          <form className="user-form" onSubmit={submitUser}>
            <div className="user-form-grid">
              <label>Full name<input required minLength={2} maxLength={160} value={form.fullName} onChange={(event) => setField("fullName", event.target.value)} autoComplete="name" /></label>
              <label>Username<input value={activeUser?.username ?? ""} readOnly /></label>
              <label>Email address<input required type="email" maxLength={254} value={form.email} onChange={(event) => setField("email", event.target.value)} autoComplete="email" /></label>
              <label>Phone number<input type="tel" maxLength={32} value={form.phoneNumber} onChange={(event) => setField("phoneNumber", event.target.value)} autoComplete="tel" /></label>
              <label>Campus assignment{unitRequired ? <span className="user-required-note">Required for this role</span> : null}<select required={unitRequired} value={form.campusId} onChange={(event) => setField("campusId", event.target.value)}><option value="">No campus assignment</option>{options?.campuses.map((campus) => <option value={campus.id} key={campus.id}>{campus.name} ({campus.code})</option>)}</select></label>
              {unitRequired ? (
                <label>Organizational unit<select required value={form.organizationalUnitId} onChange={(event) => setField("organizationalUnitId", event.target.value)}><option value="">Select a unit</option>{options?.organizationalUnits.map((unit) => <option value={unit.id} key={unit.id}>{unit.name}</option>)}</select></label>
              ) : panel === "edit" && form.organizationalUnitId ? (
                <label>Organizational unit<input value={activeUser?.organizationalUnits[0]?.organizationalUnit.name ?? ""} readOnly /></label>
              ) : null}
            </div>
            {error ? <p className="user-alert is-error" role="alert">{error}</p> : null}
            <div className="user-dialog-actions">
              <button type="button" className="user-secondary-button" onClick={closePanel}>Cancel</button>
              <button type="submit" className="user-primary-button" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
            </div>
          </form>
        </Dialog>
      ) : null}

      {panel === "view" && activeUser ? (
        <Dialog title="Account details and history" onClose={closePanel}>
          <div className="user-detail-content">
            <dl className="user-detail-grid">
              <div><dt>Full name</dt><dd>{activeUser.fullName}</dd></div>
              <div><dt>Username</dt><dd>{activeUser.username}</dd></div>
              <div><dt>Email</dt><dd>{activeUser.email ?? "—"}</dd></div>
              <div><dt>Phone</dt><dd>{activeUser.phoneNumber ?? "—"}</dd></div>
              <div><dt>Role</dt><dd>{roleName(activeUser)}</dd></div>
              <div><dt>Campus</dt><dd>{campusName(activeUser)}</dd></div>
              <div><dt>Organizational unit</dt><dd>{unitName(activeUser)}</dd></div>
              <div><dt>Status</dt><dd>{activeUser.status}</dd></div>
              <div><dt>Created</dt><dd>{formatDate(activeUser.createdAt)}</dd></div>
              <div><dt>Last modified</dt><dd>{formatDate(activeUser.updatedAt)}</dd></div>
              <div><dt>Last login</dt><dd>{formatDate(activeUser.lastLoginAt)}</dd></div>
              <div><dt>First-login password change</dt><dd>{activeUser.mustChangePassword ? "Required" : "Complete"}</dd></div>
            </dl>
            <h3 className="user-history-title">Account history</h3>
            {auditEntries.length === 0 ? <p className="user-empty-history">No account changes have been recorded.</p> : (
              <ol className="user-history-list">
                {auditEntries.map((entry) => (
                  <li key={entry.id}>
                    <strong>{entry.action.replaceAll("_", " ").toLocaleLowerCase("en-US")}</strong>
                    <span>{entry.actor ? `${entry.actor.fullName} (@${entry.actor.username})` : "System"}</span>
                    <time dateTime={entry.createdAt}>{formatDate(entry.createdAt)}</time>
                    {entry.detail ? <code>{JSON.stringify(entry.detail)}</code> : null}
                  </li>
                ))}
              </ol>
            )}
            {managerRole === "Peace Forum President" &&
            roleName(activeUser) === "President's Representative" ? (
              <>
                <h3 className="user-history-title">Campus delegations</h3>
                <p className="user-dialog-copy">
                  Delegations are campus-specific, time-limited, and auditable.
                  An expired or revoked delegation grants no access.
                </p>
                <button
                  type="button"
                  className="user-primary-button"
                  onClick={openDelegationForm}
                >
                  <Plus size={14} /> Grant delegation
                </button>
                {delegations.length === 0 ? (
                  <p className="user-empty-history">No campus delegations recorded.</p>
                ) : (
                  <ol className="user-history-list">
                    {delegations.map((delegation) => {
                      const currentlyActive =
                        !delegation.revokedAt &&
                        new Date(delegation.startsAt) <= new Date() &&
                        new Date(delegation.endsAt) >= new Date();
                      return (
                        <li key={delegation.id}>
                          <strong>{delegation.campus.name} ({delegation.campus.code})</strong>
                          <span>{new Date(delegation.startsAt).toLocaleString()} – {new Date(delegation.endsAt).toLocaleString()}</span>
                          <span>{delegation.revokedAt ? "Revoked" : currentlyActive ? "Active" : "Scheduled / expired"}</span>
                          {!delegation.revokedAt ? (
                            <button
                              className="user-secondary-button"
                              type="button"
                              onClick={() => void revokeDelegation(delegation)}
                            >
                              Revoke
                            </button>
                          ) : null}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </>
            ) : null}
            {delegationOpen ? (
              <form className="user-delegation-form" onSubmit={grantDelegation}>
                <h4>Grant campus delegation</h4>
                <label>Campus<select required value={delegationCampusId} onChange={(event) => setDelegationCampusId(event.target.value)}><option value="">Select a campus</option>{options?.campuses.map((campus) => <option value={campus.id} key={campus.id}>{campus.name}</option>)}</select></label>
                <label>Starts at<input required type="datetime-local" value={delegationStartsAt} onChange={(event) => setDelegationStartsAt(event.target.value)} /></label>
                <label>Ends at<input required type="datetime-local" value={delegationEndsAt} onChange={(event) => setDelegationEndsAt(event.target.value)} /></label>
                {error ? <p className="user-alert is-error" role="alert">{error}</p> : null}
                <div className="user-dialog-actions">
                  <button type="button" className="user-secondary-button" onClick={() => setDelegationOpen(false)}>Cancel</button>
                  <button type="submit" className="user-primary-button" disabled={busy || !delegationCampusId}>{busy ? "Granting…" : "Grant delegation"}</button>
                </div>
              </form>
            ) : null}
            {error ? <p className="user-alert is-error" role="alert">{error}</p> : null}
          </div>
        </Dialog>
      ) : null}

      {panel === "role" && activeUser ? (
        <Dialog title="Change assigned role" onClose={closePanel}>
          <div className="user-form">
            <p className="user-dialog-copy">Changing the role immediately changes this account’s permissions. The System Administrator role cannot be assigned here.</p>
            <label>User role<select value={roleValue} onChange={(event) => setRoleValue(event.target.value)}>{options?.roles.filter((role) => role.changeAllowed).map((role) => <option value={role.id} key={role.id}>{role.name}</option>)}</select></label>
            {error ? <p className="user-alert is-error" role="alert">{error}</p> : null}
            <div className="user-dialog-actions"><button type="button" className="user-secondary-button" onClick={closePanel}>Cancel</button><button type="button" className="user-primary-button" disabled={busy || !roleValue} onClick={() => void changeRole()}>{busy ? "Updating…" : "Change role"}</button></div>
          </div>
        </Dialog>
      ) : null}

      {panel === "reset" && activeUser ? (
        <Dialog title="Reset account password" onClose={closePanel}>
          <form className="user-form" onSubmit={submitPasswordReset}>
            <p className="user-dialog-copy">All existing sessions for {activeUser.fullName} will be revoked. The user must change this password at their next login.</p>
            <label>New temporary password<input required type="password" minLength={6} maxLength={12} value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} autoComplete="new-password" /></label>
            <label>Confirm temporary password<input required type="password" minLength={6} maxLength={12} value={resetConfirmation} onChange={(event) => setResetConfirmation(event.target.value)} autoComplete="new-password" /></label>
            <div className="user-password-generate"><button type="button" onClick={() => {
              const generated = generatePassword();
              setResetPassword(generated);
              setResetConfirmation(generated);
            }}>Generate password</button></div>
            {error ? <p className="user-alert is-error" role="alert">{error}</p> : null}
            <div className="user-dialog-actions"><button type="button" className="user-secondary-button" onClick={closePanel}>Cancel</button><button type="submit" className="user-primary-button" disabled={busy}>{busy ? "Resetting…" : "Reset password"}</button></div>
          </form>
        </Dialog>
      ) : null}

      {panel ? null : total === 0 && !loading && !error ? (
        <span className="sr-only">No user accounts found.</span>
      ) : null}
    </section>
  );
}
