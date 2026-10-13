"use client";

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle, CheckCircle2, Upload, UserPlus, Users, Link2, Copy,
  GraduationCap, Clock, Search, Info, ShieldCheck, UserCheck, Trash2, Sparkles, Filter, RefreshCw
} from 'lucide-react';
import { API_BASE } from '@/lib/config';
import { fetchCsrfToken } from '@/lib/csrf';
import type { Role } from '@/lib/auth';

type User = { _id: string; fullName: string; email: string; role: string; status: string };
type AdmissionRecord = { fullName: string; email?: string; programme?: string; department?: string; level?: string };
type Tab = 'accounts' | 'admissions';

const ROLES = ['student', 'lecturer', 'department_admin', 'academic_officer', 'finance_officer', 'student_affairs', 'system_admin', 'super_admin', 'hod', 'pro_vc', 'vc'];
const STATUSES = ['active', 'inactive', 'suspended'];

function formatRole(role: string) {
  return role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getRoleBadgeClass(role: string) {
  if (role === 'student') return 'um-badge-student';
  if (role === 'lecturer') return 'um-badge-lecturer';
  if (role.includes('admin') || role.includes('officer')) return 'um-badge-admin';
  return 'um-badge-executive';
}

function getStatusDotClass(status: string) {
  if (status === 'active') return 'um-status-active';
  if (status === 'suspended') return 'um-status-suspended';
  return 'um-status-inactive';
}

export default function AdminUsersPage() {
  const [activeTab, setActiveTab] = useState<Tab>('accounts');
  const [users, setUsers] = useState<User[]>([]);
  const [admissions, setAdmissions] = useState<AdmissionRecord[]>([]);
  const [admissionsImportedAt, setAdmissionsImportedAt] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [showForm, setShowForm] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [showLecturerImport, setShowLecturerImport] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'student' });
  const [csvText, setCsvText] = useState('fullName,programme,department,level,email\nRichard Mensah,BSc Computer Science,Computer Science,100,richard.mensah@rucst.edu.gh');
  const [csvFileName, setCsvFileName] = useState('');
  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const [lecturerCsvText, setLecturerCsvText] = useState('fullName,email,department\nAma Mensah,ama.mensah@example.edu.gh,Computer Science');
  const [lecturerCsvFileName, setLecturerCsvFileName] = useState('');
  const [lecturerSetupLinks, setLecturerSetupLinks] = useState<{ email: string; url: string }[]>([]);
  const [isImportingLecturers, setIsImportingLecturers] = useState(false);
  const [query, setQuery] = useState('');
  const [admissionQuery, setAdmissionQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const currentRole = typeof window === 'undefined' ? '' : (() => {
    try { return (JSON.parse(localStorage.getItem('portal_user') || '{}').role || '') as Role; } catch { return ''; }
  })();

  const canCreatePrivilegedUsers = ['system_admin', 'super_admin', 'hod', 'pro_vc', 'vc'].includes(currentRole);
  const createRoles = canCreatePrivilegedUsers ? ROLES : ['student', 'lecturer'];
  const editableRoles = canCreatePrivilegedUsers ? ROLES : ['student', 'lecturer'];

  async function readResponse(response: Response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`);
    return data;
  }

  const loadUsers = useCallback(async () => {
    const response = await fetch(`${API_BASE}/users`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${localStorage.getItem('portal_token') || ''}` }
    });
    const data = await readResponse(response);
    setUsers(data.users || []);
  }, []);

  const loadAdmissions = useCallback(async () => {
    const response = await fetch(`${API_BASE}/users/admissions`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${localStorage.getItem('portal_token') || ''}` }
    });
    const data = await readResponse(response);
    setAdmissions(data.records || []);
    setAdmissionsImportedAt(data.importedAt || null);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([loadUsers(), loadAdmissions()]);
      showMsg('Data reloaded successfully.', 'success');
    } catch (err) {
      showMsg('Failed to refresh directory.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void Promise.all([loadUsers(), loadAdmissions()]).catch((reason) => {
        setMessage(reason instanceof Error ? reason.message : 'Unable to load users.');
        setMessageType('error');
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAdmissions, loadUsers]);

  function showMsg(text: string, type: 'success' | 'error' | 'info' = 'info') {
    setMessage(text);
    setMessageType(type);
  }

  async function updateUser(id: string, updates: Record<string, string>) {
    const response = await fetch(`${API_BASE}/users/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('portal_token') || ''}` },
      body: JSON.stringify(updates),
    });
    if (response.ok) {
      const data = await response.json();
      setUsers((cur) => cur.map((u) => u._id === id ? data.user : u));
      showMsg('User updated.', 'success');
    } else {
      showMsg((await response.json()).message || 'Unable to update user.', 'error');
    }
  }

  async function deleteUser(id: string) {
    if (!window.confirm('Are you sure you want to delete this user account?')) return;
    const response = await fetch(`${API_BASE}/users/${id}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { Authorization: `Bearer ${localStorage.getItem('portal_token') || ''}` },
    });
    if (response.ok) {
      setUsers((cur) => cur.filter((u) => u._id !== id));
      showMsg('User account deleted.', 'success');
    } else {
      showMsg((await response.json()).message || 'Unable to delete user.', 'error');
    }
  }

  async function createUser(event: React.FormEvent) {
    event.preventDefault();
    setIsCreating(true);
    try {
      const csrfToken = await fetchCsrfToken();
      const response = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken, Authorization: `Bearer ${localStorage.getItem('portal_token') || ''}` },
        body: JSON.stringify(form),
      });
      await readResponse(response);
      await loadUsers();
      setQuery('');
      setForm({ fullName: '', email: '', password: '', role: 'student' });
      setShowForm(false);
      showMsg('User account created successfully.', 'success');
    } catch (reason) {
      showMsg(reason instanceof Error ? reason.message : 'Unable to create user.', 'error');
    } finally {
      setIsCreating(false);
    }
  }

  async function importAdmissionCsv(event?: React.FormEvent, contents = csvText) {
    event?.preventDefault();
    if (!contents.trim()) { showMsg('Select or paste a CSV first.', 'error'); return; }
    setIsImportingCsv(true);
    try {
      const response = await fetch(`${API_BASE}/users/admissions/import`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('portal_token') || ''}` },
        body: JSON.stringify({ csv: contents }),
      });
      const data = await response.json();
      if (!response.ok) { showMsg(data.message || 'Unable to import CSV.', 'error'); return; }
      await loadAdmissions();
      showMsg(data.message || 'Admission list updated successfully.', 'success');
      setShowCsvImport(false);
      setActiveTab('admissions');
    } finally {
      setIsImportingCsv(false);
    }
  }

  async function handleCsvFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setCsvText(content);
    setCsvFileName(file.name);
    showMsg('CSV loaded. Saving admissions list…', 'info');
    await importAdmissionCsv(undefined, content);
  }

  async function importLecturerCsv(event?: React.FormEvent) {
    event?.preventDefault();
    if (!lecturerCsvText.trim()) { showMsg('Add or select a lecturer CSV first.', 'error'); return; }
    setIsImportingLecturers(true);
    try {
      const response = await fetch(`${API_BASE}/users/lecturers/import`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('portal_token') || ''}` },
        body: JSON.stringify({ csv: lecturerCsvText.trim() }),
      });
      const data = await response.json();
      if (!response.ok && response.status !== 207) {
        showMsg(data.duplicates?.length ? `${data.message} ${data.duplicates.join(', ')}` : data.message || 'Unable to import lecturer accounts.', 'error');
        return;
      }
      if (data.users?.length) setUsers((cur) => [...data.users, ...cur]);
      setLecturerSetupLinks(data.setupLinks || []);
      const setupMessage = data.setupLinks?.length ? ` ${data.setupLinks.length} password setup link(s) generated.` : ' Setup emails sent.';
      const failed = data.errors?.length || 0;
      showMsg(`${data.created || 0} lecturer account(s) created.${setupMessage}${failed ? ` ${failed} row(s) need attention.` : ''}`, failed ? 'error' : 'success');
      if (!failed) setShowLecturerImport(false);
    } catch (reason) {
      showMsg(reason instanceof Error ? reason.message : 'Unable to import lecturer accounts.', 'error');
    } finally {
      setIsImportingLecturers(false);
    }
  }

  async function handleLecturerCsvFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLecturerCsvText(await file.text());
    setLecturerCsvFileName(file.name);
  }

  const filteredUsers = users.filter((u) =>
    `${u.fullName} ${u.email} ${u.role}`.toLowerCase().includes(query.toLowerCase())
  );

  const filteredAdmissions = admissions.filter((r) =>
    `${r.fullName} ${r.email || ''} ${r.programme || ''} ${r.department || ''}`.toLowerCase().includes(admissionQuery.toLowerCase())
  );

  const studentUsersCount = users.filter(u => u.role === 'student').length;
  const claimRate = admissions.length > 0 ? Math.round((studentUsersCount / admissions.length) * 100) : 0;

  return (
    <div className="pg-page">
      {/* ── Executive Hero Banner ── */}
      <div className="um-hero">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div className="um-hero-badge">
              <ShieldCheck size={14} /> Administration Console
            </div>
            <h1 className="um-hero-title">User & Admission Management</h1>
            <p className="um-hero-subtitle">
              Oversee active portal accounts, manage user roles and permissions, and import official admission lists for self-service account claiming.
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="pg-btn"
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              backdropFilter: 'blur(8px)'
            }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Refreshing…' : 'Refresh Directory'}
          </button>
        </div>
      </div>

      {/* ── Executive Stat Cards ── */}
      <div className="um-stats-grid">
        <div className="um-stat-card">
          <div className="um-stat-header">
            <h3 className="um-stat-title">Total Active Accounts</h3>
            <div className="um-stat-icon-wrapper" style={{ background: '#fef2f2', color: '#a51c30' }}>
              <Users size={18} />
            </div>
          </div>
          <div className="um-stat-value">{users.length}</div>
          <div className="um-stat-footer">
            <UserCheck size={12} /> Registered & verified system users
          </div>
        </div>

        <div className="um-stat-card">
          <div className="um-stat-header">
            <h3 className="um-stat-title">Admitted Students</h3>
            <div className="um-stat-icon-wrapper" style={{ background: '#fffbeb', color: '#d97706' }}>
              <GraduationCap size={18} />
            </div>
          </div>
          <div className="um-stat-value">{admissions.length}</div>
          <div className="um-stat-footer">
            <Clock size={12} /> {admissionsImportedAt ? `Imported ${new Date(admissionsImportedAt).toLocaleDateString()}` : 'No list imported'}
          </div>
        </div>

        <div className="um-stat-card">
          <div className="um-stat-header">
            <h3 className="um-stat-title">Portal Claim Rate</h3>
            <div className="um-stat-icon-wrapper" style={{ background: '#f0fdf4', color: '#166534' }}>
              <Sparkles size={18} />
            </div>
          </div>
          <div className="um-stat-value">{claimRate}%</div>
          <div className="um-stat-footer">
            <span>{studentUsersCount} of {admissions.length} admitted accounts claimed</span>
          </div>
        </div>
      </div>

      {/* ── Global Alert Banner ── */}
      {message && (
        <div style={{ marginBottom: 20 }}>
          <div className={`pg-alert pg-alert-${messageType}`}>
            {messageType === 'success' ? <CheckCircle2 size={16} style={{ flexShrink: 0 }} /> : <AlertCircle size={16} style={{ flexShrink: 0 }} />}
            <span style={{ fontSize: 13, fontWeight: 500 }}>{message}</span>
          </div>
        </div>
      )}

      {/* ── Navigation Tabs & Main Card Container ── */}
      <div className="um-tab-bar">
        <div className="um-tab-group">
          <button
            type="button"
            className={`um-tab-btn ${activeTab === 'accounts' ? 'active' : ''}`}
            onClick={() => setActiveTab('accounts')}
          >
            <Users size={15} />
            User Accounts
            <span className="um-tab-count">{users.length}</span>
          </button>
          <button
            type="button"
            className={`um-tab-btn ${activeTab === 'admissions' ? 'active' : ''}`}
            onClick={() => setActiveTab('admissions')}
          >
            <GraduationCap size={15} />
            Admission List
            <span className="um-tab-count">{admissions.length}</span>
          </button>
        </div>

        <div style={{ paddingRight: 6 }}>
          {activeTab === 'accounts' ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setShowForm(v => !v); setShowLecturerImport(false); }} className="pg-btn pg-btn-primary">
                <UserPlus size={15} /> Create Account
              </button>
              <button onClick={() => { setShowLecturerImport(v => !v); setShowForm(false); }} className="pg-btn pg-btn-outline">
                <Upload size={15} /> Bulk Lecturers CSV
              </button>
            </div>
          ) : (
            <button onClick={() => setShowCsvImport(v => !v)} className="pg-btn pg-btn-primary">
              <Upload size={15} /> {admissions.length > 0 ? 'Update Admission List' : 'Upload Admission List'}
            </button>
          )}
        </div>
      </div>

      <div className="um-card">
        {/* ══════════════════════════════
            USER ACCOUNTS TAB CONTENT
        ══════════════════════════════ */}
        {activeTab === 'accounts' && (
          <>
            {/* Drawer Form: Create Account */}
            {showForm && (
              <div className="um-panel-drawer">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <h3 className="um-panel-title">
                      <UserPlus size={16} color="#a51c30" /> Create New User Account
                    </h3>
                    <p className="um-panel-sub">Manually provision a staff, lecturer, or student portal account.</p>
                  </div>
                  <button onClick={() => setShowForm(false)} className="pg-btn pg-btn-ghost pg-btn-sm">Cancel</button>
                </div>
                <form onSubmit={createUser}>
                  <div className="um-form-grid" style={{ marginBottom: 20 }}>
                    <div className="um-field">
                      <label className="um-label">Full Name</label>
                      <input required value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} placeholder="e.g. Dr. Kwame Mensah" className="um-input" />
                    </div>
                    <div className="um-field">
                      <label className="um-label">Email Address</label>
                      <input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="e.g. kwame.mensah@rucst.edu.gh" className="um-input" />
                    </div>
                    <div className="um-field">
                      <label className="um-label">Temporary Password</label>
                      <input required type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••••" className="um-input" />
                    </div>
                    <div className="um-field">
                      <label className="um-label">Assigned Role</label>
                      <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="um-select">
                        {createRoles.map(r => (
                          <option key={r} value={r}>{formatRole(r)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="submit" disabled={isCreating} className="pg-btn pg-btn-primary">
                      {isCreating ? 'Creating Account…' : 'Save Account'}
                    </button>
                    <button type="button" onClick={() => setShowForm(false)} className="pg-btn pg-btn-ghost">Close</button>
                  </div>
                </form>
              </div>
            )}

            {/* Drawer Form: Bulk Import Lecturers */}
            {showLecturerImport && (
              <div className="um-panel-drawer">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <h3 className="um-panel-title">
                      <Upload size={16} color="#a51c30" /> Bulk Import Lecturer Accounts
                    </h3>
                    <p className="um-panel-sub">Upload CSV with required headers: <code>fullName, email, department</code></p>
                  </div>
                  <button onClick={() => setShowLecturerImport(false)} className="pg-btn pg-btn-ghost pg-btn-sm">Close</button>
                </div>
                <form onSubmit={importLecturerCsv} style={{ display: 'grid', gap: 16 }}>
                  <div className="pg-dropzone">
                    <Upload size={24} color="#a51c30" />
                    <div>
                      <label htmlFor="lecturer-csv-file" style={{ cursor: 'pointer', fontWeight: 700, color: '#a51c30' }}>
                        Click to select CSV file
                      </label>
                      <input id="lecturer-csv-file" type="file" accept=".csv,text/csv" onChange={handleLecturerCsvFileChange} style={{ display: 'none' }} />
                      {lecturerCsvFileName && <div style={{ marginTop: 4, fontSize: 12, color: '#475569' }}>Selected: {lecturerCsvFileName}</div>}
                    </div>
                  </div>
                  <textarea
                    aria-label="Lecturer CSV payload"
                    value={lecturerCsvText}
                    onChange={e => setLecturerCsvText(e.target.value)}
                    rows={4}
                    className="pg-textarea"
                    style={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: 12 }}
                  />
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="submit" disabled={isImportingLecturers} className="pg-btn pg-btn-primary">
                      {isImportingLecturers ? 'Importing Lecturers…' : 'Process CSV & Generate Setup Links'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Generated Password Setup Links Box */}
            {lecturerSetupLinks.length > 0 && (
              <div style={{ padding: '20px 24px', background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Link2 size={16} color="#b45309" />
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#92400e' }}>
                    Password Setup Links Generated ({lecturerSetupLinks.length})
                  </h4>
                </div>
                <p style={{ margin: '0 0 14px', fontSize: 12, color: '#78350f' }}>
                  Deliver these secure activation links to newly created lecturers. Each link expires in 15 minutes.
                </p>
                <div style={{ display: 'grid', gap: 8 }}>
                  {lecturerSetupLinks.map((item) => (
                    <div key={item.email} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#ffffff', padding: '8px 12px', borderRadius: 8, border: '1px solid #fcd34d' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', width: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.email}</span>
                      <input readOnly value={item.url} className="pg-input" style={{ flex: 1, fontSize: 11, fontFamily: 'monospace', height: 32 }} />
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(item.url).then(() => showMsg(`Copied password setup link for ${item.email}`, 'success'))}
                        className="pg-btn pg-btn-ghost pg-btn-sm"
                      >
                        <Copy size={13} /> Copy Link
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search Toolbar */}
            <div className="um-toolbar">
              <div className="um-search-box">
                <Search size={16} className="um-search-icon" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search users by name, email, or role..."
                  className="um-search-input"
                />
              </div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                Showing {filteredUsers.length} of {users.length} accounts
              </div>
            </div>

            {/* User Accounts Table */}
            {filteredUsers.length === 0 ? (
              <div className="um-empty-state">
                <div className="um-empty-icon-box">
                  <Users size={28} />
                </div>
                <h4 className="um-empty-title">{query ? 'No matching users found' : 'No user accounts recorded'}</h4>
                <p className="um-empty-desc">
                  {query ? 'Try broadening your search query.' : 'Click "Create Account" above to add your first portal user.'}
                </p>
              </div>
            ) : (
              <div className="um-table-wrapper">
                <table className="um-table">
                  <thead>
                    <tr>
                      <th>User Info</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user._id}>
                        <td>
                          <div className="um-user-meta">
                            <div className="um-avatar">
                              {user.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="um-user-name">{user.fullName}</div>
                              <div className="um-user-email">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className={`um-badge ${getRoleBadgeClass(user.role)}`}>
                              {formatRole(user.role)}
                            </span>
                            <select
                              value={user.role}
                              onChange={e => updateUser(user._id, { role: e.target.value })}
                              className="um-select"
                              style={{ padding: '4px 8px', fontSize: 11, height: 28 }}
                              aria-label={`Change role for ${user.fullName}`}
                              disabled={!canCreatePrivilegedUsers && !['student', 'lecturer'].includes(user.role)}
                            >
                              {(editableRoles.includes(user.role) ? editableRoles : [user.role]).map(r => (
                                <option key={r} value={r}>{formatRole(r)}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className={`um-status-dot ${getStatusDotClass(user.status)}`} />
                            <select
                              value={user.status}
                              onChange={e => updateUser(user._id, { status: e.target.value })}
                              className="um-select"
                              style={{ padding: '4px 8px', fontSize: 11, height: 28 }}
                              aria-label={`Change status for ${user.fullName}`}
                            >
                              {STATUSES.map(s => (
                                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={() => deleteUser(user._id)}
                            className="pg-btn pg-btn-danger pg-btn-sm"
                            title="Delete User Account"
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════
            ADMISSION LIST TAB CONTENT
        ══════════════════════════════ */}
        {activeTab === 'admissions' && (
          <>
            {/* Explanatory Banner */}
            <div className="um-info-banner">
              <Info size={18} className="um-info-banner-icon" />
              <div className="um-info-banner-text">
                <strong>Admission Account Claim Workflow:</strong> Upload your official admitted student CSV here. When students visit the portal login screen, they click <em>&quot;New student? Claim your portal account&quot;</em> and enter their <strong>Full Name exactly as spelled in this admission list</strong> to set up their password and log in.
              </div>
            </div>

            {/* CSV Drawer Form */}
            {showCsvImport && (
              <div className="um-panel-drawer">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <h3 className="um-panel-title">
                      <Upload size={16} color="#a51c30" /> Upload Admission List CSV
                    </h3>
                    <p className="um-panel-sub">
                      Required column: <code>fullName</code>. Optional columns: <code>programme, department, level, email</code>
                    </p>
                  </div>
                  <button onClick={() => setShowCsvImport(false)} className="pg-btn pg-btn-ghost pg-btn-sm">Close</button>
                </div>
                <form onSubmit={importAdmissionCsv} style={{ display: 'grid', gap: 16 }}>
                  <div className="pg-dropzone">
                    <Upload size={24} color="#a51c30" />
                    <div>
                      <label htmlFor="admission-csv-file" style={{ cursor: 'pointer', fontWeight: 700, color: '#a51c30' }}>
                        Choose CSV File from computer
                      </label>
                      <input id="admission-csv-file" type="file" accept=".csv,text/csv" onChange={handleCsvFileChange} style={{ display: 'none' }} />
                      {csvFileName && <div style={{ marginTop: 4, fontSize: 12, color: '#475569' }}>Selected: {csvFileName}</div>}
                    </div>
                  </div>
                  <textarea
                    value={csvText}
                    onChange={e => setCsvText(e.target.value)}
                    rows={6}
                    className="pg-textarea"
                    placeholder="fullName,programme,department,level,email"
                    style={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: 12 }}
                  />
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="submit" disabled={isImportingCsv} className="pg-btn pg-btn-primary">
                      {isImportingCsv ? 'Uploading List…' : 'Save Admission List'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Search Toolbar */}
            <div className="um-toolbar">
              <div className="um-search-box">
                <Search size={16} className="um-search-icon" />
                <input
                  value={admissionQuery}
                  onChange={e => setAdmissionQuery(e.target.value)}
                  placeholder="Search admission records by name, programme, department..."
                  className="um-search-input"
                />
              </div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                Showing {filteredAdmissions.length} of {admissions.length} records
              </div>
            </div>

            {/* Admission Records Table */}
            {filteredAdmissions.length === 0 ? (
              <div className="um-empty-state">
                <div className="um-empty-icon-box">
                  <GraduationCap size={28} />
                </div>
                <h4 className="um-empty-title">{admissionQuery ? 'No matching records' : 'No admission list uploaded'}</h4>
                <p className="um-empty-desc">
                  {admissionQuery ? 'Try matching student full name or programme.' : 'Upload your admission list CSV to allow students to claim their accounts.'}
                </p>
              </div>
            ) : (
              <div className="um-table-wrapper">
                <table className="um-table">
                  <thead>
                    <tr>
                      <th>Admitted Student</th>
                      <th>Programme & Department</th>
                      <th>Email Address</th>
                      <th>Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAdmissions.map((record, i) => (
                      <tr key={`${record.email || 'no-email'}-${record.fullName}-${i}`}>
                        <td>
                          <div className="um-user-meta">
                            <div className="um-avatar" style={{ background: '#0f172a' }}>
                              {record.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="um-user-name">{record.fullName}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{record.programme || '—'}</div>
                          {record.department && <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>{record.department}</div>}
                        </td>
                        <td>
                          <span style={{ color: record.email ? '#334155' : '#94a3b8' }}>
                            {record.email || 'Not provided'}
                          </span>
                        </td>
                        <td>
                          {record.level ? (
                            <span className="um-badge um-badge-student">Level {record.level}</span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
