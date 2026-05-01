'use client';

/**
 * Admin → Taxonomies.
 * Mirrors legacy `frontend/app/views/partials/admin/taxonomy/list.html` and `import.html` / `view.html`.
 */

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Power, PowerOff, Tags, Upload } from '@/components/FaIcon';
import { AdminShell } from '@/components/AdminShell';
import { ApiError, apiFetch, normalizeList } from '@/lib/api';

type Taxonomy = {
  id?: string;
  namespace: string;
  description?: string;
  version?: number;
  enabled?: boolean;
  predicates?: Array<{ value: string; expanded?: string }>;
};

export default function TaxonomyAdminPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('');
  const [importing, setImporting] = useState(false);
  const [viewing, setViewing] = useState<Taxonomy | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const taxonomies = useQuery({
    queryKey: ['admin-taxonomies'],
    queryFn: async () => {
      try {
        const data = await apiFetch<unknown>('/api/v1/admin/taxonomies');
        return normalizeList<Taxonomy>(data as never);
      } catch {
        return [] as Taxonomy[];
      }
    },
  });

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      apiFetch(`/api/v1/admin/taxonomies/${encodeURIComponent(id)}/toggle`, {
        method: 'POST',
        json: { enabled },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-taxonomies'] });
      setMessage('Taxonomy state updated.');
      setError(null);
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.problem.detail || err.problem.title : 'Toggle failed'),
  });

  const importMut = useMutation({
    mutationFn: (payload: unknown) =>
      apiFetch('/api/v1/admin/taxonomies/import', { method: 'POST', json: payload }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-taxonomies'] });
      setImporting(false);
      setMessage('Taxonomy imported.');
      setError(null);
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.problem.detail || err.problem.title : 'Import failed'),
  });

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    return (taxonomies.data ?? []).filter(
      (t) => !q || t.namespace.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q),
    );
  }, [taxonomies.data, filter]);

  return (
    <AdminShell title="Taxonomies" small="MISP-compatible tag namespaces">
      {message && <div className="admin-alert success">{message}</div>}
      {error && <div className="admin-alert error">{error}</div>}

      <div className="box box-primary">
        <div className="box-header with-border">
          <h3 className="box-title">List of taxonomies ({filtered.length})</h3>
          <div className="box-tools">
            <input
              className="form-control"
              placeholder="Filter by namespace…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ maxWidth: 200 }}
            />
            <button className="btn btn-sm btn-primary" onClick={() => setImporting(true)}>
              <Upload size={13} /> Import taxonomy
            </button>
          </div>
        </div>
        <div className="box-body no-padding overflow-x-auto">
          {taxonomies.isLoading ? (
            <div className="empty-message">Loading taxonomies…</div>
          ) : filtered.length === 0 ? (
            <div className="empty-message">No taxonomies match the current filter.</div>
          ) : (
            <table className="table table-striped">
              <thead>
                <tr>
                  <th style={{ width: 220 }}>Namespace</th>
                  <th>Description</th>
                  <th style={{ width: 80 }}>Version</th>
                  <th style={{ width: 100 }}>Status</th>
                  <th style={{ width: 220 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.namespace}>
                    <td>
                      <strong>{t.namespace}</strong>
                    </td>
                    <td>{t.description || 'No description'}</td>
                    <td>{t.version ?? '—'}</td>
                    <td>
                      <span className={t.enabled ? 'label label-success' : 'label label-default'}>
                        {t.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="nowrap">
                      <button className="btn btn-xs btn-default mr-xxs" onClick={() => setViewing(t)}>
                        <Eye size={11} /> View
                      </button>
                      <button
                        className={t.enabled ? 'btn btn-xs btn-warning' : 'btn btn-xs btn-success'}
                        disabled={!t.id}
                        onClick={() => t.id && toggle.mutate({ id: t.id, enabled: !t.enabled })}
                      >
                        {t.enabled ? <PowerOff size={11} /> : <Power size={11} />}
                        {t.enabled ? ' Disable' : ' Enable'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {importing && (
        <ImportModal
          onClose={() => setImporting(false)}
          onSubmit={(payload) => importMut.mutate(payload)}
          submitting={importMut.isPending}
        />
      )}
      {viewing && <ViewModal taxonomy={viewing} onClose={() => setViewing(null)} />}
    </AdminShell>
  );
}

function ImportModal({
  onClose,
  onSubmit,
  submitting,
}: {
  onClose: () => void;
  onSubmit: (payload: unknown) => void;
  submitting: boolean;
}) {
  const [json, setJson] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);

  function tryParse() {
    try {
      const parsed = JSON.parse(json);
      setParseError(null);
      onSubmit(parsed);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  }

  return (
    <div className="thehive-modal-backdrop" role="dialog">
      <div className="thehive-modal lg">
        <header className="thehive-modal-header">
          <h3>
            <Upload size={14} /> Import taxonomy
          </h3>
          <button className="thehive-modal-close" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="thehive-modal-body">
          <p className="text-muted text-sm">
            Paste a MISP taxonomy JSON below. The taxonomy must include `namespace`, `description`, `version` and
            `predicates`.
          </p>
          <textarea
            className="form-control mono"
            rows={14}
            value={json}
            onChange={(e) => setJson(e.target.value)}
            placeholder='{"namespace": "tlp", "description": "Traffic Light Protocol", "version": 1, "predicates": [...]}'
          />
          {parseError && <div className="admin-alert error mt-2">{parseError}</div>}
        </div>
        <footer className="thehive-modal-footer">
          <button className="btn btn-default" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={tryParse} disabled={submitting || !json.trim()}>
            {submitting ? 'Importing…' : 'Import'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function ViewModal({ taxonomy, onClose }: { taxonomy: Taxonomy; onClose: () => void }) {
  return (
    <div className="thehive-modal-backdrop" role="dialog">
      <div className="thehive-modal lg">
        <header className="thehive-modal-header">
          <h3>
            <Tags size={14} /> {taxonomy.namespace}
          </h3>
          <button className="thehive-modal-close" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="thehive-modal-body">
          <dl className="thehive-dl">
            <dt>Description</dt>
            <dd>{taxonomy.description || 'No description'}</dd>
            <dt>Version</dt>
            <dd>{taxonomy.version ?? '—'}</dd>
            <dt>Predicates</dt>
            <dd>{(taxonomy.predicates ?? []).length}</dd>
          </dl>
          {(taxonomy.predicates ?? []).length > 0 && (
            <table className="table table-striped">
              <thead>
                <tr>
                  <th>Value</th>
                  <th>Expanded</th>
                </tr>
              </thead>
              <tbody>
                {taxonomy.predicates!.map((p) => (
                  <tr key={p.value}>
                    <td className="mono">{p.value}</td>
                    <td>{p.expanded || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <footer className="thehive-modal-footer">
          <button className="btn btn-default" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
