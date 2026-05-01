'use client';

/**
 * Admin -> MITRE ATT&CK patterns.
 * Mirrors legacy `frontend/app/views/partials/admin/attack/list.html` / `view.html` / `import.html`.
 * Backend: GET /api/v1/admin/attack-patterns and POST /api/v1/admin/attack-patterns/import.
 */

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Crosshair, Eye, Search, Upload } from '@/components/FaIcon';
import { AdminShell } from '@/components/AdminShell';
import { ApiError, apiFetch, normalizeList } from '@/lib/api';

type Pattern = {
  id?: string;
  pattern_id: string;
  name: string;
  description?: string;
  tactic?: string;
  kill_chain?: string;
  reference_url?: string;
  revoked?: boolean;
  deprecated?: boolean;
  source?: string;
};

export default function AttackPatternsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('');
  const [tactic, setTactic] = useState('');
  const [viewing, setViewing] = useState<Pattern | null>(null);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const patterns = useQuery({
    queryKey: ['admin-attack-patterns'],
    queryFn: async () => {
      const data = await apiFetch<unknown>('/api/v1/admin/attack-patterns');
      return normalizeList<Pattern>(data as never);
    },
  });

  const importMut = useMutation({
    mutationFn: (payload: unknown) => apiFetch('/api/v1/admin/attack-patterns/import', { method: 'POST', json: payload }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-attack-patterns'] });
      setImporting(false);
      setMessage('ATT&CK patterns imported.');
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.problem.detail || err.problem.title : 'Import failed'),
  });

  const tactics = useMemo(() => {
    const set = new Set<string>();
    (patterns.data ?? []).forEach((p) => p.tactic && set.add(p.tactic));
    return Array.from(set).sort();
  }, [patterns.data]);

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    return (patterns.data ?? []).filter((p) => {
      if (tactic && p.tactic !== tactic) return false;
      if (!q) return true;
      return (
        p.pattern_id.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q)
      );
    });
  }, [patterns.data, filter, tactic]);

  return (
    <AdminShell title="MITRE ATT&CK patterns" small="threat technique catalogue">
      {message && <div className="admin-alert success">{message}</div>}
      {error && <div className="admin-alert error">{error}</div>}
      <div className="box box-primary">
        <div className="box-header with-border">
          <h3 className="box-title"><Crosshair size={14} /> Patterns ({filtered.length})</h3>
          <div className="box-tools">
            <select className="form-control" value={tactic} onChange={(e) => setTactic(e.target.value)}>
              <option value="">All tactics</option>
              {tactics.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <div className="relative" style={{ minWidth: 220 }}>
              <Search size={13} className="thehive-input-icon" />
              <input className="thehive-input thehive-input-with-icon py-1.5" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter ID, name or description" />
            </div>
            <button className="btn btn-sm btn-primary" onClick={() => setImporting(true)}>
              <Upload size={13} /> Import ATT&CK
            </button>
          </div>
        </div>
        <div className="box-body no-padding overflow-x-auto">
          {patterns.isLoading ? <div className="empty-message">Loading patterns...</div> : filtered.length === 0 ? (
            <div className="empty-message">No patterns. Import the MITRE ATT&CK Enterprise STIX bundle or simplified pattern JSON.</div>
          ) : (
            <table className="table table-striped">
              <thead><tr><th style={{ width: 110 }}>ID</th><th>Name</th><th>Tactic</th><th>Kill chain</th><th>Status</th><th style={{ width: 80 }}>Action</th></tr></thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.pattern_id}>
                    <td className="mono">{p.pattern_id}</td>
                    <td><strong>{p.name}</strong>{p.description && <div className="text-muted text-sm">{truncate(p.description, 160)}</div>}</td>
                    <td>{p.tactic ? <span className="label label-default">{p.tactic}</span> : '—'}</td>
                    <td>{p.kill_chain || '—'}</td>
                    <td>{p.revoked ? <span className="label label-danger">Revoked</span> : p.deprecated ? <span className="label label-warning">Deprecated</span> : <span className="label label-success">Active</span>}</td>
                    <td><button className="btn btn-xs btn-default" onClick={() => setViewing(p)}><Eye size={11} /> View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {importing && <ImportModal onClose={() => setImporting(false)} onSubmit={(payload) => importMut.mutate(payload)} submitting={importMut.isPending} />}
      {viewing && <ViewModal pattern={viewing} onClose={() => setViewing(null)} />}
    </AdminShell>
  );
}

function ImportModal({ onClose, onSubmit, submitting }: { onClose: () => void; onSubmit: (payload: unknown) => void; submitting: boolean }) {
  const [json, setJson] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  function tryParse() {
    try {
      const parsed = JSON.parse(json);
      setParseError(null);
      if (parsed.type === 'bundle' && Array.isArray(parsed.objects)) onSubmit({ source: 'mitre-stix', stix_bundle: parsed });
      else onSubmit(parsed);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  }
  return (
    <div className="thehive-modal-backdrop" role="dialog">
      <div className="thehive-modal lg">
        <header className="thehive-modal-header"><h3><Upload size={14} /> Import MITRE ATT&CK</h3><button className="thehive-modal-close" onClick={onClose}>×</button></header>
        <div className="thehive-modal-body">
          <p className="text-muted text-sm">Paste the MITRE Enterprise ATT&CK STIX bundle, or a simplified JSON payload with `patterns`.</p>
          <textarea className="form-control mono" rows={14} value={json} onChange={(e) => setJson(e.target.value)} placeholder='{"source":"manual","patterns":[{"pattern_id":"T1059","name":"Command and Scripting Interpreter","tactic":"execution"}]}' />
          {parseError && <div className="admin-alert error mt-2">{parseError}</div>}
        </div>
        <footer className="thehive-modal-footer"><button className="btn btn-default" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={tryParse} disabled={submitting || !json.trim()}>{submitting ? 'Importing...' : 'Import'}</button></footer>
      </div>
    </div>
  );
}

function ViewModal({ pattern, onClose }: { pattern: Pattern; onClose: () => void }) {
  return (
    <div className="thehive-modal-backdrop" role="dialog">
      <div className="thehive-modal lg">
        <header className="thehive-modal-header"><h3><Crosshair size={14} /> {pattern.pattern_id} - {pattern.name}</h3><button className="thehive-modal-close" onClick={onClose}>×</button></header>
        <div className="thehive-modal-body">
          <dl className="thehive-dl">
            <dt>Description</dt><dd>{pattern.description || 'No description'}</dd>
            <dt>Tactic</dt><dd>{pattern.tactic || '—'}</dd>
            <dt>Kill chain</dt><dd>{pattern.kill_chain || '—'}</dd>
            <dt>Source</dt><dd>{pattern.source || '—'}</dd>
            <dt>Reference</dt><dd>{pattern.reference_url ? <a href={pattern.reference_url} target="_blank" rel="noopener noreferrer">{pattern.reference_url}</a> : '—'}</dd>
          </dl>
        </div>
        <footer className="thehive-modal-footer"><button className="btn btn-default" onClick={onClose}>Close</button></footer>
      </div>
    </div>
  );
}

function truncate(s: string, n: number) { return s.length > n ? `${s.slice(0, n)}...` : s; }
