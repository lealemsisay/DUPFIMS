"use client";

import { Plus, RefreshCw, UserPlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { RowActionMenu } from "./row-action-menu";

type UserOption = { id: string; name: string };
type CampusOption = { id: string; name: string; code: string };
type AccountRequestOptions = {
  roles: UserOption[];
  campuses: CampusOption[];
  organizationalUnits: UserOption[];
};
type RequestRecord = {
  id: string;
  username: string;
  email: string;
  fullName: string;
  phoneNumber: string | null;
  role: UserOption;
  campus: CampusOption | null;
  organizationalUnit: UserOption | null;
  status:
    | "PENDING_APPROVAL"
    | "APPROVED"
    | "REJECTED"
    | "RETURNED_FOR_CORRECTION";
  decisionReason: string | null;
  createdAt: string;
  requester: { id: string; username: string; fullName: string; email: string | null };
  approvedUser: { id: string; username: string; status: string } | null;
};
type DirectoryUser = {
  id: string;
  username: string;
  email: string | null;
  fullName: string;
  status: string;
  createdAt: string;
  roles: Array<{ role: UserOption }>;
  campuses: Array<{ campus: CampusOption }>;
};
type RequestForm = {
  fullName: string;
  username: string;
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
  roleId: string;
  campusId: string;
  organizationalUnitId: string;
};

const emptyForm: RequestForm = {
  fullName: "",
  username: "",
  email: "",
  phoneNumber: "",
  password: "",
  confirmPassword: "",
  roleId: "",
  campusId: "",
  organizationalUnitId: "",
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

function requestStatus(status: RequestRecord["status"]) {
  return status.replaceAll("_", " ");
}

function generatePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#";
  const random = new Uint32Array(12);
  crypto.getRandomValues(random);
  return Array.from(random, (value) => alphabet[value % alphabet.length]).join("");
}

export function AccountRequestWorkspace() {
  const [options, setOptions] = useState<AccountRequestOptions>();
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [form, setForm] = useState<RequestForm>(emptyForm);
  const [editingRequest, setEditingRequest] = useState<string>();
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const unitRoles = useMemo(
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
  const selectedRole = options?.roles.find((role) => role.id === form.roleId);
  const requiresUnit = Boolean(selectedRole && unitRoles.has(selectedRole.name));

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [requestResult, directoryResult, requestOptions] = await Promise.all([
        requestJson<{ requests: RequestRecord[] }>("/api/account-requests"),
        requestJson<{ users: DirectoryUser[] }>(
          "/api/user-directory?page=1&pageSize=100",
        ),
        requestJson<AccountRequestOptions>("/api/account-requests/options"),
      ]);
      setRequests(requestResult.requests);
      setUsers(directoryResult.users);
      setOptions(requestOptions);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load account information.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function startCreate() {
    setEditingRequest(undefined);
    setForm({ ...emptyForm, roleId: options?.roles[0]?.id ?? "" });
    setError("");
    setNotice("");
    setFormOpen(true);
  }

  function startCorrection(request: RequestRecord) {
    setEditingRequest(request.id);
    setForm({
      ...emptyForm,
      fullName: request.fullName,
      username: request.username,
      email: request.email,
      phoneNumber: request.phoneNumber ?? "",
      roleId: request.role.id,
      campusId: request.campus?.id ?? "",
      organizationalUnitId: request.organizationalUnit?.id ?? "",
    });
    setError("");
    setFormOpen(true);
  }

  function setField<K extends keyof RequestForm>(key: K, value: RequestForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (form.password !== form.confirmPassword) {
      setError("Password and confirmation must match.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        fullName: form.fullName,
        username: form.username,
        email: form.email,
        phoneNumber: form.phoneNumber,
        password: form.password,
        roleId: form.roleId,
        campusId: form.campusId || null,
        organizationalUnitId: form.organizationalUnitId || null,
        mustChangePassword: true,
      };
      await requestJson(
        editingRequest
          ? `/api/account-requests/${encodeURIComponent(editingRequest)}`
          : "/api/account-requests",
        {
          method: editingRequest ? "PUT" : "POST",
          body: JSON.stringify(payload),
        },
      );
      setFormOpen(false);
      setNotice(
        editingRequest
          ? "The corrected account request was resubmitted for approval."
          : "Account request submitted. The account remains inactive until approved.",
      );
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to submit the account request.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="user-management" aria-labelledby="account-requests-title">
      <div className="dashboard-welcome user-management-heading">
        <div>
          <h1 id="account-requests-title">Account Requests</h1>
          <p>Submit accounts for Peace Forum President approval and track decisions.</p>
        </div>
        <button className="user-primary-button" type="button" onClick={startCreate}>
          <UserPlus size={16} aria-hidden="true" />
          Submit account request
        </button>
      </div>

      {error && !formOpen ? <p className="user-alert is-error" role="alert">{error}</p> : null}
      {notice ? <p className="user-alert is-success" role="status">{notice}</p> : null}

      <section className="user-list-card" aria-label="Submitted account requests">
        <h2 className="user-history-title">My requests</h2>
        {loading ? (
          <p className="user-table-message">Loading account requests…</p>
        ) : requests.length === 0 ? (
          <p className="user-table-message">You have not submitted any account requests.</p>
        ) : (
          <div className="user-table-wrap">
            <table className="user-table">
              <thead>
                <tr>
                  <th scope="col">Proposed account</th>
                  <th scope="col">Role</th>
                  <th scope="col">Campus / unit</th>
                  <th scope="col">Status</th>
                  <th scope="col">Submitted</th>
                  <th scope="col">Decision / action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td>
                      <strong>{request.fullName}</strong>
                      <span className="user-table-secondary">@{request.username} · {request.email}</span>
                    </td>
                    <td>{request.role.name}</td>
                    <td>
                      {request.campus?.name ?? "—"}
                      {request.organizationalUnit ? (
                        <span className="user-table-secondary">{request.organizationalUnit.name}</span>
                      ) : null}
                    </td>
                    <td><span className={`user-status user-status-${request.status.toLocaleLowerCase("en-US")}`}>{requestStatus(request.status)}</span></td>
                    <td>{new Date(request.createdAt).toLocaleString()}</td>
                    <td>
                      {request.decisionReason ?? (request.approvedUser
                        ? "Account active; first login requires password change."
                        : "Awaiting decision.")}
                      {request.status === "RETURNED_FOR_CORRECTION" ? (
                        <RowActionMenu
                          label={`${request.fullName} account request`}
                          actions={[
                            {
                              label: "Correct and resubmit",
                              onSelect: () => startCorrection(request),
                            },
                          ]}
                        />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="user-list-card" aria-label="Approved account directory">
        <h2 className="user-history-title">Approved account directory</h2>
        {loading ? (
          <p className="user-table-message">Loading approved accounts…</p>
        ) : users.length === 0 ? (
          <p className="user-table-message">No approved accounts are available in your authorized scope.</p>
        ) : (
          <div className="user-table-wrap">
            <table className="user-table">
              <thead>
                <tr>
                  <th scope="col">Name / username</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Campus</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td><strong>{user.fullName}</strong><span className="user-table-secondary">@{user.username}</span></td>
                    <td>{user.email ?? "—"}</td>
                    <td>{user.roles.map(({ role }) => role.name).join(", ")}</td>
                    <td>{user.campuses.map(({ campus }) => campus.name).join(", ") || "All campuses / not assigned"}</td>
                    <td><span className={`user-status user-status-${user.status.toLocaleLowerCase("en-US")}`}>{user.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formOpen ? (
        <div className="user-dialog-backdrop" onMouseDown={() => setFormOpen(false)}>
          <section
            className="user-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-request-form-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="user-dialog-header">
              <h2 id="account-request-form-title">{editingRequest ? "Correct account request" : "Submit account request"}</h2>
              <button type="button" className="user-icon-button" onClick={() => setFormOpen(false)} aria-label="Close dialog">×</button>
            </header>
            <form className="user-form" onSubmit={submit}>
              <div className="user-form-grid">
                <label>Full name<input required minLength={2} maxLength={160} value={form.fullName} onChange={(event) => setField("fullName", event.target.value)} autoComplete="name" /></label>
                <label>Username<input required minLength={3} maxLength={64} pattern="(?:[A-Za-z0-9._]|-)+" value={form.username} onChange={(event) => setField("username", event.target.value)} autoComplete="username" /><span className="user-field-hint">3–64 characters; use letters, numbers, periods, underscores, or hyphens.</span></label>
                <label>Email address<input required type="email" maxLength={254} value={form.email} onChange={(event) => setField("email", event.target.value)} autoComplete="email" /></label>
                <label>Phone number<input type="tel" maxLength={32} value={form.phoneNumber} onChange={(event) => setField("phoneNumber", event.target.value)} autoComplete="tel" /></label>
                <label>Requested role<select required value={form.roleId} onChange={(event) => {
                  const roleId = event.target.value;
                  const roleName = options?.roles.find((role) => role.id === roleId)?.name;
                  const unit = options?.organizationalUnits.find((item) => item.name === roleName);
                  setField("roleId", roleId);
                  setField("organizationalUnitId", unit?.id ?? "");
                }}><option value="">Select a role</option>{options?.roles.map((role) => <option value={role.id} key={role.id}>{role.name}</option>)}</select></label>
                <label>Campus assignment{requiresUnit ? <span className="user-required-note">Required for this role</span> : null}<select required={requiresUnit} value={form.campusId} onChange={(event) => setField("campusId", event.target.value)}><option value="">No campus assignment</option>{options?.campuses.map((campus) => <option value={campus.id} key={campus.id}>{campus.name} ({campus.code})</option>)}</select></label>
                {requiresUnit ? (
                  <label>Organizational unit<select required value={form.organizationalUnitId} onChange={(event) => setField("organizationalUnitId", event.target.value)}><option value="">Select a unit</option>{options?.organizationalUnits.map((unit) => <option value={unit.id} key={unit.id}>{unit.name}</option>)}</select></label>
                ) : null}
                <label>Initial password<input required type="password" minLength={6} maxLength={12} value={form.password} onChange={(event) => setField("password", event.target.value)} autoComplete="new-password" /><span className="user-field-hint">6–12 characters; stored only as a bcrypt hash. The user must change it at first login.</span></label>
                <label>Confirm password<input required type="password" minLength={6} maxLength={12} value={form.confirmPassword} onChange={(event) => setField("confirmPassword", event.target.value)} autoComplete="new-password" /></label>
                <div className="user-password-generate"><button type="button" onClick={() => {
                  const generated = generatePassword();
                  setField("password", generated);
                  setField("confirmPassword", generated);
                }}>Generate password</button><span>Generated only in this browser.</span></div>
              </div>
              {error ? <p className="user-alert is-error" role="alert">{error}</p> : null}
              <div className="user-dialog-actions">
                <button type="button" className="user-secondary-button" onClick={() => setFormOpen(false)}>Cancel</button>
                <button type="submit" className="user-primary-button" disabled={saving}>{saving ? "Submitting…" : editingRequest ? "Resubmit request" : <><Plus size={15} /> Submit request</>}</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
      <button type="button" className="user-icon-button user-refresh-button" onClick={() => void load()} aria-label="Refresh account data"><RefreshCw size={16} /></button>
    </section>
  );
}
