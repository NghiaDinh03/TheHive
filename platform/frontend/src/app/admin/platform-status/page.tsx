'use client';

/**
 * Admin → Platform status.
 * Mirrors legacy `frontend/app/views/partials/admin/platform/status.html`.
 * Reads `/api/v1/status` (legacy parity) and `/api/healthz` (new readiness).
 */

import { useQuery } from '@tanstack/react-query';
import { Activity, Database, HardDrive, Search, Server } from '@/components/FaIcon';
import { AdminShell } from '@/components/AdminShell';
import { apiFetch } from '@/lib/api';

type Status = {
  versions?: { TheHive?: string; Cortex?: string; MISP?: string; build?: string };
  connectors?: Record<string, { status?: string; message?: string }>;
  config?: Record<string, unknown>;
  capabilities?: string[];
  schemaStatus?: { dbVersion?: number; lastMigration?: string };
};

type Health = {
  status?: string;
  postgres?: string;
  rabbitmq?: string;
  minio?: string;
  opensearch?: string;
  build?: string;
  version?: string;
  uptime_seconds?: number;
};

export default function PlatformStatusPage() {
  const status = useQuery({
    queryKey: ['admin-status'],
    queryFn: async () => {
      try {
        return await apiFetch<Status>('/api/v1/status');
      } catch {
        return {} as Status;
      }
    },
  });
  const health = useQuery({
    queryKey: ['admin-health'],
    queryFn: async () => {
      try {
        return await apiFetch<Health>('/api/healthz');
      } catch {
        return {} as Health;
      }
    },
    refetchInterval: 15000,
  });

  return (
    <AdminShell title="Platform status" small="runtime, dependencies, version">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
        <HealthCard
          icon={<Server size={18} />}
          label="API"
          value={health.data?.status || 'unknown'}
          tone={health.data?.status === 'ok' ? 'success' : 'warning'}
        />
        <HealthCard
          icon={<Database size={18} />}
          label="PostgreSQL"
          value={health.data?.postgres || 'unknown'}
          tone={health.data?.postgres === 'ok' ? 'success' : 'warning'}
        />
        <HealthCard
          icon={<HardDrive size={18} />}
          label="MinIO"
          value={health.data?.minio || 'unknown'}
          tone={health.data?.minio === 'ok' ? 'success' : 'warning'}
        />
        <HealthCard
          icon={<Search size={18} />}
          label="OpenSearch"
          value={health.data?.opensearch || 'unknown'}
          tone={health.data?.opensearch === 'ok' ? 'success' : 'warning'}
        />
      </div>

      <div className="box box-primary">
        <div className="box-header with-border">
          <h3 className="box-title">
            <Activity size={14} /> Versions and build info
          </h3>
        </div>
        <div className="box-body">
          <dl className="thehive-dl">
            <dt>Backend version</dt>
            <dd>{health.data?.version || status.data?.versions?.TheHive || 'unknown'}</dd>
            <dt>Backend build</dt>
            <dd>{health.data?.build || status.data?.versions?.build || 'unknown'}</dd>
            <dt>Uptime</dt>
            <dd>{health.data?.uptime_seconds ? `${Math.round(health.data.uptime_seconds / 60)} minutes` : 'unknown'}</dd>
            <dt>Cortex</dt>
            <dd>{status.data?.versions?.Cortex || 'not configured'}</dd>
            <dt>MISP</dt>
            <dd>{status.data?.versions?.MISP || 'not configured'}</dd>
            <dt>Schema version</dt>
            <dd>{status.data?.schemaStatus?.dbVersion ?? 'unknown'}</dd>
            <dt>Capabilities</dt>
            <dd>
              {(status.data?.capabilities ?? []).length === 0 ? (
                <em>none</em>
              ) : (
                (status.data?.capabilities ?? []).map((c) => (
                  <span key={c} className="label label-default mr-xxs mb-xxs">
                    {c}
                  </span>
                ))
              )}
            </dd>
          </dl>
        </div>
      </div>

      <div className="box box-primary">
        <div className="box-header with-border">
          <h3 className="box-title">Connector statuses</h3>
        </div>
        <div className="box-body no-padding overflow-x-auto">
          <table className="table table-striped">
            <thead>
              <tr>
                <th>Connector</th>
                <th>Status</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(status.data?.connectors ?? {}).length === 0 && (
                <tr>
                  <td colSpan={3} className="text-muted text-center">
                    No connectors registered
                  </td>
                </tr>
              )}
              {Object.entries(status.data?.connectors ?? {}).map(([name, info]) => (
                <tr key={name}>
                  <td>
                    <strong>{name}</strong>
                  </td>
                  <td>
                    <span
                      className={
                        info.status === 'ok' || info.status === 'OK'
                          ? 'label label-success'
                          : 'label label-warning'
                      }
                    >
                      {info.status || 'unknown'}
                    </span>
                  </td>
                  <td>{info.message || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}

function HealthCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'success' | 'warning';
}) {
  return (
    <div className="box box-primary">
      <div className="box-body flex items-center gap-3">
        <div className="mini-stat-icon" style={{ background: 'rgba(60,141,188,0.12)', color: '#3c8dbc' }}>
          {icon}
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
          <div>
            <span className={tone === 'success' ? 'label label-success' : 'label label-warning'}>{value}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
