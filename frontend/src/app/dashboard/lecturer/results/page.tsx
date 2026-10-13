"use client";

import { useEffect, useState } from 'react';
import ResultApprovalStatus from '@/components/ResultApprovalStatus';

import { API_BASE } from '@/lib/config';
type Course = { _id: string; code: string; title: string; semester: string };
type Student = { _id: string; fullName: string; studentId?: string; email: string; level?: string };
type RosterEntry = { student: Student };
type ApprovalActor = string | { _id: string; fullName?: string; role?: string } | null;
type Result = { _id: string; score: number; grade: string; semester: string; approved: boolean; finalized: boolean; resultApprovals?: { hod?: ApprovalActor; lecturer?: ApprovalActor; admin?: ApprovalActor }; studentId?: Student; courseId?: Course; createdAt?: string };

function authHeaders(contentType = false) {
  return {
    ...(contentType ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${localStorage.getItem('portal_token') || ''}`,
  };
}

export default function LecturerResultsPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState('');
  const [roster, setRoster] = useState<Student[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [studentId, setStudentId] = useState('');
  const [score, setScore] = useState('');
  const [csvText, setCsvText] = useState('studentId,studentName,courseCode,score,level,semester,academicYear');
  const [csvFileName, setCsvFileName] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editingResultId, setEditingResultId] = useState<string | null>(null);
  const [editingScore, setEditingScore] = useState('');
  const [editingReason, setEditingReason] = useState('');
  const [approvingResultId, setApprovingResultId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [coursesResponse, resultsResponse] = await Promise.all([
          fetch(`${API_BASE}/portal/courses`, { credentials: 'include', headers: authHeaders() }),
          fetch(`${API_BASE}/portal/results`, { credentials: 'include', headers: authHeaders() }),
        ]);
        const coursesData = await coursesResponse.json();
        const resultsData = await resultsResponse.json();
        if (!coursesResponse.ok || !resultsResponse.ok) throw new Error('Unable to load your assigned courses and results.');
        const assigned = coursesData.courses || [];
        setCourses(assigned);
        setResults(resultsData.results || []);
        if (assigned.length) setCourseId(assigned[0]._id);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Unable to load your results workspace.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    if (!courseId) {
      setRoster([]);
      return;
    }
    let cancelled = false;
    async function loadRoster() {
      setLoadingRoster(true);
      setError('');
      try {
        const response = await fetch(`${API_BASE}/portal/courses/${courseId}/roster`, { credentials: 'include', headers: authHeaders() });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Unable to load approved course roster.');
        if (!cancelled) setRoster((data.roster || []).map((entry: RosterEntry) => entry.student));
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Unable to load approved course roster.');
      } finally {
        if (!cancelled) setLoadingRoster(false);
      }
    }
    loadRoster();
    return () => { cancelled = true; };
  }, [courseId]);

  async function refreshResults() {
    const response = await fetch(`${API_BASE}/portal/results`, { credentials: 'include', headers: authHeaders() });
    const data = await response.json();
    if (response.ok) setResults(data.results || []);
  }

  async function submitResult(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    setSaving(true);
    try {
      const selectedCourse = courses.find((course) => course._id === courseId);
      const student = roster.find((row) => row._id === studentId);
      const response = await fetch(`${API_BASE}/portal/results`, {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(true),
        body: JSON.stringify({ studentId, courseId, score: Number(score), semester: selectedCourse?.semester, level: student?.level }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to submit result.');
      setResults((current) => [data.result, ...current]);
      setStudentId('');
      setScore('');
      setMessage('Result submitted for academic approval. It will not appear in the student portal until approved.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to submit result.');
    } finally {
      setSaving(false);
    }
  }

  async function importResults(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/portal/results/import`, {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(true),
        body: JSON.stringify({ csv: csvText }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to import result records.');
      setMessage(data.message || 'Result rows submitted for academic approval.');
      await refreshResults();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to import result records.');
    } finally {
      setSaving(false);
    }
  }

  function startEditResult(result: Result) {
    setEditingResultId(result._id);
    setEditingScore(String(result.score ?? 0));
    setEditingReason('');
    setError('');
    setMessage('');
  }

  function cancelEditResult() {
    setEditingResultId(null);
    setEditingScore('');
    setEditingReason('');
  }

  async function saveEditResult(result: Result) {
    try {
      const nextScore = Number(editingScore);
      if (!Number.isFinite(nextScore) || nextScore < 0 || nextScore > 100) {
        throw new Error('Score must be between 0 and 100.');
      }
      if (result.finalized && !editingReason.trim()) {
        throw new Error('Enter a reason for correcting this finalized result.');
      }

      const response = await fetch(`${API_BASE}/portal/results/${result._id}${result.finalized ? '/correct' : ''}`, {
        method: result.finalized ? 'POST' : 'PATCH',
        credentials: 'include',
        headers: authHeaders(true),
        body: JSON.stringify(result.finalized ? { score: nextScore, reason: editingReason.trim() } : { score: nextScore }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to update this result.');

      setResults((current) => current.map((item) => item._id === result._id ? { ...item, ...data.result } : item));
      cancelEditResult();
      setMessage(result.finalized ? 'Result corrected and re-submitted for all required approvals.' : 'Result updated and re-queued for the required approvals.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update this result.');
    }
  }

  async function approveResult(result: Result) {
    setApprovingResultId(result._id);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`${API_BASE}/portal/results/${result._id}/approve`, {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(true),
        body: JSON.stringify({ approvalType: 'lecturer' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to approve this result.');
      setResults((current) => current.map((item) => item._id === result._id ? data.result : item));
      setMessage(data.complete ? 'All approvals are complete. The result is published.' : 'Lecturer approval recorded. The result is waiting for the HOD and Admin approvals.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to approve this result.');
    } finally {
      setApprovingResultId(null);
    }
  }

  async function readCsvFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    setCsvText(await file.text());
  }

  const courseResults = results.filter((result) => (typeof result.courseId === 'object' ? result.courseId?._id : result.courseId) === courseId);
  const pendingCount = courseResults.filter((result) => !result.approved).length;

  return (
    <div className="space-y-6 rounded-[28px] bg-[#f8fafc] p-6 ring-1 ring-slate-200">
      <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="muted-kicker">Assessment workspace</p><h2 className="mt-2 text-2xl font-bold text-[#11222d]">Course results</h2><p className="mt-2 text-sm text-slate-500">Submit results for your assigned courses. Academic staff approval is required before publication.</p></div><div className="rounded-xl bg-[#fff8e9] px-4 py-3"><span className="text-xs text-[#8a6a2f]">Pending approval</span><strong className="ml-3 text-xl text-[#8a6a2f]">{pendingCount}</strong></div></header>
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}

      <div><label htmlFor="results-course" className="mb-1 block text-sm font-medium text-slate-700">Assigned course</label><select id="results-course" value={courseId} onChange={(event) => setCourseId(event.target.value)} disabled={loading || !courses.length} className="input-field w-full sm:max-w-xl"><option value="">{loading ? 'Loading courses...' : 'No assigned courses'}</option>{courses.map((course) => <option key={course._id} value={course._id}>{course.code} — {course.title}</option>)}</select></div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <h3 className="text-lg font-bold text-[#11222d]">Enter a result</h3>
          <form onSubmit={submitResult} className="mt-4 space-y-4">
            <div><label htmlFor="result-student" className="mb-1 block text-sm font-medium text-slate-700">Approved course roster</label><select id="result-student" required value={studentId} onChange={(event) => setStudentId(event.target.value)} disabled={!courseId || loadingRoster} className="input-field w-full"><option value="">{loadingRoster ? 'Loading roster...' : roster.length ? 'Select student' : 'No approved students'}</option>{roster.map((student) => <option key={student._id} value={student._id}>{student.fullName} · {student.studentId || student.email}</option>)}</select></div>
            <div><label htmlFor="result-score" className="mb-1 block text-sm font-medium text-slate-700">Score (0 to 100)</label><input id="result-score" required type="number" min="0" max="100" step="0.01" value={score} onChange={(event) => setScore(event.target.value)} className="input-field w-full" /></div>
            <button disabled={saving || !courseId || !roster.length} className="rounded-lg bg-[#0d5a4d] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Submitting...' : 'Submit for approval'}</button>
          </form>
        </section>

        <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <h3 className="text-lg font-bold text-[#11222d]">Upload results CSV</h3>
          <p className="mt-1 text-sm text-slate-500">Rows for courses not assigned to you or students outside the approved roster are skipped.</p>
          <form onSubmit={importResults} className="mt-4 space-y-3">
            <input type="file" accept=".csv,text/csv" onChange={readCsvFile} className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-[#0d5a4d] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white" />
            {csvFileName && <p className="text-xs text-slate-500">{csvFileName}</p>}
            <textarea aria-label="Results CSV contents" value={csvText} onChange={(event) => setCsvText(event.target.value)} rows={6} className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm" />
            <button disabled={saving || !courseId} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-[#11222d] disabled:opacity-50">{saving ? 'Uploading...' : 'Submit CSV for approval'}</button>
          </form>
        </section>
      </div>

      <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <h3 className="text-lg font-bold text-[#11222d]">Recent course results</h3>
        <div className="mt-4 space-y-2">
          {courseResults.length === 0 ? <p className="text-sm text-slate-500">No results submitted for this course yet.</p> : courseResults.map((result) => <div key={result._id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#f8fafc] p-3"><div><strong className="text-sm text-[#11222d]">{result.studentId?.fullName || 'Student'}</strong><p className="text-xs text-slate-500">{result.semester} · {result.grade}</p></div><div className="flex items-center gap-3"><div className="flex items-center gap-2">
            {editingResultId === result._id ? (
              <>
                <input aria-label={`Edit score for ${result.studentId?.fullName || 'student'}`} type="number" min="0" max="100" step="0.01" value={editingScore} onChange={(event) => setEditingScore(event.target.value)} className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
                {result.finalized && <input aria-label="Correction reason" value={editingReason} onChange={(event) => setEditingReason(event.target.value)} placeholder="Correction reason" className="w-40 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />}
                <button type="button" onClick={() => saveEditResult(result)} className="rounded-lg bg-[#0d5a4d] px-2.5 py-1.5 text-xs font-semibold text-white">Save</button>
                <button type="button" onClick={cancelEditResult} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700">Cancel</button>
              </>
            ) : (
              <strong className="text-[#0d5a4d]">{result.score}</strong>
            )}
          </div><div className="flex flex-col items-start gap-2 sm:items-end"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${result.approved ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{result.approved ? 'Published' : 'Pending approval'}</span><ResultApprovalStatus approvals={result.resultApprovals} /></div>{editingResultId !== result._id && <div className="flex flex-wrap items-center gap-2">{!result.finalized && !result.resultApprovals?.lecturer && <button type="button" disabled={approvingResultId === result._id} onClick={() => approveResult(result)} className="rounded-lg bg-[#0d5a4d] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">{approvingResultId === result._id ? 'Approving...' : 'Approve'}</button>}<button type="button" onClick={() => startEditResult(result)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#11222d] transition hover:border-[#0d5a4d] hover:text-[#0d5a4d]">{result.finalized ? 'Correct score' : 'Edit score'}</button></div>}</div></div>)}
        </div>
      </section>
    </div>
  );
}
