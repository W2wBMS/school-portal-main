"use client";

import { useEffect, useState } from 'react';

import { API_BASE } from '@/lib/config';
type Lecturer = { _id: string; fullName: string; email: string; role: string; status: string };
type Course = { _id: string; code: string; title: string; credits: number; department: string; semester: string; scheduleDay?: string; startTime?: string; endTime?: string; room?: string; lecturerId?: { _id: string; fullName: string; email: string } | string | null };

export default function AdminCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [form, setForm] = useState({ code: '', title: '', credits: '3', department: 'Agronomy', semester: 'Semester 1', scheduleDay: '', startTime: '', endTime: '', room: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [csvText, setCsvText] = useState('code,title,credits,department,semester,scheduleDay,startTime,endTime,room\nAGR101,Introduction to Agronomy,3,Agronomy,Semester 1,Monday,09:00,10:00,Main Hall');
  const [csvFileName, setCsvFileName] = useState('');
  const [isImportingCsv, setIsImportingCsv] = useState(false);

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('portal_token') || ''}` };

  useEffect(() => {
    async function loadCourses() {
      try {
        const [response, usersResponse] = await Promise.all([fetch(`${API_BASE}/portal/courses`, {
          credentials: 'include',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('portal_token') || ''}`,
          },
        }), fetch(`${API_BASE}/users`, {
          credentials: 'include',
          headers: { Authorization: `Bearer ${localStorage.getItem('portal_token') || ''}` },
        })]);

        if (response.ok) {
          const data = await response.json();
          setCourses(data.courses || []);
        }
        if (usersResponse.ok) {
          const data = await usersResponse.json();
          setLecturers((data.users || []).filter((user: Lecturer) => user.role === 'lecturer' && user.status === 'active'));
        }
      } catch (reason) {
        setMessage(reason instanceof Error ? reason.message : 'Unable to load courses.');
      }
    }

    loadCourses();
  }, []);

  async function saveCourse(event: React.FormEvent) {
    event.preventDefault();
    const isEditing = Boolean(editingId && editingId !== 'new');
    const response = await fetch(`${API_BASE}/portal/courses${isEditing ? `/${editingId}` : ''}`, {
      method: isEditing ? 'PATCH' : 'POST', credentials: 'include', headers, body: JSON.stringify({ ...form, credits: Number(form.credits) }),
    });
    if (response.ok) {
      const data = await response.json();
      setCourses((current) => editingId ? current.map((course) => course._id === editingId ? data.course : course) : [data.course, ...current]);
      setForm({ code: '', title: '', credits: '3', department: 'Agronomy', semester: 'Semester 1', scheduleDay: '', startTime: '', endTime: '', room: '' });
      setEditingId(null);
      setMessage('Course saved.');
    } else setMessage((await response.json()).message || 'Unable to save course.');
  }

  async function deleteCourse(id: string) {
    if (!window.confirm('Delete this course?')) return;
    const response = await fetch(`${API_BASE}/portal/courses/${id}`, { method: 'DELETE', credentials: 'include', headers });
    if (response.ok) setCourses((current) => current.filter((course) => course._id !== id));
  }

  async function assignLecturer(courseId: string, lecturerId: string) {
    setMessage('');
    const response = await fetch(`${API_BASE}/portal/courses/${courseId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers,
      body: JSON.stringify({ lecturerId: lecturerId || null }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.message || 'Unable to assign lecturer.');
      return;
    }
    setCourses((current) => current.map((course) => course._id === courseId ? data.course : course));
    setMessage('Course lecturer assignment saved.');
  }

  async function importCoursesCsv(event?: React.FormEvent, sourceCsv = csvText) {
    event?.preventDefault();
    if (!sourceCsv.trim()) {
      setMessage('Select a CSV file first.');
      return;
    }

    setIsImportingCsv(true);
    try {
      const response = await fetch(`${API_BASE}/portal/courses/import`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('portal_token') || ''}`,
        },
        body: JSON.stringify({ csv: sourceCsv }),
      });

      const data = await response.json();
      if (!response.ok) {
        setMessage(data.message || 'Unable to import courses CSV.');
        return;
      }

      setMessage(data.message || 'Courses imported successfully.');
      const refreshed = await fetch(`${API_BASE}/portal/courses`, { credentials: 'include', headers });
      if (refreshed.ok) {
        const next = await refreshed.json();
        setCourses(next.courses || []);
      }
    } finally {
      setIsImportingCsv(false);
    }
  }

  async function handleCourseCsvFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setCsvText(content);
    setCsvFileName(file.name);
    setMessage('CSV loaded. Saving course list...');
    await importCoursesCsv(undefined, content);
  }

  const assignedCount = courses.filter((course) => Boolean(course.lecturerId)).length;
  const lecturerLoads = lecturers.map((lecturer) => ({ ...lecturer, courseCount: courses.filter((course) => (typeof course.lecturerId === 'object' ? course.lecturerId?._id : course.lecturerId) === lecturer._id).length })).sort((left, right) => right.courseCount - left.courseCount || left.fullName.localeCompare(right.fullName));

  return (
    <div className="rounded-[28px] bg-[#f8fafc] p-6 ring-1 ring-slate-200">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div><p className="muted-kicker">Academic operations</p><h2 className="mt-2 text-2xl font-bold text-[#11222d]">Course catalogue</h2><p className="mt-2 text-sm text-slate-500">Keep course offerings clear, current, and assignable.</p></div>
        <button onClick={() => setEditingId('new')} className="w-full rounded-lg bg-[#0d5a4d] px-4 py-2 text-sm font-semibold text-white sm:w-auto">Add course</button>
      </div>

      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search course code or title" className="input-field mb-5" />

      <section className="mb-6 rounded-xl bg-white p-4 ring-1 ring-slate-200">
        <div className="grid gap-3 sm:grid-cols-3"><div><span className="text-sm text-slate-500">Active lecturers</span><strong className="mt-1 block text-xl text-[#11222d]">{lecturers.length}</strong></div><div><span className="text-sm text-slate-500">Courses assigned</span><strong className="mt-1 block text-xl text-[#0d5a4d]">{assignedCount}</strong></div><div><span className="text-sm text-slate-500">Unassigned courses</span><strong className="mt-1 block text-xl text-[#8a6a2f]">{courses.length - assignedCount}</strong></div></div>
        <div className="mt-4 border-t border-slate-100 pt-3"><h3 className="text-sm font-semibold text-[#11222d]">Lecturer workload</h3><div className="mt-2 flex flex-wrap gap-2">{lecturerLoads.length ? lecturerLoads.map((lecturer) => <span key={lecturer._id} className="rounded-lg bg-[#f8fafc] px-3 py-2 text-sm text-slate-700">{lecturer.fullName} <strong className="ml-1 text-[#0d5a4d]">{lecturer.courseCount}</strong></span>) : <span className="text-sm text-slate-500">No active lecturer accounts.</span>}</div></div>
      </section>

      <form onSubmit={importCoursesCsv} className="mb-6 rounded-xl bg-white p-4 ring-1 ring-slate-200">
        <label className="mb-2 block text-sm font-semibold text-slate-700">Upload course CSV</label>
        <div className="mb-3 flex flex-col gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
          <input type="file" accept=".csv,text/csv" onChange={handleCourseCsvFileChange} className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-[#0d5a4d] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white" />
          {csvFileName && <span className="text-xs text-slate-500">Selected file: {csvFileName}</span>}
        </div>
        <textarea value={csvText} onChange={(event) => setCsvText(event.target.value)} rows={6} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="code,title,credits,department,semester" />
        <div className="mt-3 flex justify-end">
          <button type="submit" disabled={isImportingCsv} className="rounded-lg bg-[#0d5a4d] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
            {isImportingCsv ? 'Saving...' : 'Save course list'}
          </button>
        </div>
      </form>

      {(editingId === 'new' || editingId) && <form onSubmit={saveCourse} className="mb-6 grid gap-3 rounded-xl bg-white p-4 ring-1 ring-slate-200 md:grid-cols-4">
        {(['code', 'title', 'credits', 'department', 'semester'] as const).map((field) => <input key={field} required={field !== 'department' && field !== 'semester'} value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} placeholder={field} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />)}
        <select aria-label="Class day" value={form.scheduleDay} onChange={(event) => setForm({ ...form, scheduleDay: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="">No scheduled day</option>{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => <option key={day}>{day}</option>)}</select>
        <input aria-label="Class start time" type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        <input aria-label="Class end time" type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        <input aria-label="Class room" value={form.room} onChange={(event) => setForm({ ...form, room: event.target.value })} placeholder="Room / location" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        <div className="flex flex-wrap gap-2 md:col-span-4"><button className="w-full rounded-lg bg-[#0d5a4d] px-4 py-2 text-sm font-semibold text-white sm:w-auto">Save</button><button type="button" onClick={() => { setEditingId(null); setMessage(''); }} className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm sm:w-auto">Cancel</button>{message && <span className="py-2 text-sm text-slate-500">{message}</span>}</div>
      </form>}

      <div className="space-y-3">
        {courses.filter((course) => `${course.code} ${course.title}`.toLowerCase().includes(query.toLowerCase())).length === 0 ? <p className="text-slate-500">No matching courses available.</p> : courses.filter((course) => `${course.code} ${course.title}`.toLowerCase().includes(query.toLowerCase())).map((course) => (
          <div key={course._id} className="flex flex-col gap-3 rounded-xl bg-white p-4 ring-1 ring-slate-200 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-semibold text-[#11222d]">{course.code} — {course.title}</div>
              <div className="text-sm text-slate-500">{course.department} • {course.semester} • {typeof course.lecturerId === 'object' && course.lecturerId ? course.lecturerId.fullName : 'No lecturer assigned'}</div>
              <div className="text-sm text-slate-500">{course.scheduleDay && course.startTime && course.endTime ? `${course.scheduleDay}, ${course.startTime}–${course.endTime}${course.room ? ` · ${course.room}` : ''}` : 'No timetable entry'}</div>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <label className="flex w-full items-center gap-2 text-sm text-slate-600 sm:w-auto">
                <span className="sr-only">Lecturer for {course.code}</span>
                <select aria-label={`Assign lecturer to ${course.code}`} disabled={lecturers.length === 0} value={typeof course.lecturerId === 'object' && course.lecturerId ? course.lecturerId._id : typeof course.lecturerId === 'string' ? course.lecturerId : ''} onChange={(event) => assignLecturer(course._id, event.target.value)} className="w-full min-w-[190px] rounded-lg border border-slate-200 px-3 py-2 text-sm sm:w-auto">
                  <option value="">Unassigned</option>
                  {lecturers.map((lecturer) => <option key={lecturer._id} value={lecturer._id}>{lecturer.fullName} · {lecturer.email}</option>)}
                </select>
              </label>
              <button onClick={() => { setEditingId(course._id); setForm({ code: course.code, title: course.title, credits: String(course.credits), department: course.department, semester: course.semester, scheduleDay: course.scheduleDay || '', startTime: course.startTime || '', endTime: course.endTime || '', room: course.room || '' }); }} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium sm:w-auto">Edit</button>
              <button onClick={() => deleteCourse(course._id)} className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 sm:w-auto">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
