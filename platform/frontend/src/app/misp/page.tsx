'use client';

import { useEffect, useState, useCallback } from 'react';
import { Activity, Download, Link2, Plus, Server, Trash2, Upload } from '@/components/FaIcon';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';

const API = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

interface MISPServer {
  id: string;
  name: string;
  url: string;
  verify_tls: boolean;
  enabled: boolean;
  purpose: string;
  case_template: string;
  tags: string[];
  last_sync_at: string | null;
  last_sync_error: string;
  created_at: string;
}

interface SyncLog {
  id: string;
  server_id: string;
  direction: string;
  misp_event_id: string;
  alert_id?: string;
  case_id?: string;
  observable_count: number;
  ioc_count: number;
  skipped_count: number;
  status: string;
  error: string;
  created_by: string;
  created_at: string;
}

interface ImportPreview {
  event_id: string;
  title: string;
  date: string;
  threat_level: string;
  tags: string[];
  observable_count: number;
  ioc_count: number;
}

type ListResponse<T> = T[] | { values?: T[]; items?: T[]; total?: number };

function normalizeList<T>(payload: ListResponse<T>): T[] {
  if (Array.isArray(payload)) return payload;
  return payload.values ?? payload.items ?? [];
}

export default function MISPPage() {
  const [token, setToken] = useState('');
  const [servers, setServers] = useState<MISPServer[]>([]);
  const [syncLog, setSyncLog] = useState<SyncLog[]>([]);
  const [tab, setTab] = useState<'servers' | 'import' | 'export' | 'log'>('servers');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Server form
  const [newServer, setNewServer] = useState({ name: '', url: '', api_key: '', verify_tls: true, purpose: 'ImportAndExport', case_template: '' });

  // Import form
  const [importServerID, setImportServerID] = useState('');
  const [importEventID, setImportEventID] = useState('');
  const [importTemplate, setImportTemplate] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  // Export form
  const [exportServerID, setExportServerID] = useState('');
  const [exportCaseID, setExportCaseID] = useState('');
  const [exportEventInfo, setExportEventInfo] = useState('');
  const [exportIOCOnly, setExportIOCOnly] = useState(false);

  useEffect(() => {
    const t = typeof window !== 'undefined'
      ? sessionStorage.getItem('thehive.token') || localStorage.getItem('thehive.token') || localStorage.getItem('token') || ''
      : '';
    setToken(t);
  }, []);

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }), [token]);

  const fetchServers = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/v1/misp/servers`, { headers: headers() });
      if (res.ok) setServers(normalizeList<MISPServer>(await res.json()));
    } catch { /* ignore */ }
  }, [token, headers]);

  const fetchSyncLog = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/v1/misp/sync-log`, { headers: headers() });
      if (res.ok) setSyncLog(normalizeList<SyncLog>(await res.json()));
    } catch { /* ignore */ }
  }, [token, headers]);

  useEffect(() => {
    fetchServers();
    fetchSyncLog();
  }, [fetchServers, fetchSyncLog]);

  const createServer = async () => {
    setError(''); setSuccess('');
    try {
      const res = await fetch(`${API}/api/v1/misp/servers`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify(newServer),
      });
      if (res.ok) {
        setSuccess('MISP server created');
        setNewServer({ name: '', url: '', api_key: '', verify_tls: true, purpose: 'ImportAndExport', case_template: '' });
        fetchServers();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to create server');
      }
    } catch (e) { setError('Network error'); }
  };

  const deleteServer = async (id: string) => {
    if (!confirm('Delete this MISP server?')) return;
    try {
      await fetch(`${API}/api/v1/misp/servers/${id}`, { method: 'DELETE', headers: headers() });
      fetchServers();
    } catch { /* ignore */ }
  };

  const previewImport = async () => {
    setError(''); setPreview(null);
    try {
      const res = await fetch(`${API}/api/v1/misp/import/preview`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ server_id: importServerID, event_id: importEventID }),
      });
      if (res.ok) {
        setPreview(await res.json());
      } else {
        const data = await res.json();
        setError(data.error || 'Preview failed');
      }
    } catch (e) { setError('Network error'); }
  };

  const doImport = async () => {
    setError(''); setSuccess('');
    try {
      const res = await fetch(`${API}/api/v1/misp/import`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ server_id: importServerID, event_id: importEventID, case_template: importTemplate }),
      });
      if (res.ok) {
        const data = await res.json();
        setSuccess(`Imported: alert ${data.alert_id}, ${data.observable_count} observables, ${data.ioc_count} IOCs`);
        setPreview(null);
        fetchSyncLog();
      } else {
        const data = await res.json();
        setError(data.error || 'Import failed');
      }
    } catch (e) { setError('Network error'); }
  };

  const doExport = async () => {
    setError(''); setSuccess('');
    try {
      const res = await fetch(`${API}/api/v1/misp/export`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ server_id: exportServerID, case_id: exportCaseID, event_info: exportEventInfo, ioc_only: exportIOCOnly }),
      });
      if (res.ok) {
        const data = await res.json();
        setSuccess(`Exported to MISP event ${data.event_id}: ${data.exported_count} attributes`);
        fetchSyncLog();
      } else {
        const data = await res.json();
        setError(data.error || 'Export failed');
      }
    } catch (e) { setError('Network error'); }
  };

  const purposeLabel = (p: string) => {
    switch (p) {
      case 'ImportOnly': return 'Import only';
      case 'ExportOnly': return 'Export only';
      default: return 'Import & Export';
    }
  };
  const user = token ? { login: sessionStorage.getItem('thehive.login') || 'operator' } : undefined;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Topbar user={user} />
        <main className="content-wrapper flex-1">
          <section className="content-header">
            <h1>MISP Integration <small>import/export threat intelligence</small></h1>
            <ol className="breadcrumb"><li>Home</li><li>Integration</li><li>MISP</li></ol>
          </section>
          <section className="content integration-page misp-page">
            {error && <div className="admin-alert error">{error}</div>}
            {success && <div className="admin-alert success">{success}</div>}

            <div className="integration-tabs">
              {(['servers', 'import', 'export', 'log'] as const).map(t => (
                <button key={t} className={`btn ${tab === t ? 'btn-primary' : 'btn-default'}`} onClick={() => setTab(t)}>
                  {t === 'servers' && <Server size={14} />}
                  {t === 'import' && <Download size={14} />}
                  {t === 'export' && <Upload size={14} />}
                  {t === 'log' && <Activity size={14} />}
                  {t === 'servers' ? 'Servers' : t === 'import' ? 'Import' : t === 'export' ? 'Export' : 'Sync Log'}
                </button>
              ))}
            </div>

            {/* --- Servers Tab --- */}
            {tab === 'servers' && (
              <div className="box box-primary integration-box">
                <div className="box-header with-border"><h3 className="box-title"><Server size={16} /> MISP Servers</h3><div className="box-tools"><span className="label label-info">{servers.length} servers</span></div></div>
                <div className="box-body no-padding">
          <table className="thehive-table adminlte-table integration-table">
            <thead>
              <tr><th>Name</th><th>URL</th><th>Purpose</th><th>TLS</th><th>Enabled</th><th>Template</th><th>Last Sync</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {servers.map(s => (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong><div className="table-subtext">{s.id}</div></td>
                  <td><code>{s.url}</code></td>
                  <td><span className="label label-primary">{purposeLabel(s.purpose)}</span></td>
                  <td><span className={s.verify_tls ? 'label label-success' : 'label label-warning'}>{s.verify_tls ? 'Verified' : 'Unverified'}</span></td>
                  <td><span className={s.enabled ? 'label label-success' : 'label label-default'}>{s.enabled ? 'Enabled' : 'Disabled'}</span></td>
                  <td>{s.case_template || '—'}</td>
                  <td>{s.last_sync_at ? new Date(s.last_sync_at).toLocaleString() : '—'}{s.last_sync_error && <span style={{ color: 'red' }}> ⚠ {s.last_sync_error}</span>}</td>
                  <td><button className="btn btn-xs btn-danger" onClick={() => deleteServer(s.id)}><Trash2 size={12} /> Delete</button></td>
                </tr>
              ))}
              {servers.length === 0 && <tr><td colSpan={8} className="empty-message">No MISP servers configured</td></tr>}
            </tbody>
          </table>
                </div>
                <div className="box-header with-border"><h3 className="box-title"><Plus size={16} /> Add MISP Server</h3></div>
          <div className="box-body integration-form-grid">
            <input placeholder="Name" value={newServer.name} onChange={e => setNewServer({ ...newServer, name: e.target.value })} className="form-control thehive-input" />
            <input placeholder="URL (https://misp.example.com)" value={newServer.url} onChange={e => setNewServer({ ...newServer, url: e.target.value })} className="form-control thehive-input" />
            <input placeholder="API Key" type="password" value={newServer.api_key} onChange={e => setNewServer({ ...newServer, api_key: e.target.value })} className="form-control thehive-input" />
            <select value={newServer.purpose} onChange={e => setNewServer({ ...newServer, purpose: e.target.value })} className="form-control thehive-input">
              <option value="ImportAndExport">Import & Export</option>
              <option value="ImportOnly">Import Only</option>
              <option value="ExportOnly">Export Only</option>
            </select>
            <input placeholder="Case Template (optional)" value={newServer.case_template} onChange={e => setNewServer({ ...newServer, case_template: e.target.value })} className="form-control thehive-input" />
            <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={newServer.verify_tls} onChange={e => setNewServer({ ...newServer, verify_tls: e.target.checked })} /> Verify TLS
            </label>
          </div>
          <div className="box-body integration-actions"><button className="thehive-btn-primary" onClick={createServer} disabled={!newServer.name.trim() || !newServer.url.trim() || !newServer.api_key.trim()}><Plus size={14} /> Add Server</button></div>
        </div>
      )}

      {/* --- Import Tab --- */}
      {tab === 'import' && (
        <div className="box box-primary integration-box">
          <div className="box-header with-border"><h3 className="box-title"><Download size={16} /> Import MISP Event to Alert</h3></div>
          <div className="box-body integration-form-grid">
            <select value={importServerID} onChange={e => setImportServerID(e.target.value)} className="form-control thehive-input">
              <option value="">Select server...</option>
              {servers.filter(s => s.enabled && s.purpose !== 'ExportOnly').map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <input placeholder="MISP Event ID" value={importEventID} onChange={e => setImportEventID(e.target.value)} className="form-control thehive-input" />
            <input placeholder="Case Template (optional)" value={importTemplate} onChange={e => setImportTemplate(e.target.value)} className="form-control thehive-input" />
          </div>
          <div className="box-body integration-actions">
            <button className="btn btn-default" onClick={previewImport} disabled={!importServerID || !importEventID}>Preview</button>
            <button className="btn btn-primary" onClick={doImport} disabled={!importServerID || !importEventID}>Import</button>
          </div>

          {preview && (
            <div className="misp-preview-panel">
              <h4>Preview: {preview.title}</h4>
              <p>Event ID: {preview.event_id} | Date: {preview.date} | Threat Level: {preview.threat_level}</p>
              <p>Observables: {preview.observable_count} | IOCs: {preview.ioc_count}</p>
              <p>Tags: {preview.tags?.join(', ') || 'none'}</p>
            </div>
          )}
        </div>
      )}

      {/* --- Export Tab --- */}
      {tab === 'export' && (
        <div className="box box-primary integration-box">
          <div className="box-header with-border"><h3 className="box-title"><Upload size={16} /> Export Case IOCs to MISP Event</h3></div>
          <div className="box-body integration-form-grid">
            <select value={exportServerID} onChange={e => setExportServerID(e.target.value)} className="form-control thehive-input">
              <option value="">Select server...</option>
              {servers.filter(s => s.enabled && s.purpose !== 'ImportOnly').map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <input placeholder="Case ID (UUID)" value={exportCaseID} onChange={e => setExportCaseID(e.target.value)} className="form-control thehive-input" />
            <input placeholder="Event Info (optional)" value={exportEventInfo} onChange={e => setExportEventInfo(e.target.value)} className="form-control thehive-input" />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
            <input type="checkbox" checked={exportIOCOnly} onChange={e => setExportIOCOnly(e.target.checked)} /> IOC only
          </label>
          <div className="box-body integration-actions"><button className="thehive-btn-primary" onClick={doExport} disabled={!exportServerID || !exportCaseID}>Export to MISP</button></div>
        </div>
      )}

      {/* --- Sync Log Tab --- */}
      {tab === 'log' && (
        <div className="box box-primary integration-box">
          <div className="box-header with-border"><h3 className="box-title"><Activity size={16} /> Sync Log</h3></div>
          <div className="box-body no-padding"><table className="thehive-table adminlte-table integration-table">
            <thead>
              <tr><th>Time</th><th>Direction</th><th>Event</th><th>Alert/Case</th><th>Observables</th><th>IOCs</th><th>Status</th><th>By</th></tr>
            </thead>
            <tbody>
              {syncLog.map(l => (
                <tr key={l.id}>
                  <td>{new Date(l.created_at).toLocaleString()}</td>
                  <td>{l.direction === 'import' ? '⬇️ Import' : '⬆️ Export'}</td>
                  <td>{l.misp_event_id || '—'}</td>
                  <td>{l.alert_id || l.case_id || '—'}</td>
                  <td>{l.observable_count}</td>
                  <td>{l.ioc_count}</td>
                  <td><span className={`label label-${l.status === 'completed' ? 'success' : l.status === 'failed' ? 'danger' : 'default'}`}>{l.status}</span></td>
                  <td>{l.created_by}</td>
                </tr>
              ))}
              {syncLog.length === 0 && <tr><td colSpan={8} className="empty-message">No sync activity yet</td></tr>}
            </tbody>
          </table></div>
        </div>
      )}
          </section>
        </main>
      </div>
    </div>
  );
}
