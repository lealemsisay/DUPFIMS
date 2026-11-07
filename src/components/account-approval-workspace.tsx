"use client";

import { RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { RowActionMenu } from "./row-action-menu";

type AccountRequest = {
  id: string;
  username: string;
  email: string;
  fullName: string;
  phoneNumber: string | null;
  role: { id: string; name: string };
  campus: { id: string; name: string; code: string } | null;
  organizationalUnit: { id: string; name: string } | null;
  status: string;
  decisionReason: string | null;
  createdAt: string;
  requester: { id: string; username: string; fullName: string; email: string | null };
  decisions: Array<{
    id: string;
    action: string;
    reason: string;
    createdAt: string;
    actor: { id: string; username: string; fullName: string };
  }>;
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

export function AccountApprovalWorkspace() {
  const [requests, setRequests] = useState<AccountRequest[]>([]);
  const [history, setHistory] = useState<AccountRequest[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await requestJson<{ requests: AccountRequest[] }>(
        "/api/account-requests",
      );
      setRequests(
        result.requests.filter((request) => request.status === "PENDING_APPROVAL"),
      );
      setHistory(
        result.requests.filter((request) => request.status !== "PENDING_APPROVAL"),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load pending requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function decide(
    request: AccountRequest,
    decision: "APPROVED" | "REJECTED" | "RETURNED_FOR_CORRECTION",
  ) {
    const reason = reasons[request.id]?.trim() ?? "";
    if (reason.length < 2) {
      setError("Enter a reason of at least two characters before recording a decision.");
      return;
    }
    if (
      decision === "APPROVED" &&
      !window.confirm(`Approve ${request.fullName}'s ${request.role.name} account request?`)
    ) {
      return;
    }
    if (
      decision === "REJECTED" &&
      !window.confirm(`Reject ${request.fullName}'s ${request.role.name} account request?`)
    ) {
      return;
    }
    setSavingId(request.id);
    setError("");
    setNotice("");
    try {
      await requestJson(
        `/api/account-requests/${encodeURIComponent(request.id)}/decision`,
        {
          method: "POST",
          body: JSON.stringify({ decision, reason }),
        },
      );
      setNotice(
        decision === "APPROVED"
          ? "Request approved; the account is now active and must change its initial password."
          : decision === "REJECTED"
            ? "Request rejected. The reason was recorded and the requester was notified."
            : "Request returned for correction. The requester was notified.",
      );
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to record the decision.");
    } finally {
      setSavingId("");
    }
  }

  return (
    <section className="user-management" aria-labelledby="account-approvals-title">
      <div className="dashboard-welcome user-management-heading">
        <div>
          <h1 id="account-approvals-title">Account Approval</h1>
          <p>Review proposed account details before creating an active account.</p>
        </div>
        <button type="button" className="user-icon-button" onClick={() => void load()} aria-label="Refresh pending requests">
          <RefreshCw size={16} />
        </button>
      </div>

      {error ? <p className="user-alert is-error" role="alert">{error}</p> : null}
      {notice ? <p className="user-alert is-success" role="status">{notice}</p> : null}

      <section className="user-list-card" aria-label="Pending account requests">
        {loading ? (
          <p className="user-table-message">Loading approval requests…</p>
        ) : requests.length === 0 ? (
          <div className="module-placeholder">
            <ShieldCheck aria-hidden="true" size={34} />
            <h2>No pending account requests</h2>
            <p>Submitted requests will appear here for your review.</p>
          </div>
        ) : (
          <div className="account-approval-list">
            {requests.map((request) => (
              <article className="account-approval-card" key={request.id}>
                <header>
                  <div>
                    <h2>{request.fullName}</h2>
                    <p>@{request.username} · {request.email}</p>
                  </div>
                  <span className="user-status user-status-pending_approval">PENDING APPROVAL</span>
                </header>
                <dl className="user-detail-grid">
                  <div><dt>Requested role</dt><dd>{request.role.name}</dd></div>
                  <div><dt>Phone</dt><dd>{request.phoneNumber ?? "—"}</dd></div>
                  <div><dt>Campus</dt><dd>{request.campus ? `${request.campus.name} (${request.campus.code})` : "—"}</dd></div>
                  <div><dt>Organizational unit</dt><dd>{request.organizationalUnit?.name ?? "—"}</dd></div>
                  <div><dt>Submitted by</dt><dd>{request.requester.fullName} (@{request.requester.username})</dd></div>
                  <div><dt>Submitted</dt><dd>{new Date(request.createdAt).toLocaleString()}</dd></div>
                </dl>
                <label className="account-approval-reason">
                  Decision reason
                  <textarea
                    required
                    minLength={2}
                    maxLength={1000}
                    value={reasons[request.id] ?? ""}
                    onChange={(event) =>
                      setReasons((current) => ({
                        ...current,
                        [request.id]: event.target.value,
                      }))
                    }
                    placeholder="Record the reason for approval, rejection, or return."
                  />
                </label>
                <RowActionMenu
                  label={`${request.fullName} account request`}
                  actions={[
                    {
                      label: "Approve account",
                      onSelect: () => void decide(request, "APPROVED"),
                      disabled: savingId === request.id,
                    },
                    {
                      label: "Reject request",
                      onSelect: () => void decide(request, "REJECTED"),
                      disabled: savingId === request.id,
                      destructive: true,
                    },
                    {
                      label: "Return for correction",
                      onSelect: () => void decide(request, "RETURNED_FOR_CORRECTION"),
                      disabled: savingId === request.id,
                    },
                  ]}
                />
                {request.decisions.length > 0 ? (
                  <details className="account-approval-history">
                    <summary>Request history</summary>
                    <ol className="user-history-list">
                      {request.decisions.map((decision) => (
                        <li key={decision.id}>
                          <strong>{decision.action.replaceAll("_", " ")}</strong>
                          <span>{decision.actor.fullName} (@{decision.actor.username})</span>
                          <time dateTime={decision.createdAt}>{new Date(decision.createdAt).toLocaleString()}</time>
                          <p>{decision.reason}</p>
                        </li>
                      ))}
                    </ol>
                  </details>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="user-list-card" aria-label="Previous account decisions">
        <h2 className="user-history-title">Previous decisions</h2>
        {loading ? (
          <p className="user-table-message">Loading decision history…</p>
        ) : history.length === 0 ? (
          <p className="user-table-message">No previous account decisions are recorded.</p>
        ) : (
          <div className="user-table-wrap">
            <table className="user-table">
              <thead>
                <tr>
                  <th scope="col">Proposed account</th>
                  <th scope="col">Role</th>
                  <th scope="col">Requester</th>
                  <th scope="col">Status / reason</th>
                  <th scope="col">Decision date</th>
                </tr>
              </thead>
              <tbody>
                {history.map((request) => (
                  <tr key={request.id}>
                    <td><strong>{request.fullName}</strong><span className="user-table-secondary">@{request.username} · {request.email}</span></td>
                    <td>{request.role.name}</td>
                    <td>{request.requester.fullName} (@{request.requester.username})</td>
                    <td><strong>{request.status.replaceAll("_", " ")}</strong><span className="user-table-secondary">{request.decisionReason}</span></td>
                    <td>{request.decisions.at(-1) ? new Date(request.decisions.at(-1)!.createdAt).toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
