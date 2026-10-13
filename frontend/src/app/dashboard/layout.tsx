"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, BookOpen, CalendarCheck2, CalendarDays, ChevronDown, CircleDollarSign, ClipboardList, FileText, GraduationCap, LayoutDashboard, LogOut, Menu, Search, ScrollText, ShieldCheck, UserRound, Users, WalletCards, X } from "lucide-react";
import { canAccessRoute, getDashboardPath, type UserSession } from "@/lib/auth";
import { fetchCsrfToken } from "@/lib/csrf";

import { API_BASE } from '@/lib/config';

const navItems = {
  student: [
    { label: "Overview", href: "/dashboard/student", icon: LayoutDashboard },
    { label: "Results", href: "/dashboard/student/results", icon: BookOpen },
    { label: "Timetable", href: "/dashboard/student/timetable", icon: CalendarDays },
    { label: "Attendance", href: "/dashboard/student/attendance", icon: CalendarCheck2 },
    { label: "Fee statement", href: "/dashboard/student/fees", icon: CircleDollarSign },
    { label: "Payments", href: "/dashboard/student/payments", icon: WalletCards },
    { label: "Registration", href: "/dashboard/student/registration", icon: ClipboardList },
    { label: "Transcript", href: "/dashboard/student/transcript", icon: FileText },
    { label: "My profile", href: "/dashboard/student/profile", icon: UserRound },
    { label: "Support", href: "/dashboard/student/support", icon: Bell },
  ],
  lecturer: [
    { label: "Overview", href: "/dashboard/lecturer", icon: LayoutDashboard },
    { label: "Courses", href: "/dashboard/lecturer/courses", icon: BookOpen },
    { label: "Attendance", href: "/dashboard/lecturer/attendance", icon: CalendarCheck2 },
    { label: "Results", href: "/dashboard/lecturer/results", icon: GraduationCap },
    { label: "Timetable", href: "/dashboard/lecturer/timetable", icon: CalendarDays },
  ],
  admin: [
    { label: "Overview", href: "/dashboard/admin", icon: LayoutDashboard },
    { label: "Courses", href: "/dashboard/admin/courses", icon: BookOpen },
    { label: "Attendance", href: "/dashboard/admin/attendance", icon: CalendarCheck2 },
    { label: "Timetable", href: "/dashboard/admin/timetable", icon: CalendarDays },
    { label: "Fees", href: "/dashboard/admin/fees", icon: CircleDollarSign },
    { label: "Payments", href: "/dashboard/admin/payments", icon: WalletCards },
    { label: "Results", href: "/dashboard/admin/results", icon: GraduationCap },
    { label: "Requests", href: "/dashboard/admin/requests", icon: ClipboardList },
    { label: "Users", href: "/dashboard/admin/users", icon: Users },
    { label: "Audit logs", href: "/dashboard/admin/audit-logs", icon: ScrollText },
  ],
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, title: "Assignment Graded", text: "CS 301 Database Schema design scored 88/100", time: "10m ago", read: false },
    { id: 2, title: "Fee Reminder", text: "Semester balance due by Oct 15", time: "2h ago", read: false },
    { id: 3, title: "Classroom Change", text: "MATH 241 moved to LT 4 for today", time: "1d ago", read: false },
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(true); }
      if (event.key === "Escape") { setSearchOpen(false); setMenuOpen(false); setProfileOpen(false); setNotificationsOpen(false); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    async function loadUser() {
      try {
        const stored = localStorage.getItem("portal_user");
        if (!stored) { router.replace("/login"); return; }
        const parsed = JSON.parse(stored) as UserSession;
        setUser(parsed);
        const dashboardPath = getDashboardPath(parsed.role);
        if (pathname === "/dashboard" || !canAccessRoute(parsed.role, pathname)) { router.replace(dashboardPath); return; }
        const token = localStorage.getItem("portal_token") || "";
        const response = await fetch(`${API_BASE}/v1/auth/me`, {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (response.ok) {
          const data = await response.json();
          setUser(data.user as UserSession);
          localStorage.setItem("portal_user", JSON.stringify(data.user));
        } else if (response.status === 401) {
          localStorage.removeItem("portal_user");
          localStorage.removeItem("portal_token");
          router.replace("/login");
        }
      } catch { /* retain a locally available session when backend is offline */ }
      finally { setLoading(false); }
    }
    loadUser();
  }, [pathname, router]);

  async function handleLogout() {
    try {
      const csrfToken = await fetchCsrfToken();
      const token = localStorage.getItem("portal_token") || "";
      await fetch(`${API_BASE}/v1/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: {
          "X-CSRF-Token": csrfToken,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    } catch {}
    localStorage.removeItem("portal_user"); localStorage.removeItem("portal_token"); router.replace("/login");
  }

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  if (loading || !user) return <div className="portal-loading"><span />Loading your workspace...</div>;
  const items = navItems[user.role === "student" ? "student" : user.role === "lecturer" ? "lecturer" : "admin"].filter((item) => canAccessRoute(user.role, item.href));
  const initial = user.fullName.charAt(0).toUpperCase();
  const unreadCount = notifications.filter((n) => !n.read).length;

  const quickLinks = [
    { label: "Today's timetable", href: "/dashboard/student/timetable", icon: CalendarDays },
    { label: "Request a transcript", href: "/dashboard/student/transcript", icon: FileText },
    { label: "Pay fees", href: "/dashboard/student/fees", icon: CircleDollarSign },
    { label: "My courses & grades", href: "/dashboard/student/results", icon: BookOpen },
    { label: "Attendance record", href: "/dashboard/student/attendance", icon: CalendarCheck2 },
  ];

  const filteredLinks = searchQuery.trim()
    ? quickLinks.filter((l) => l.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : quickLinks;

  return <div className="portal-app">
    <a href="#main-content" className="skip-link">Skip to content</a>
    <aside className={`portal-sidebar ${menuOpen ? "is-open" : ""}`} aria-label="Primary navigation">
      <div className="portal-brand"><div className="portal-logo"><ShieldCheck size={21} /></div><div><strong>Campusly</strong><span>Student Portal</span></div><button className="sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Close navigation"><X size={20} /></button></div>
      <nav className="portal-nav">{items.map((item) => <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} aria-current={pathname === item.href ? "page" : undefined}><item.icon size={19} /><span>{item.label}</span></Link>)}</nav>
      <div className="sidebar-bottom">{user.role === "student" && <Link href="/dashboard/student/profile"><UserRound size={18} /><span>Profile</span></Link>}<button onClick={handleLogout}><LogOut size={18} /><span>Log out</span></button></div>
    </aside>
    {menuOpen && <button className="menu-scrim" onClick={() => setMenuOpen(false)} aria-label="Close navigation" />}
    <section className="portal-workspace">
      <header className="portal-topbar">
        <button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Menu size={22} /></button>
        <button className="universal-search" onClick={() => setSearchOpen(true)} aria-label="Search the portal"><Search size={18} /><span>Search courses, resources, and more...</span><kbd>⌘ K</kbd></button>
        <div className="topbar-actions">
          <div className="notifications-wrap">
            <button className="icon-button" onClick={() => setNotificationsOpen((v) => !v)} aria-label="Notifications">
              <Bell size={20} />
              {unreadCount > 0 && <span className="notification-dot">{unreadCount}</span>}
            </button>
            {notificationsOpen && (
              <div className="topbar-popover notifications-popover">
                <div className="topbar-popover-head">
                  <strong>Notifications</strong>
                  {unreadCount > 0 && <button onClick={markAllRead} className="popover-action">Mark all read</button>}
                </div>
                <div className="topbar-popover-list">
                  {notifications.map((n) => (
                    <div key={n.id} className={`topbar-notification ${n.read ? "" : "is-unread"}`}>
                      <div className="topbar-notification-title">
                        <span>{n.title}</span>
                        <span>{n.time}</span>
                      </div>
                      <p>{n.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="profile-wrap">
            <button className="profile-trigger" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen}>
              <span className="avatar">{initial}</span>
              <span className="profile-name">{user.fullName.split(" ")[0]}</span>
              <ChevronDown size={16} />
            </button>
            {profileOpen && (
              <div className="profile-menu">
                <div className="profile-menu-head">
                  <div>{user.fullName}</div>
                  <span>Role: {user.role.replace("_", " ")}</span>
                </div>
                {user.role === "student" && <Link href="/dashboard/student/profile" onClick={() => setProfileOpen(false)}><UserRound size={16} />Your profile</Link>}
                <button onClick={handleLogout}><LogOut size={16} />Log out</button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main id="main-content" className="portal-main">{children}</main>
    </section>
    <nav className="mobile-nav" aria-label="Mobile navigation">{items.slice(0, 5).map((item) => <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined}><item.icon size={20} /><span>{item.label}</span></Link>)}</nav>
    {searchOpen && <div className="search-layer" role="dialog" aria-modal="true" aria-label="Search the portal"><button className="search-backdrop" onClick={() => setSearchOpen(false)} aria-label="Close search" /><div className="search-dialog"><div><Search size={20} /><input autoFocus value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search courses, forms, services..." aria-label="Search portal" /><kbd>ESC</kbd></div><p>Quick links</p>{filteredLinks.map((link) => <Link key={link.href} href={link.href} onClick={() => { setSearchOpen(false); setSearchQuery(""); }}><link.icon size={17} />{link.label}</Link>)}</div></div>}
  </div>;
}
