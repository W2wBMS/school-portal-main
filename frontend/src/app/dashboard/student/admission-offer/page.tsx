"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download, GraduationCap, LoaderCircle } from "lucide-react";
import { API_BASE } from "@/lib/config";

type AdmissionOffer = {
  fullName?: string;
  studentId?: string;
  email?: string;
  programme?: string;
  department?: string;
  level?: string;
  admissionOfferStatus?: "not_offered" | "pending" | "accepted";
  admissionOfferAcceptedAt?: string | null;
};

export default function AdmissionOfferPage() {
  const [offer, setOffer] = useState<AdmissionOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadOffer() {
      try {
        const token = localStorage.getItem("portal_token") || "";
        const response = await fetch(`${API_BASE}/v1/students/me`, {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to load your admission offer.");
        setOffer(data.profile || null);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Unable to load your admission offer.");
      } finally {
        setLoading(false);
      }
    }
    void loadOffer();
  }, []);

  async function acceptOffer() {
    if (!window.confirm("Accept this admission offer? This will record your decision on your student account.")) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const token = localStorage.getItem("portal_token") || "";
      const response = await fetch(`${API_BASE}/v1/students/me/admission-offer/accept`, {
        method: "POST",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to accept this offer.");
      setOffer(data.profile);
      setMessage(data.message || "Admission offer accepted successfully.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to accept this offer.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="admission-offer-loading" role="status"><LoaderCircle size={20} className="animate-spin" />Loading your offer…</div>;
  }

  if (error && !offer) {
    return <div className="admission-offer-feedback error" role="alert">{error}</div>;
  }

  if (!offer || offer.admissionOfferStatus === "not_offered") {
    return (
      <section className="admission-offer-empty">
        <GraduationCap size={28} />
        <h1>No admission offer available</h1>
        <p>If you believe this is an error, contact the Student Affairs office.</p>
      </section>
    );
  }

  const accepted = offer.admissionOfferStatus === "accepted";
  const acceptedDate = offer.admissionOfferAcceptedAt
    ? new Date(offer.admissionOfferAcceptedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <div className="admission-offer-page">
      <div className="admission-offer-toolbar">
        <div>
          <h1>Admission offer</h1>
          <p>Review your offer, record your decision, and keep a copy for your records.</p>
        </div>
        <button type="button" onClick={() => window.print()} className="admission-offer-download">
          <Download size={17} />Download offer (PDF)
        </button>
      </div>
      <p className="admission-offer-print-hint">Your browser&apos;s print window will open. Choose “Save as PDF” to download a copy.</p>

      {message && <div className="admission-offer-feedback success" role="status"><CheckCircle2 size={18} />{message}</div>}
      {error && <div className="admission-offer-feedback error" role="alert">{error}</div>}

      <article className="admission-offer-document">
        <header className="admission-offer-letterhead">
          <div className="admission-offer-seal" aria-hidden="true"><GraduationCap size={26} /></div>
          <div>
            <p>REGENT UNIVERSITY COLLEGE</p>
            <p>OF SCIENCE AND TECHNOLOGY</p>
          </div>
        </header>
        <div className="admission-offer-document-title">
          <span>ADMISSIONS</span>
          <h2>Offer of Admission</h2>
        </div>
        <p className="admission-offer-date">Portal copy generated {new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</p>
        <p>Dear <strong>{offer.fullName || "Student"}</strong>,</p>
        <p>
          We are pleased to confirm that an offer of admission has been made to you. The programme details associated with your student record are shown below.
        </p>
        <dl className="admission-offer-details">
          <div><dt>Student name</dt><dd>{offer.fullName || "—"}</dd></div>
          <div><dt>Student ID</dt><dd>{offer.studentId || "—"}</dd></div>
          <div><dt>Programme</dt><dd>{offer.programme || "—"}</dd></div>
          <div><dt>Department</dt><dd>{offer.department || "—"}</dd></div>
          <div><dt>Level</dt><dd>{offer.level || "—"}</dd></div>
          <div><dt>Student email</dt><dd>{offer.email || "—"}</dd></div>
        </dl>
        <p>Please keep this offer with your student records. For questions about your admission, contact Student Affairs.</p>
        <div className={`admission-offer-status ${accepted ? "is-accepted" : "is-pending"}`}>
          {accepted ? <CheckCircle2 size={18} /> : <span className="admission-offer-status-dot" />}
          <div>
            <strong>{accepted ? "Offer accepted" : "Awaiting your decision"}</strong>
            {acceptedDate && <span>Accepted on {acceptedDate}</span>}
          </div>
        </div>
        <footer>Generated from your student portal account. This copy reflects the admission details currently on file.</footer>
      </article>

      {!accepted && (
        <div className="admission-offer-acceptance">
          <div>
            <h2>Ready to accept?</h2>
            <p>Accepting records your decision on your student account.</p>
          </div>
          <button type="button" onClick={acceptOffer} disabled={saving} className="admission-offer-accept">
            {saving ? <LoaderCircle size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
            {saving ? "Recording decision…" : "ACCEPT OFFER"}
          </button>
        </div>
      )}
    </div>
  );
}
