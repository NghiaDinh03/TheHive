'use client';

/**
 * Notifications configuration page.
 * Mirrors legacy `frontend/app/views/partials/admin/notification/list.html`
 * and `notification.modal.html` from TheHive 4.
 * Tabs: Notifications (list), Add notification.
 * Each notification has: name, trigger, notifier type, config, enabled toggle.
 */

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Bell, CheckCircle, Edit2, Plus, Trash2, XCircle } from '@/components/FaIcon';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { apiFetch, getStoredAuth, normalizeList } from '@/lib/api';

const TRIGGERS = [
  'AnyEvent',
  'CaseCreated',
  'CaseClosed',
  'AlertCreated',
  'AlertImported',
  'TaskAssigned',
  'TaskClosed',
  'ObservableCreated',
  'LogCreated',
] as const;

const NOTIFIERS = ['webhook', 'email', 'mattermost', 'slack'] as const;
type NotifierType = typeof NOTIFIERS[number];

interface NotificationConfig {
  id: string;
  name: string;
  trigger: string;
  notifier: string;
  config: Record<string, unknown>;
  enabled: boolean;
  organisation_id?: string;
  created_at: string;
}

interface NotifForm {
  name: string;
  trigger: string;
  notifier: NotifierType;
  url: string;
  email: string;
  subject: string;
  channel: string;
}

const emptyForm = (): NotifForm => ({
  name: '',
  trigger: 'AnyEvent',
  notifier: 'webhook',
  url: '',
  email: '',
  subject: '',
  channel: '',
});

function notifierConfigFromForm(form: NotifForm): Record<string, unknown> {
  switch (form.notifier) {
    case 'webhook':
      return { url: form.url };
    case 'email':
      return { to: form.email, subject: form.subject || 'TheHive notification' };
    case 'mattermost':
    case 'slack':
      return { url: form.url, channel: form.channel };
    default:
      return { url: form.url };
  }
}

export default function NotificationsPage() {
  const [auth, setAuth] = useState({ token: '', login: '' });
  const [configs, setConfigs] = useState<NotificationConfig[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState<'list' | 'add'>('list');
  const [form, setForm] = useState<NotifForm>(emptyForm());
  const [editing, setEditing] = useState<NotificationConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setAuth(getStoredAuth()); }, []);

  const fetchConfigs = useCallback(async () => {
    if (!auth.token) return;
    try {
      const data = await apiFetch<unknown>('/api/v1/notifications');
      setConfigs(normalizeList<NotificationConfig>(data as never));
    } catch { /* ignore */ }
  }, [auth.token]);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!form.name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    try {
      const config = notifierConfigFromForm(form);
      const payload = {
        name: form.name.trim(),
        trigger: form.trigger,
        notifier: form.notifier,
        config: JSON.stringify(config),
        enabled: true,
      };
      if (editing) {
        await apiFetch(`/api/v1/notifications/${editing.id}`, { method: 'PATCH', json: payload });
        setSuccess('Notification updated.');
      } else {
        await apiFetch('/api/v1/notifications', { method: 'POST', json: payload });
        setSuccess('Notification created.');
      }
      setForm(emptyForm());
      setEditing(null);
      setTab('list');
      fetchConfigs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete notification "${name}"?`)) return;
    setError(''); setSuccess('');
    try {
      await apiFetch(`/api/v1/notifications/${id}`, { method: 'DELETE' });
      setSuccess('Notification deleted.');
      fetchConfigs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleToggle = async (cfg: NotificationConfig) => {
    setError(''); setSuccess('');
    try {
      await apiFetch(`/api/v1/notifications/${cfg.id}`, {
        method: 'PATCH',
        json: { enabled: !cfg.enabled },
      });
      fetchConfigs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Toggle failed');
    }
  };

  const startEdit = (cfg: NotificationConfig) => {
    const parsed = typeof cfg.config === 'string' ? JSON.parse(cfg.config) : cfg.config;
    setEditing(cfg);
    setForm({
      name: cfg.name,
      trigger: cfg.trigger,
      notifier: cfg.notifier as NotifierType,
      url: (parsed?.url as string) || '',
      email: (parsed?.to as string) || '',
      subject: (parsed?.subject as string) || '',
      channel: (parsed?.channel as string) || '',
    });
    setTab('add');
  };

  const dateFormatter = useMemo(() => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), []);
  function fmt(v?: string) { if (!v) return '-'; const d = new Date(v); return Number.isNaN(d.getTime()) ? '-' : dateFormatter.format(d); }

  return (
    <div className="flex min-h-screen thehive-app-shell">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="content-wrapper flex-1">
        <section className="content-header">
          <h1>
            <Bell size={18} className="mr-xs" />
            Notifications
            <small>configure triggers and delivery</small>
          </h1>
        </section>
        <section className="content">
          {error && <div className="alert alert-danger">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          {/* Nav tabs — mirrors TheHive 4 nav-tabs-custom */}
          <div className="nav-tabs-custom">
            <ul className="nav nav-tabs">
              <li className={tab === 'list' ? 'active' : ''}>
                <a href="#" onClick={(e) => { e.preventDefault(); setTab('list'); setEditing(null); setForm(emptyForm()); }}>
                  Notifications
                </a>
              </li>
              <li className={tab === 'add' ? 'active' : ''}>
                <a href="#" onClick={(e) => { e.preventDefault(); setTab('add'); }}>
                  <Plus size={12} className="mr-xxs" />
                  {editing ? 'Edit notification' : 'Add notification'}
                </a>
              </li>
            </ul>

            <div className="tab-content">
              {/* List tab */}
              {tab === 'list' && (
                <div className="tab-pane active">
                  {configs.length === 0 ? (
                    <div className="empty-message">
                      <Bell size={32} className="empty-icon" />
                      <p>No notifications configured.</p>
                      <button className="btn btn-primary btn-sm" onClick={() => setTab('add')}>
                        <Plus size={13} /> Add notification
                      </button>
                    </div>
                  ) : (
                    <table className="table table-striped case-list">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th style={{ width: 160 }}>Trigger</th>
                          <th style={{ width: 120 }}>Notifier</th>
                          <th style={{ width: 100 }}>Status</th>
                          <th style={{ width: 120 }}>Created</th>
                          <th style={{ width: 160 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {configs.map((cfg) => (
                          <tr key={cfg.id}>
                            <td>
                              <strong>{cfg.name}</strong>
                            </td>
                            <td>
                              <span className="label label-info">{cfg.trigger}</span>
                            </td>
                            <td>
                              <span className="label label-default">{cfg.notifier}</span>
                            </td>
                            <td>
                              {cfg.enabled
                                ? <span className="label label-success"><CheckCircle size={11} className="mr-xxs" />Enabled</span>
                                : <span className="label label-warning"><XCircle size={11} className="mr-xxs" />Disabled</span>
                              }
                            </td>
                            <td className="text-muted">{fmt(cfg.created_at)}</td>
                            <td className="text-right nowrap">
                              <button
                                className="btn btn-xs btn-default mr-xs"
                                title={cfg.enabled ? 'Disable' : 'Enable'}
                                onClick={() => handleToggle(cfg)}
                              >
                                {cfg.enabled ? <XCircle size={12} /> : <CheckCircle size={12} />}
                                {' '}{cfg.enabled ? 'Disable' : 'Enable'}
                              </button>
                              <button
                                className="btn btn-xs btn-default mr-xs"
                                onClick={() => startEdit(cfg)}
                              >
                                <Edit2 size={12} /> Edit
                              </button>
                              <button
                                className="btn btn-xs btn-danger"
                                onClick={() => handleDelete(cfg.id, cfg.name)}
                              >
                                <Trash2 size={12} /> Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Add/Edit tab */}
              {tab === 'add' && (
                <div className="tab-pane active">
                  <form onSubmit={handleSubmit} className="form-horizontal" style={{ maxWidth: 640 }}>
                    <div className="form-group">
                      <label className="col-sm-3 control-label">Name <span className="text-danger">*</span></label>
                      <div className="col-sm-9">
                        <input
                          className="form-control"
                          placeholder="e.g. Case created → Slack"
                          value={form.name}
                          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                          required
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="col-sm-3 control-label">Trigger</label>
                      <div className="col-sm-9">
                        <select
                          className="form-control"
                          value={form.trigger}
                          onChange={(e) => setForm((f) => ({ ...f, trigger: e.target.value }))}
                        >
                          {TRIGGERS.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="col-sm-3 control-label">Notifier</label>
                      <div className="col-sm-9">
                        <select
                          className="form-control"
                          value={form.notifier}
                          onChange={(e) => setForm((f) => ({ ...f, notifier: e.target.value as NotifierType }))}
                        >
                          {NOTIFIERS.map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Notifier-specific config */}
                    {(form.notifier === 'webhook' || form.notifier === 'mattermost' || form.notifier === 'slack') && (
                      <div className="form-group">
                        <label className="col-sm-3 control-label">Webhook URL <span className="text-danger">*</span></label>
                        <div className="col-sm-9">
                          <input
                            className="form-control"
                            type="url"
                            placeholder="https://hooks.example.com/..."
                            value={form.url}
                            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                          />
                        </div>
                      </div>
                    )}
                    {(form.notifier === 'mattermost' || form.notifier === 'slack') && (
                      <div className="form-group">
                        <label className="col-sm-3 control-label">Channel</label>
                        <div className="col-sm-9">
                          <input
                            className="form-control"
                            placeholder="#channel"
                            value={form.channel}
                            onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
                          />
                        </div>
                      </div>
                    )}
                    {form.notifier === 'email' && (
                      <>
                        <div className="form-group">
                          <label className="col-sm-3 control-label">To email <span className="text-danger">*</span></label>
                          <div className="col-sm-9">
                            <input
                              className="form-control"
                              type="email"
                              placeholder="analyst@example.com"
                              value={form.email}
                              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="form-group">
                          <label className="col-sm-3 control-label">Subject</label>
                          <div className="col-sm-9">
                            <input
                              className="form-control"
                              placeholder="TheHive notification"
                              value={form.subject}
                              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                            />
                          </div>
                        </div>
                      </>
                    )}

                    <div className="form-group">
                      <div className="col-sm-offset-3 col-sm-9">
                        <button type="submit" className="btn btn-primary mr-xs" disabled={saving}>
                          {saving ? 'Saving…' : editing ? 'Update notification' : 'Add notification'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-default"
                          onClick={() => { setTab('list'); setEditing(null); setForm(emptyForm()); }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </section>
        </main>
      </div>
    </div>
  );
}
