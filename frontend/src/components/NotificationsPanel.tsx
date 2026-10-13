"use client";

import { useEffect, useState } from 'react';

import { API_BASE } from '@/lib/config';
type NotificationItem = { _id: string; title: string; message: string; readAt?: string; createdAt?: string };

export default function NotificationsPanel({ title = 'Notifications' }: { title?: string }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadNotifications() {
      try {
        const response = await fetch(`${API_BASE}/v1/notifications`, {
          credentials: 'include',
          headers: { Authorization: `Bearer ${localStorage.getItem('portal_token') || ''}` },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Unable to load notifications.');
        setItems(data.notifications || []);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Unable to load notifications.');
      }
    }
    loadNotifications();
  }, []);

  async function markRead(item: NotificationItem) {
    const response = await fetch(`${API_BASE}/v1/notifications/${item._id}/read`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { Authorization: `Bearer ${localStorage.getItem('portal_token') || ''}` },
    });
    if (response.ok) setItems((current) => current.map((row) => row._id === item._id ? { ...row, readAt: new Date().toISOString() } : row));
  }

  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold text-[#11222d]">{title}</h2><span className="rounded-full bg-[#fff8e9] px-2.5 py-1 text-xs font-semibold text-[#8a6a2f]">{items.filter((item) => !item.readAt).length} unread</span></div>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-3 space-y-2">
        {items.length === 0 ? <p className="text-sm text-slate-500">No notifications yet.</p> : items.slice(0, 6).map((item) => <article key={item._id} className={`flex flex-wrap items-start justify-between gap-3 rounded-lg p-3 ${item.readAt ? 'bg-[#f8fafc]' : 'bg-[#f5faf7] ring-1 ring-[#dfe7e1]'}`}><div><h3 className="text-sm font-semibold text-[#11222d]">{item.title}</h3><p className="mt-1 text-sm text-slate-600">{item.message}</p><time className="mt-1 block text-xs text-slate-400">{item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}</time></div>{!item.readAt && <button onClick={() => markRead(item)} className="text-sm font-semibold text-[#0d5a4d]">Mark read</button>}</article>)}
      </div>
    </section>
  );
}
