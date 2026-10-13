"use client";

import { useEffect, useState } from 'react';

import { API_BASE } from '@/lib/config';

type Course = { _id: string; code: string; title: string; semester: string };
type Student = { _id: string; fullName: string; email: string; studentId?: string; programme?: string; level?: string };
type RosterEntry = { student: Student; attendance: { status: string } | null };
type AttendanceRow = { student: Student; status: string };

function localDateKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function authHeaders(contentType = false) {
  return {
    ...(contentType ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${localStorage.getItem('portal_token') || ''}`,
  };
}

export default function LecturerAttendancePage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState('');
  const [date, setDate] = useState(localDateKey);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [query, setQuery] = useState('');
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadCourses() {
      try {
        const response = await fetch(`${API_BASE}/portal/courses`, { credentials: 'include', headers: authHeaders() });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Unable to load assigned courses');
        const assigned = data.courses || [];
        setCourses(assigned);
        if (assigned.length) setCourseId(assigned[0]._id);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Unable to load assigned courses');
      } finally {
        setLoadingCourses(false);
      }
    }
    loadCourses();
  }, []);

  useEffect(() => {
    if (!courseId || !date) {
      setRows([]);
      return;
    }
    let cancelled = false;
    async function loadRoster() {
      setLoadingRoster(true);
      setError('');
      setMessage('');
      try {
        const response = await fetch(`${API_BASE}/portal/courses/${courseId}/roster?date=${encodeURIComponent(date)}`, { credentials: 'include', headers: authHeaders() });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Unable to load the approved class list');
        if (!cancelled) setRows((data.roster || []).map((entry: RosterEntry) => ({ student: entry.student, status: entry.attendance?.status || '' })));
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Unable to load the approved class list');
      } finally {
        if (!cancelled) setLoadingRoster(false);
      }
    }
    loadRoster();
    return () => { cancelled = true; };
  }, [courseId, date]);

  function setStatus(studentId: string, status: string) {
    setRows((current) => current.map((row) => row.student._id === studentId ? { ...row, status } : row));
  }

  async function saveAttendance(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (rows.some((row) => !row.status)) {
      setError('Choose an attendance status for every student before saving.');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/portal/attendance/session`, {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(true),
        body: JSON.stringify({ courseId, date, records: rows.map((row) => ({ studentId: row.student._id, status: row.status })) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to save attendance');
      setMessage(`Attendance saved for ${data.attendance.length} students in ${date}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save attendance');
    } finally {
      setSaving(false);
    }
  }

  const visibleRows = rows.filter((row) => `${row.student.fullName} ${row.student.studentId || ''} ${row.student.email}`.toLowerCase().includes(query.toLowerCase()));
  const complete = rows.length > 0 && rows.every((row) => row.status);

  return (
    <div className="space-y-5 rounded-[28px] bg-[#f8fafc] p-6 ring-1 ring-slate-200">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="muted-kicker">Class operations</p><h2 className="mt-2 text-2xl font-bold text-[#11222d]">Attendance register</h2><p className="mt-2 text-sm text-slate-500">Record attendance for students on your approved course rosters.</p></div>
        <div className="rounded-xl bg-[#e5f1ed] px-4 py-3 text-right"><span className="block text-xs text-[#4c756c]">Class size</span><strong className="text-2xl text-[#0d5a4d]">{rows.length}</strong></div>
      </header>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px_minmax(0,1fr)]">
        <div><label htmlFor="attendance-course" className="mb-1 block text-sm font-medium text-slate-700">Assigned course</label><select id="attendance-course" value={courseId} onChange={(event) => setCourseId(event.target.value)} disabled={loadingCourses || courses.length === 0} className="input-field w-full"><option value="">{loadingCourses ? 'Loading courses...' : 'No assigned courses'}</option>{courses.map((course) => <option key={course._id} value={course._id}>{course.code} — {course.title}</option>)}</select></div>
        <div><label htmlFor="attendance-date" className="mb-1 block text-sm font-medium text-slate-700">Class date</label><input id="attendance-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="input-field w-full" /></div>
        <div><label htmlFor="attendance-search" className="mb-1 block text-sm font-medium text-slate-700">Find student</label><input id="attendance-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or student ID" className="input-field w-full" /></div>
      </div>

      <form onSubmit={saveAttendance} className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3"><div><h3 className="font-bold text-[#11222d]">Class list</h3><p className="text-sm text-slate-500">Existing marks for the selected date are loaded for editing.</p></div><button disabled={saving || loadingRoster || !complete} className="rounded-lg bg-[#0d5a4d] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Saving...' : 'Save attendance'}</button></div>
        {loadingRoster ? <p className="p-5 text-sm text-slate-500">Loading approved roster...</p> : rows.length === 0 ? <p className="p-5 text-sm text-slate-500">No approved students are registered in this course.</p> : <div className="divide-y divide-slate-100">
          <div className="hidden grid-cols-[minmax(0,1fr)_150px_190px] gap-4 bg-[#f8fafc] px-4 py-2 text-xs font-semibold uppercase text-slate-500 sm:grid"><span>Student</span><span>Student ID</span><span>Attendance</span></div>
          {visibleRows.map((row) => <div key={row.student._id} className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_150px_190px] sm:items-center sm:gap-4"><div><div className="font-semibold text-[#11222d]">{row.student.fullName}</div><div className="text-xs text-slate-500">{row.student.programme || row.student.email}{row.student.level ? ` · Level ${row.student.level}` : ''}</div></div><div className="text-sm text-slate-600">{row.student.studentId || 'No student ID'}</div><select aria-label={`Attendance for ${row.student.fullName}`} required value={row.status} onChange={(event) => setStatus(row.student._id, event.target.value)} className="input-field"><option value="">Choose status</option><option value="present">Present</option><option value="absent">Absent</option><option value="late">Late</option></select></div>)}
          {visibleRows.length === 0 && <p className="p-4 text-sm text-slate-500">No students match this search.</p>}
        </div>}
      </form>
    </div>
  );
}
