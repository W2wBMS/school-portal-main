"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, CalendarDays, CircleDollarSign, Clock3, FileText, GraduationCap, MapPin } from "lucide-react";
import { API_BASE } from "@/lib/config";
import { fetchStudentOverview, type StudentOverview } from "@/lib/portal";

type TimetableCourse = {
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

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const courseTones = ["indigo", "emerald", "amber"] as const;

export default function StudentDashboardPage() {
  const [overview, setOverview] = useState<StudentOverview | null>(null);
  const [courses, setCourses] = useState<TimetableCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("portal_token") || "";
    Promise.all([
      fetchStudentOverview(),
      fetch(`${API_BASE}/v1/timetable`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to load your timetable.");
        return data;
      }),
    ])
      .then(([studentOverview, timetable]) => {
        setOverview(studentOverview);
        setCourses(timetable.courses || []);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load dashboard data."))
      .finally(() => setLoading(false));
  }, []);

  const profile = overview?.profile;
  const name = profile?.fullName?.split(" ")[0] || "Student";
  const greeting = new Date().getHours() < 12
    ? "Good morning"
    : new Date().getHours() < 17
      ? "Good afternoon"
      : "Good evening";
  const formattedDate = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const scheduledCourses = [...courses]
    .filter((course) => course.scheduleDay && course.startTime && course.endTime)
    .sort((left, right) =>
      weekdays.indexOf(left.scheduleDay || "") - weekdays.indexOf(right.scheduleDay || "")
      || (left.startTime || "").localeCompare(right.startTime || "")
    );
  const attendanceAverage = overview?.attendance.length
    ? `${Math.round(overview.attendance.reduce((sum, item) => sum + Number(item.percentage || 0), 0) / overview.attendance.length)}%`
    : "—";
  const cgpa = overview?.results.length ? (profile?.cgpa ?? 0).toFixed(2) : "—";
  const feeBalance = overview?.feeLedger.length
    ? `GH₵ ${overview.feeLedger.reduce((sum, fee) => sum + Number(fee.balance || 0), 0).toLocaleString()}`
    : "No statement";

  return (
    <div className="student-home">
      <section className="home-heading">
        <div>
          <p className="eyebrow">{formattedDate}</p>
          <h1>{greeting}, {name}</h1>
          <p>Your academic information and approved course schedule.</p>
        </div>
        <div className="quick-actions">
          <Link href="/dashboard/student/transcript"><FileText size={17} />Request transcript</Link>
          <Link className="primary-action hover-lift" href="/dashboard/student/fees"><CircleDollarSign size={17} />View fees</Link>
        </div>
      </section>

      {error && <div className="inline-notice" role="alert">{error} Refresh the page to try again.</div>}

      {(profile?.admissionOfferStatus === "pending" || profile?.admissionOfferStatus === "accepted") && (
        <section className="admission-offer-banner" aria-label="Admission offer">
          <div>
            <span className="admission-offer-mark"><GraduationCap size={20} /></span>
            <div>
              <h2>{profile.admissionOfferStatus === "pending" ? "Your admission offer is ready" : "Your admission offer is accepted"}</h2>
              <p>{profile.admissionOfferStatus === "pending" ? "Review your offer, accept your place, and save a copy for your records." : "Your accepted offer is available to view and save from your portal."}</p>
            </div>
          </div>
          <Link href="/dashboard/student/admission-offer">
            {profile.admissionOfferStatus === "pending" ? "Review offer" : "View offer"}
            <ArrowRight size={16} />
          </Link>
        </section>
      )}

      <section className="schedule-card">
        <div className="schedule-label">
          <span><CalendarDays size={18} />My scheduled classes</span>
          <Link href="/dashboard/student/timetable">Full timetable <ArrowRight size={16} /></Link>
        </div>
        {loading ? (
          <p className="dashboard-empty-state">Loading your approved timetable…</p>
        ) : scheduledCourses.length ? (
          <div className="schedule-items">
            {scheduledCourses.map((course) => (
              <article className="schedule-class" key={course._id}>
                <div className="time"><strong>{course.startTime}</strong><span>{course.endTime}</span></div>
                <div className="class-marker" aria-hidden="true"><i /><span /></div>
                <div className="class-info">
                  <div><b>{course.title}</b><span>{course.scheduleDay} · {course.code}</span></div>
                  <p><MapPin size={14} />{course.room || "Room to be announced"}</p>
                </div>
                {course.lecturerId?.fullName && <span className="schedule-instructor">{course.lecturerId.fullName}</span>}
              </article>
            ))}
          </div>
        ) : (
          <p className="dashboard-empty-state">
            {courses.length
              ? "Your approved courses do not have class times yet."
              : "No approved course schedule yet. Courses will appear here after your registration is approved."}
          </p>
        )}
      </section>

      <div className="dashboard-columns">
        <section className="courses-section">
          <div className="section-heading">
            <div><p className="eyebrow">Approved registration</p><h2>My courses</h2></div>
            <Link href="/dashboard/student/registration">Registration <ArrowRight size={16} /></Link>
          </div>
          {loading ? (
            <p className="dashboard-empty-state">Loading your courses…</p>
          ) : courses.length ? (
            <div className="course-grid">
              {courses.map((course, index) => {
                const result = overview?.results.find((row) => (
                  row.courseId?._id === course._id || row.courseId?.code === course.code
                ));
                return (
                  <article className="course-card" key={course._id}>
                    <div className={`course-art ${courseTones[index % courseTones.length]}`}><BookOpen size={23} /><span>{course.code}</span></div>
                    <div className="course-content">
                      <div><span className="course-code">{course.credits} credits · {course.semester}</span><h3>{course.title}</h3><p>{course.lecturerId?.fullName || "Instructor not assigned"}</p></div>
                      <div className="course-metrics">
                        <span>{result ? <><b>{result.score}%</b> approved result</> : "No approved result yet"}</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="dashboard-empty-state">
              No courses are attached to an approved registration yet. <Link href="/dashboard/student/registration">View registration</Link>
            </p>
          )}
        </section>

        <aside className="tasks-section">
          <div className="section-heading">
            <div><p className="eyebrow">Assignments and deadlines</p><h2>Upcoming tasks</h2></div>
          </div>
          <div className="dashboard-task-empty">
            <Clock3 size={20} />
            <p>No upcoming tasks have been assigned.</p>
          </div>
          <Link className="all-tasks" href="/dashboard/student/support">Contact student support <ArrowRight size={16} /></Link>
        </aside>
      </div>

      <section className="stats-strip" aria-label="Academic summary">
        <article><Clock3 size={20} /><div><span>Attendance average</span><b>{attendanceAverage}</b></div></article>
        <article><GraduationCap size={20} /><div><span>Current CGPA</span><b>{cgpa}</b></div></article>
        <article><CircleDollarSign size={20} /><div><span>Outstanding balance</span><b>{feeBalance}</b></div><Link href="/dashboard/student/fees" aria-label="View fees"><ArrowRight size={17} /></Link></article>
      </section>
    </div>
  );
}
