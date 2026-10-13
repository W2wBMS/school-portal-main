"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { AlertCircle, History, RotateCw, Search, ShieldCheck } from "lucide-react";
import { API_BASE } from "@/lib/config";
import { parseJsonResponse } from "@/lib/api";

type AuditLog = {
  _id: string;
  action: string;
  entity: string;
  entityId: string;
  createdAt: string;
  actorId?: { fullName?: string; email?: string; role?: string } | null;
  metadata?: Record<string, unknown>;
};

function formatLabel(value: string) {
  return value.replace(/[._]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [entity, setEntity] = useState("all");

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("portal_token") || "";
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`${API_BASE}/users/audit-logs?limit=100`, {
        credentials: "include",
        headers,
      });

      const data = await parseJsonResponse<{ logs: AuditLog[] }>(response, "Unable to load audit logs.");
      setLogs(data.logs || []);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Unable to load audit logs.";
      if (
        message.includes("Authentication required") ||
        message.includes("permission") ||
        message.includes("token") ||
        message.includes("401") ||
        message.includes("Unauthorized")
      ) {
        setError(`${message} (Please sign out and sign back in to refresh your administrative access token).`);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const entities = useMemo(() => Array.from(new Set(logs.map((log) => log.entity))).sort(), [logs]);
  const visibleLogs = logs.filter((log) => {
    const matchesEntity = entity === "all" || log.entity === entity;
    const searchable = `${log.action} ${log.entity} ${log.actorId?.fullName || ""} ${log.actorId?.email || ""}`.toLowerCase();
    return matchesEntity && searchable.includes(query.trim().toLowerCase());
  });

  return <div className="pg-page">
    <section className="pg-card">
      <div className="pg-page-head"><p className="pg-eyebrow">System administration</p><h1 className="pg-page-title">Audit logs</h1><p className="pg-page-subtitle">A read-only record of staff and administrator activity. Student-performed actions are excluded.</p></div>
      <div className="audit-summary">
        <div><ShieldCheck size={19} /><span>Protected staff activity history</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <strong>{logs.length} recent events</strong>
          <button
            type="button"
            onClick={() => loadLogs()}
            disabled={loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "#fff",
              border: "1px solid #dcd7cf",
              borderRadius: 6,
              padding: "4px 10px",
              fontSize: 12,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            <RotateCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>
      {error && <div className="audit-alert"><div className="pg-alert pg-alert-error"><AlertCircle size={15} />{error}</div></div>}
      <div className="audit-filters"><label className="pg-label">Search<input value={query} onChange={(event) => setQuery(event.target.value)} className="pg-input" placeholder="Action, person, or email" /></label><label className="pg-label">Record type<select value={entity} onChange={(event) => setEntity(event.target.value)} className="pg-select"><option value="all">All record types</option>{entities.map((item) => <option key={item} value={item}>{formatLabel(item)}</option>)}</select></label></div>
      {loading ? <div className="pg-empty"><History size={36} /><p>Loading audit activity…</p></div> : visibleLogs.length === 0 ? <div className="pg-empty"><Search size={36} /><p>No audit events match this view.</p></div> : <div className="audit-log-list">{visibleLogs.map((log) => <article key={log._id} className="audit-log-row"><div className="audit-log-icon"><History size={17} /></div><div className="audit-log-main"><strong>{formatLabel(log.action)}</strong><p>{formatLabel(log.entity)} · {log.actorId?.fullName || "System process"}{log.actorId?.email ? ` (${log.actorId.email})` : ""}</p>{log.metadata && Object.keys(log.metadata).length > 0 && <span>{Object.entries(log.metadata).map(([key, value]) => `${formatLabel(key)}: ${String(value)}`).join(" · ")}</span>}</div><time dateTime={log.createdAt}>{new Date(log.createdAt).toLocaleString()}</time></article>)}</div>}
    </section>
  </div>;
}
