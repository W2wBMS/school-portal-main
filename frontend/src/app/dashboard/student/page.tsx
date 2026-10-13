"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, CalendarDays, ChevronRight, CircleDollarSign, Clock3, FileText, GraduationCap, MapPin, PlayCircle, Plus, ReceiptText, X } from "lucide-react";
import { fetchStudentOverview, type StudentOverview } from "@/lib/portal";

const courseFallback = [
  { code: "CS 301", title: "Database Systems", professor: "Dr. A. Mensah", grade: 86, progress: 72, tone: "indigo", schedule: "Mon & Wed 09:00 AM", room: "Science Block R2.14" },
  { code: "CS 315", title: "Software Engineering", professor: "Prof. E. Owusu", grade: 91, progress: 66, tone: "emerald", schedule: "Tue & Thu 11:15 AM", room: "Engineering Hall E-05" },
  { code: "MATH 241", title: "Discrete Mathematics", professor: "Dr. N. Asante", grade: 78, progress: 58, tone: "amber", schedule: "Fri 02:00 PM", room: "Lecture Theatre 4" },
];

export default function StudentDashboardPage() {
  const [overview, setOverview] = useState<StudentOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskCourse, setNewTaskCourse] = useState("Database Systems");
  const [selectedCourse, setSelectedCourse] = useState<(typeof courseFallback)[0] | null>(null);

  const [taskList, setTaskList] = useState([
    { id: 1, tag: "Assignment", title: "Database schema design", course: "Database Systems", due: "Due in 3 hours", tone: "indigo" },
    { id: 2, tag: "Quiz", title: "Week 5 knowledge check", course: "Discrete Mathematics", due: "Tomorrow", tone: "amber" },
    { id: 3, tag: "Tuition", title: "Semester fee balance", course: "Finance Office", due: "Due Oct 10", tone: "rose" },
    { id: 4, tag: "Form due", title: "Internship preference form", course: "Career Services", due: "Due Oct 15", tone: "emerald" },
  ]);

  useEffect(() => {
    fetchStudentOverview()
      .then(setOverview)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  const profile = overview?.profile;
  const resultCourses = overview?.results?.slice(0, 3).map((row, index) => ({
    code: row.courseId?.code || courseFallback[index].code,
    title: row.courseId?.title || courseFallback[index].title,
    professor: courseFallback[index].professor,
    grade: row.score || courseFallback[index].grade,
    progress: courseFallback[index].progress,
    tone: courseFallback[index].tone,
    schedule: courseFallback[index].schedule,
    room: courseFallback[index].room,
  })) || courseFallback;

  const name = profile?.fullName?.split(" ")[0] || "Alex";

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const formattedDate = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setTaskList((prev) => [
      {
        id: Date.now(),
        tag: "Task",
        title: newTaskTitle,
        course: newTaskCourse,
        due: "Due soon",
        tone: "indigo",
      },
      ...prev,
    ]);
    setNewTaskTitle("");
    setTaskModalOpen(false);
  };

  return <div className="student-home">
    <section className="home-heading">
      <div>
        <p className="eyebrow">{formattedDate}</p>
        <h1>{getGreeting()}, {name} <span>✦</span></h1>
        <p>Here&apos;s what&apos;s happening with your academic workspace today.</p>
      </div>
      <div className="quick-actions">
        <Link href="/dashboard/student/transcript"><FileText size={17} />Request transcript</Link>
        <Link className="primary-action hover-lift" href="/dashboard/student/fees"><CircleDollarSign size={17} />Pay balance</Link>
      </div>
    </section>

    {error && <div className="inline-notice" role="status">We couldn&apos;t refresh your latest data. Showing your workspace essentials.</div>}

    <section className="schedule-card">
      <div className="schedule-label">
        <span><CalendarDays size={18} />Today&apos;s schedule</span>
        <Link href="/dashboard/student/timetable">Full timetable <ArrowRight size={16} /></Link>
      </div>
      <div className="schedule-items">
        <article className="schedule-class current">
          <div className="time"><strong>09:00</strong><span>10:30 AM</span></div>
          <div className="class-marker"><i /><span /></div>
          <div className="class-info">
            <div><b>Database Systems</b><span>CS 301 · Lecture</span></div>
            <p><MapPin size={14} /> Science Block, Room 2.14</p>
          </div>
          <div className="class-action">
            <span className="pulse-badge live"><span className="pulse-dot" />Now · 42 min left</span>
            <button onClick={() => setSelectedCourse(courseFallback[0])} aria-label="Open Database Systems course"><PlayCircle size={18} />Open course</button>
          </div>
        </article>
        <article className="schedule-class">
          <div className="time"><strong>11:15</strong><span>12:45 PM</span></div>
          <div className="class-marker"><i /><span /></div>
          <div className="class-info">
            <div><b>Software Engineering</b><span>CS 315 · Seminar</span></div>
            <p><MapPin size={14} /> Engineering Hall, E-05</p>
          </div>
          <div className="class-action">
            <span className="up-next">Up next</span>
            <button onClick={() => setSelectedCourse(courseFallback[1])} aria-label="View Software Engineering course"><ChevronRight size={18} /></button>
          </div>
        </article>
        <article className="schedule-class last">
          <div className="time"><strong>14:00</strong><span>15:30 PM</span></div>
          <div className="class-marker"><i /></div>
          <div className="class-info">
            <div><b>Discrete Mathematics</b><span>MATH 241 · Lecture</span></div>
            <p><MapPin size={14} /> Lecture Theatre 4</p>
          </div>
        </article>
      </div>
    </section>

    <div className="dashboard-columns">
      <section className="courses-section">
        <div className="section-heading">
          <div><p className="eyebrow">This semester</p><h2>Active courses</h2></div>
          <Link href="/dashboard/student/results">View all <ArrowRight size={16} /></Link>
        </div>
        <div className="course-grid">
          {resultCourses.map((course) => (
            <article className="course-card hover-lift" key={course.code} style={{ cursor: "pointer" }} onClick={() => setSelectedCourse(course)}>
              <div className={`course-art ${course.tone}`}><BookOpen size={23} /><span>{course.code}</span></div>
              <div className="course-content">
                <div><span className="course-code">{course.code}</span><h3>{course.title}</h3><p>{course.professor}</p></div>
                <div className="course-metrics"><span><b>{course.grade}%</b> overall grade</span><span>{course.progress}% complete</span></div>
                <div className="progress"><i style={{ width: `${course.progress}%` }} /></div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <aside className="tasks-section">
        <div className="section-heading">
          <div><p className="eyebrow">Stay on track</p><h2>Upcoming tasks</h2></div>
          <button onClick={() => setTaskModalOpen(true)} aria-label="Add a task" title="Add a new task"><Plus size={19} /></button>
        </div>
        <div className="task-list">
          {taskList.map((task) => (
            <article key={task.id}>
              <span className={`task-icon ${task.tone}`}><FileText size={17} /></span>
              <div>
                <span className="task-tag">{task.tag}</span>
                <h3>{task.title}</h3>
                <p>{task.course} · <strong>{task.due}</strong></p>
              </div>
            </article>
          ))}
        </div>
        <Link className="all-tasks" href="/dashboard/student/support">View all tasks <ArrowRight size={16} /></Link>
      </aside>
    </div>

    <section className="stats-strip">
      <article className="hover-lift"><Clock3 size={20} /><div><span>Attendance average</span><b>{overview?.attendance?.length ? `${Math.round(overview.attendance.reduce((sum, item) => sum + Number(item.percentage || 0), 0) / overview.attendance.length)}%` : "92%"}</b></div></article>
      <article className="hover-lift"><GraduationCap size={20} /><div><span>Current CGPA</span><b>{profile?.cgpa ?? "3.72"}</b></div></article>
      <article className="hover-lift"><CircleDollarSign size={20} /><div><span>Outstanding balance</span><b>{profile?.feeBalance ? `GH₵ ${profile.feeBalance.toLocaleString()}` : "GH₵ 1,240"}</b></div><Link href="/dashboard/student/fees" aria-label="View fees"><ArrowRight size={17} /></Link></article>
    </section>

    {/* Create Task Modal */}
    {taskModalOpen && (
      <div className="pg-modal-overlay">
        <div className="pg-modal-card">
          <div className="pg-modal-header">
            <div className="pg-modal-title"><Plus size={18} /> Add New Academic Task</div>
            <button className="pg-modal-close" onClick={() => setTaskModalOpen(false)}><X size={16} /></button>
          </div>
          <form onSubmit={handleAddTask}>
            <div className="pg-modal-body">
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label className="pg-label">Task Description</label>
                  <input className="pg-input" autoFocus placeholder="e.g., Prepare lab report for Database Systems" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} required />
                </div>
                <div>
                  <label className="pg-label">Course / Category</label>
                  <select className="pg-select" value={newTaskCourse} onChange={(e) => setNewTaskCourse(e.target.value)}>
                    <option value="Database Systems">Database Systems (CS 301)</option>
                    <option value="Software Engineering">Software Engineering (CS 315)</option>
                    <option value="Discrete Mathematics">Discrete Mathematics (MATH 241)</option>
                    <option value="Personal">Personal / Study</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="pg-modal-footer">
              <button type="button" className="pg-btn pg-btn-ghost" onClick={() => setTaskModalOpen(false)}>Cancel</button>
              <button type="submit" className="pg-btn pg-btn-primary">Add Task</button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* Course Detail Modal */}
    {selectedCourse && (
      <div className="pg-modal-overlay">
        <div className="pg-modal-card">
          <div className="pg-modal-header">
            <div className="pg-modal-title"><BookOpen size={18} /> {selectedCourse.code} · {selectedCourse.title}</div>
            <button className="pg-modal-close" onClick={() => setSelectedCourse(null)}><X size={16} /></button>
          </div>
          <div className="pg-modal-body">
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div style={{ background: "#faf8f5", padding: "12px 14px", borderRadius: "10px" }}>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#64748b", fontWeight: 700 }}>Instructor</div>
                  <div style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a" }}>{selectedCourse.professor}</div>
                </div>
                <div style={{ background: "#faf8f5", padding: "12px 14px", borderRadius: "10px" }}>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#64748b", fontWeight: 700 }}>Current Grade</div>
                  <div style={{ fontSize: "14px", fontWeight: 800, color: "#a51c30" }}>{selectedCourse.grade}%</div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Schedule & Location</div>
                <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#1e293b" }}>{selectedCourse.schedule} · {selectedCourse.room}</div>
              </div>
              <div>
                <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "6px" }}>Course Completion</div>
                <div className="pg-progress"><div className="pg-progress-fill" style={{ width: `${selectedCourse.progress}%` }} /></div>
              </div>
            </div>
          </div>
          <div className="pg-modal-footer">
            <Link href="/dashboard/student/results" className="pg-btn pg-btn-primary" onClick={() => setSelectedCourse(null)}>Full Grade Breakdown</Link>
          </div>
        </div>
      </div>
    )}

    {loading && <div className="data-refresh" aria-live="polite">Refreshing your academic data…</div>}
  </div>;
}

