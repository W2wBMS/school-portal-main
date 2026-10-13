"use client";

import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/config";

type Profile = { fullName?: string; email?: string; studentId?: string; programme?: string; department?: string; level?: string; hallResidence?: string; cgpa?: number; creditsCompleted?: number; feeBalance?: number; status?: string };

export default function StudentProfilePage() {
  const [profile, setProfile] = useState<Profile>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/v1/students/me`, { credentials: "include", headers: { Authorization: `Bearer ${localStorage.getItem("portal_token") || ""}` } })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.message); setProfile(data.profile || {}); })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load profile"));
  }, []);

  function update(key: keyof Profile, value: string) { setProfile((current) => ({ ...current, [key]: value })); }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setError(""); setMessage("");
    const response = await fetch(`${API_BASE}/v1/students/me`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("portal_token") || ""}` }, body: JSON.stringify(profile) });
    const data = await response.json();
    if (!response.ok) { setError(data.message || "Unable to update profile"); return; }
    setProfile(data.profile || profile); setMessage("Profile updated successfully.");
  }

  const fields: Array<[keyof Profile, string]> = [["fullName", "Full name"], ["programme", "Programme"], ["department", "Department"], ["level", "Level"], ["hallResidence", "Hall residence"]];
  const facts = [["Student ID", profile.studentId || "—"], ["Email", profile.email || "—"], ["Status", profile.status || "—"]];

  return <div className="pg-page">
    <section className="pg-card">
      <div className="pg-page-head"><p className="pg-eyebrow">Student record</p><h1 className="pg-page-title">My profile</h1><p className="pg-page-subtitle">Keep your academic and contact details up to date.</p></div>
      <div className="pg-form-section"><div className="profile-facts">{facts.map(([label, value]) => <div key={label}><span>{label}</span><strong className={label === "Status" ? "capitalize" : ""}>{value}</strong></div>)}</div></div>
      <form onSubmit={save} className="pg-form-section profile-form">{fields.map(([key, label]) => <label key={key} className="pg-label">{label}<input value={String(profile[key] || "")} onChange={(event) => update(key, event.target.value)} className="pg-input" /></label>)}<div className="profile-form-actions"><button className="pg-btn pg-btn-primary">Save profile</button>{message && <span className="pg-feedback success">{message}</span>}{error && <span className="pg-feedback error">{error}</span>}</div></form>
    </section>
    <section className="pg-stats profile-stats"><div className="pg-stat"><span className="pg-stat-label">Cumulative GPA</span><strong className="pg-stat-value">{profile.cgpa ?? "—"}</strong></div><div className="pg-stat"><span className="pg-stat-label">Credits completed</span><strong className="pg-stat-value">{profile.creditsCompleted ?? "—"}</strong></div><div className="pg-stat"><span className="pg-stat-label">Fee balance</span><strong className="pg-stat-value">GHS {profile.feeBalance ?? 0}</strong></div></section>
  </div>;
}
