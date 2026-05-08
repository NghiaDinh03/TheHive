'use client';

/**
 * Observable report renderer modal — mirrors TheHive 4 legacy
 * frontend/app/views/reports/default.html and
 * frontend/app/views/directives/mini-report-list.html.
 *
 * Renders Cortex analyzer/responder job reports in a modal dialog
 * matching legacy AdminLTE modal-max style.
 */

import { useState } from 'react';

export type CortexReport = {
  id: string;
  analyzer_id?: string;
  responder_id?: string;
  status: string;
  report?: string;
  started_at?: string;
  finished_at?: string;
  created_at: string;
};

type ReportRendererModalProps = {
  open: boolean;
  job: CortexReport | null;
  onClose: () => void;
};

function statusBadge(status: string): string {
  switch (status) {
    case 'Success':
    case 'Completed':
      return 'label label-success';
    case 'InProgress':
    case 'Running':
      return 'label label-warning';
    case 'Failure':
    case 'Failed':
      return 'label label-danger';
    case 'Waiting':
      return 'label label-info';
    default:
      return 'label label-default';
  }
}

function parseReport(raw?: string): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function renderReportValue(value: unknown, depth = 0): React.ReactNode {
  if (value === null || value === undefined) return <span className="text-muted">—</span>;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number' || typeof value === 'string') return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted">[]</span>;
    return (
      <ul style={{ paddingLeft: depth > 0 ? 16 : 20, margin: '2px 0' }}>
        {value.map((item, i) => (
          <li key={i}>{renderReportValue(item, depth + 1)}</li>
        ))}
      </ul>
    );
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-muted">{'{}'}</span>;
    return (
      <table className="table table-condensed table-striped" style={{ fontSize: '0.82rem', marginBottom: 4 }}>
        <tbody>
          {entries.map(([key, val]) => (
            <tr key={key}>
              <td style={{ fontWeight: 600, width: '30%', whiteSpace: 'nowrap' }}>{key}</td>
              <td>{renderReportValue(val, depth + 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return String(value);
}

export function ObservableReportModal({ open, job, onClose }: ReportRendererModalProps) {
  const [showRaw, setShowRaw] = useState(false);

  if (!open || !job) return null;

  const parsed = parseReport(job.report);
  const hasStructured = parsed !== null;

  return (
    <div className="modal-backdrop-th4" role="dialog" aria-modal="true">
      <div className="modal-dialog th4-modal-dialog modal-max">
        <div className="modal-content th4-modal-content">
          <div className="modal-header bg-primary">
            <button type="button" className="close" onClick={onClose} aria-label="Close">
              <span aria-hidden="true">&times;</span>
            </button>
            <h3 className="modal-title">
              <i className="fa fa-file-text-o mr-xxs" />
              Report — {job.analyzer_id || job.responder_id || job.id}
            </h3>
          </div>
          <div className="modal-body">
            {/* Job metadata — mirrors legacy report header */}
            <div className="box box-default" style={{ marginBottom: 12 }}>
              <div className="box-body" style={{ padding: '8px 12px' }}>
                <dl className="dl-horizontal clear" style={{ marginBottom: 0 }}>
                  <dt>Status</dt>
                  <dd><span className={statusBadge(job.status)}>{job.status}</span></dd>
                  <dt>Job ID</dt>
                  <dd className="mono" style={{ fontSize: '0.82rem' }}>{job.id}</dd>
                  {job.analyzer_id && (
                    <>
                      <dt>Analyzer</dt>
                      <dd>{job.analyzer_id}</dd>
                    </>
                  )}
                  {job.responder_id && (
                    <>
                      <dt>Responder</dt>
                      <dd>{job.responder_id}</dd>
                    </>
                  )}
                  <dt>Started</dt>
                  <dd>{job.started_at ? new Date(job.started_at).toLocaleString() : '—'}</dd>
                  <dt>Finished</dt>
                  <dd>{job.finished_at ? new Date(job.finished_at).toLocaleString() : '—'}</dd>
                </dl>
              </div>
            </div>

            {/* Report content — mirrors legacy default.html */}
            {!job.report ? (
              <div className="thehive-empty">
                <i className="fa fa-info-circle mr-xxs" />
                No report available for this job.
              </div>
            ) : (
              <>
                {/* Toggle between structured and raw view */}
                <div style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
                  {hasStructured && (
                    <button
                      type="button"
                      className={`btn btn-sm ${!showRaw ? 'btn-primary' : 'btn-default'}`}
                      onClick={() => setShowRaw(false)}
                    >
                      <i className="fa fa-table mr-xxxs" /> Structured
                    </button>
                  )}
                  <button
                    type="button"
                    className={`btn btn-sm ${showRaw ? 'btn-primary' : 'btn-default'}`}
                    onClick={() => setShowRaw(true)}
                  >
                    <i className="fa fa-code mr-xxxs" /> Raw JSON
                  </button>
                </div>

                {showRaw || !hasStructured ? (
                  <pre
                    className="clearpre"
                    style={{
                      background: '#f8f8f8',
                      border: '1px solid #e1e1e1',
                      padding: 12,
                      borderRadius: 3,
                      fontSize: '0.82rem',
                      maxHeight: 400,
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}
                  >
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(job.report), null, 2);
                      } catch {
                        return job.report;
                      }
                    })()}
                  </pre>
                ) : (
                  <div className="report-structured" style={{ maxHeight: 400, overflow: 'auto' }}>
                    {renderReportValue(parsed)}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-default" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
