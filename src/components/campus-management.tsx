"use client";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { RowActionMenu } from "./row-action-menu";

type Campus = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

async function campusRequest<T>(url: string, init?: RequestInit): Promise<T> {
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

export function CampusManagement() {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [activeCampus, setActiveCampus] = useState<Campus>();
  const [viewCampus, setViewCampus] = useState<Campus>();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadCampuses = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await campusRequest<{ campuses: Campus[] }>("/api/campuses");
      setCampuses(result.campuses);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load campuses.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadCampuses(), 0);
    return () => window.clearTimeout(timer);
  }, [loadCampuses]);

  function openCreate() {
    setActiveCampus(undefined);
    setCode("");
    setName("");
    setError("");
    setDialogOpen(true);
  }

  function openEdit(campus: Campus) {
    setActiveCampus(campus);
    setCode(campus.code);
    setName(campus.name);
    setError("");
    setDialogOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await campusRequest(
        activeCampus
          ? `/api/campuses/${encodeURIComponent(activeCampus.id)}`
          : "/api/campuses",
        {
          method: activeCampus ? "PUT" : "POST",
          body: JSON.stringify({ code, name }),
        },
      );
      setDialogOpen(false);
      setNotice(activeCampus ? "Campus information updated." : "Campus created.");
      await loadCampuses();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save campus.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(campus: Campus) {
    const nextActive = !campus.isActive;
    const operation = nextActive ? "activate" : "deactivate";
    if (
      !window.confirm(
        `Are you sure you want to ${operation} ${campus.name}? Historical student and case records will be retained.`,
      )
    ) {
      return;
    }
    setError("");
    setNotice("");
    try {
      await campusRequest(
        `/api/campuses/${encodeURIComponent(campus.id)}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ isActive: nextActive }),
        },
      );
      setNotice(`Campus ${nextActive ? "activated" : "deactivated"}. Historical records were retained.`);
      await loadCampuses();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update campus status.");
    }
  }

  return (
    <section className="user-management" aria-labelledby="campuses-title">
      <div className="dashboard-welcome user-management-heading">
        <div>
          <h1 id="campuses-title">Campus Management</h1>
          <p>Manage campus identifiers and status. Deactivation retains historical records.</p>
        </div>
        <button className="user-primary-button" type="button" onClick={openCreate}>
          <Plus size={16} aria-hidden="true" />
          Add campus
        </button>
      </div>

      {error && !dialogOpen ? <p className="user-alert is-error" role="alert">{error}</p> : null}
      {notice ? <p className="user-alert is-success" role="status">{notice}</p> : null}

      <section className="user-list-card" aria-label="Campus records">
        <div className="user-table-wrap">
          <table className="user-table campus-table">
            <thead>
              <tr>
                <th scope="col">Campus identifier</th>
                <th scope="col">Campus name</th>
                <th scope="col">Status</th>
                <th scope="col">Last modified</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="user-table-message">Loading campuses…</td></tr>
              ) : campuses.length === 0 ? (
                <tr><td colSpan={5} className="user-table-message">No campus records have been created.</td></tr>
              ) : campuses.map((campus) => (
                <tr key={campus.id}>
                  <td><strong>{campus.code}</strong></td>
                  <td>{campus.name}</td>
                  <td><span className={`user-status ${campus.isActive ? "user-status-active" : "user-status-inactive"}`}>{campus.isActive ? "ACTIVE" : "INACTIVE"}</span></td>
                  <td>{new Date(campus.updatedAt).toLocaleString()}</td>
                  <td>
                    <RowActionMenu
                      label={campus.name}
                      actions={[
                        {
                          label: "View campus",
                          onSelect: () => setViewCampus(campus),
                        },
                        {
                          label: "Edit campus",
                          onSelect: () => openEdit(campus),
                        },
                        {
                          label: campus.isActive ? "Deactivate campus" : "Activate campus",
                          onSelect: () => void toggleActive(campus),
                          destructive: campus.isActive,
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {dialogOpen ? (
        <div className="user-dialog-backdrop" onMouseDown={() => setDialogOpen(false)}>
          <section
            className="user-dialog campus-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="campus-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="user-dialog-header">
              <h2 id="campus-dialog-title">{activeCampus ? "Edit campus" : "Create campus"}</h2>
              <button type="button" className="user-icon-button" onClick={() => setDialogOpen(false)} aria-label="Close dialog">×</button>
            </header>
            <form className="user-form" onSubmit={submit}>
              <label>Campus identifier<input required minLength={2} maxLength={24} pattern="[A-Za-z0-9](?:[A-Za-z0-9_]|-)*" value={code} onChange={(event) => setCode(event.target.value)} /><span className="user-field-hint">2–24 characters; start with a letter or number, then use letters, numbers, underscores, or hyphens.</span></label>
              <label>Campus name<input required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label>
              {error ? <p className="user-alert is-error" role="alert">{error}</p> : null}
              <div className="user-dialog-actions">
                <button type="button" className="user-secondary-button" onClick={() => setDialogOpen(false)}>Cancel</button>
                <button type="submit" className="user-primary-button" disabled={saving}>{saving ? "Saving…" : activeCampus ? "Save changes" : "Create campus"}</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
      {viewCampus ? (
        <div className="user-dialog-backdrop" onMouseDown={() => setViewCampus(undefined)}>
          <section
            className="user-dialog campus-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="campus-view-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="user-dialog-header">
              <h2 id="campus-view-title">Campus details</h2>
              <button type="button" className="user-icon-button" onClick={() => setViewCampus(undefined)} aria-label="Close dialog">×</button>
            </header>
            <dl className="user-detail-grid campus-detail-grid">
              <div><dt>Campus identifier</dt><dd>{viewCampus.code}</dd></div>
              <div><dt>Campus name</dt><dd>{viewCampus.name}</dd></div>
              <div><dt>Status</dt><dd>{viewCampus.isActive ? "Active" : "Inactive"}</dd></div>
              <div><dt>Created</dt><dd>{new Date(viewCampus.createdAt).toLocaleString()}</dd></div>
              <div><dt>Last modified</dt><dd>{new Date(viewCampus.updatedAt).toLocaleString()}</dd></div>
            </dl>
            <div className="user-dialog-actions">
              <button type="button" className="user-secondary-button" onClick={() => setViewCampus(undefined)}>Close</button>
              <button type="button" className="user-primary-button" onClick={() => {
                const campus = viewCampus;
                setViewCampus(undefined);
                openEdit(campus);
              }}>Edit campus</button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
