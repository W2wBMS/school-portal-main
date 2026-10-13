"use client";

import { useEffect, useState } from 'react';

import { API_BASE } from '@/lib/config';
const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

type Course = {
  _id: string;
  code: string;
  title: string;
  credits: number;
  semester: string;
  scheduleDay?: string;
  startTime?: string;
  endTime?: string;
  room?: string;
  lecturerId?: { fullName?: string } | null;
};

export default function TimetableView({ audience }: { audience: 'student' | 'lecturer' | 'admin' }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [semester, setSemester] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadTimetable() {
      try {
        const response = await fetch(`${API_BASE}/v1/timetable`, {
          credentials: 'include',
          headers: { Authorization: `Bearer ${localStorage.getItem('portal_token') || ''}` },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Unable to load timetable.');
        setCourses(data.courses || []);
        setSemester(data.semester || '');
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Unable to load timetable.');
      } finally {
        setLoading(false);
      }
    }
    loadTimetable();
  }, []);

  const scheduledCourses = courses.filter((course) => course.scheduleDay && course.startTime && course.endTime)
    .sort((left, right) => weekdays.indexOf(left.scheduleDay || '') - weekdays.indexOf(right.scheduleDay || '') || (left.startTime || '').localeCompare(right.startTime || ''));
  const unscheduledCourses = courses.filter((course) => !course.scheduleDay || !course.startTime || !course.endTime);
  const heading = audience === 'student' ? 'My timetable' : audience === 'lecturer' ? 'Teaching timetable' : 'Academic timetable';

  return (
    <div className="space-y-5 rounded-[28px] bg-[#f8fafc] p-6 ring-1 ring-slate-200">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="muted-kicker">{semester || 'Academic schedule'}</p><h2 className="mt-2 text-2xl font-bold text-[#11222d]">{heading}</h2></div>
        <div className="rounded-xl bg-[#e5f1ed] px-4 py-3 text-right"><span className="block text-xs text-[#4c756c]">Courses</span><strong className="text-2xl text-[#0d5a4d]">{courses.length}</strong></div>
      </header>
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading ? <p className="rounded-xl bg-white p-5 text-sm text-slate-500">Loading timetable...</p> : courses.length === 0 ? <p className="rounded-xl bg-white p-5 text-sm text-slate-500">No courses are available for this timetable.</p> : (
        <>
          <section className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
            <div className="grid grid-cols-[100px_minmax(0,1fr)] border-b border-slate-100 bg-[#f5faf7] px-4 py-3 text-xs font-semibold uppercase text-slate-500 sm:grid-cols-[130px_minmax(0,1fr)_180px_150px]"><span>Day</span><span>Course</span><span>Time</span><span>Room</span></div>
            {scheduledCourses.length ? scheduledCourses.map((course) => <div key={course._id} className="grid grid-cols-[100px_minmax(0,1fr)] gap-x-3 gap-y-1 border-b border-slate-100 px-4 py-4 last:border-b-0 sm:grid-cols-[130px_minmax(0,1fr)_180px_150px] sm:items-center"><strong className="row-span-2 text-sm text-[#0d5a4d] sm:row-span-1">{course.scheduleDay}</strong><div><strong className="text-sm text-[#11222d]">{course.code} — {course.title}</strong>{audience !== 'lecturer' && course.lecturerId?.fullName && <p className="text-xs text-slate-500">{course.lecturerId.fullName}</p>}</div><span className="text-sm text-slate-600">{course.startTime}–{course.endTime}</span><span className="text-sm text-slate-600">{course.room || 'Room TBA'}</span></div>) : <p className="p-5 text-sm text-slate-500">No scheduled class times have been added yet.</p>}
          </section>
          {unscheduledCourses.length > 0 && <section className="rounded-xl bg-white p-5 ring-1 ring-slate-200"><h3 className="font-bold text-[#11222d]">Courses without a timetable entry</h3><div className="mt-3 divide-y divide-slate-100">{unscheduledCourses.map((course) => <div key={course._id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span className="font-medium text-[#11222d]">{course.code} — {course.title}</span><span className="text-slate-500">{course.semester}</span></div>)}</div></section>}
        </>
      )}
    </div>
  );
}