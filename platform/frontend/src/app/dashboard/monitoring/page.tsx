'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';

interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  activeUsers: number;
  requestsPerSec: number;
  avgResponseMs: number;
  errorRate: number;
  timestamp: string;
}

interface AlertMetrics {
  totalAlerts: number;
  newAlerts: number;
  importedAlerts: number;
  mergedAlerts: number;
  ignoredAlerts: number;
  bySeverity: Record<string, number>;
  bySource: Record<string, number>;
  avgResolutionMs: number;
  timestamp: string;
}

interface CaseMetrics {
  totalCases: number;
  openCases: number;
  resolvedCases: number;
  duplicatedCases: number;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  byOwner: Record<string, number>;
  avgResolutionMs: number;
  timestamp: string;
}

interface WorkerMetrics {
  activeWorkers: number;
  queuedJobs: number;
  processingJobs: number;
  completedJobs: number;
  failedJobs: number;
  byType: Record<string, number>;
  avgProcessingMs: number;
  timestamp: string;
}

function MetricCard({ title, value, unit, color }: { title: string; value: number | string; unit?: string; color?: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="text-sm text-gray-500 mb-1">{title}</div>
      <div className={`text-2xl font-bold ${color || 'text-gray-900'}`}>
        {value}{unit && <span className="text-sm font-normal ml-1">{unit}</span>}
      </div>
    </div>
  );
}

function ProgressBar({ value, max, color }: { value: number; max: number; color?: string }) {
  const percentage = Math.min((value / max) * 100, 100);
  return (
    <div className="w-full bg-gray-200 rounded-full h-2.5">
      <div
        className={`h-2.5 rounded-full ${color || 'bg-blue-600'}`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

function SeverityBadge({ severity, count }: { severity: string; count: number }) {
  const colors: Record<string, string> = {
    low: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[severity] || 'bg-gray-100 text-gray-800'}`}>
      {severity}: {count}
    </span>
  );
}

export default function DashboardMonitoringPage() {
  const [autoRefresh, setAutoRefresh] = useState<number | null>(30);

  const { data: systemMetrics, refetch: refetchSystem } = useQuery<SystemMetrics>({
    queryKey: ['monitoring', 'system'],
    queryFn: () => apiFetch('/api/v1/monitor/system'),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  const { data: alertMetrics, refetch: refetchAlerts } = useQuery<AlertMetrics>({
    queryKey: ['monitoring', 'alerts'],
    queryFn: () => apiFetch('/api/v1/monitor/alerts'),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  const { data: caseMetrics, refetch: refetchCases } = useQuery<CaseMetrics>({
    queryKey: ['monitoring', 'cases'],
    queryFn: () => apiFetch('/api/v1/monitor/cases'),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  const { data: workerMetrics, refetch: refetchWorkers } = useQuery<WorkerMetrics>({
    queryKey: ['monitoring', 'workers'],
    queryFn: () => apiFetch('/api/v1/monitor/workers'),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  const handleRefreshAll = () => {
    refetchSystem();
    refetchAlerts();
    refetchCases();
    refetchWorkers();
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Topbar />
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Dashboard Monitoring</h1>
                <p className="text-sm text-gray-500">Real-time system and operational metrics</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Auto-refresh:</span>
                  <select
                    value={autoRefresh || ''}
                    onChange={(e) => setAutoRefresh(e.target.value ? Number(e.target.value) : null)}
                    className="text-sm border rounded px-2 py-1"
                  >
                    <option value="">Off</option>
                    <option value="10">10s</option>
                    <option value="30">30s</option>
                    <option value="60">1m</option>
                    <option value="300">5m</option>
                  </select>
                </div>
                <button
                  onClick={handleRefreshAll}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                >
                  Refresh Now
                </button>
              </div>
            </div>

            {/* System Metrics */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">System Performance</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="CPU Usage"
                  value={systemMetrics?.cpuUsage?.toFixed(1) || '0'}
                  unit="%"
                  color={systemMetrics && systemMetrics.cpuUsage > 80 ? 'text-red-600' : 'text-gray-900'}
                />
                <MetricCard
                  title="Memory Usage"
                  value={systemMetrics?.memoryUsage?.toFixed(1) || '0'}
                  unit="%"
                  color={systemMetrics && systemMetrics.memoryUsage > 80 ? 'text-red-600' : 'text-gray-900'}
                />
                <MetricCard
                  title="Disk Usage"
                  value={systemMetrics?.diskUsage?.toFixed(1) || '0'}
                  unit="%"
                  color={systemMetrics && systemMetrics.diskUsage > 80 ? 'text-red-600' : 'text-gray-900'}
                />
                <MetricCard
                  title="Active Users"
                  value={systemMetrics?.activeUsers || 0}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <MetricCard
                  title="Requests/sec"
                  value={systemMetrics?.requestsPerSec?.toFixed(1) || '0'}
                />
                <MetricCard
                  title="Avg Response"
                  value={systemMetrics?.avgResponseMs?.toFixed(1) || '0'}
                  unit="ms"
                />
                <MetricCard
                  title="Error Rate"
                  value={systemMetrics?.errorRate?.toFixed(2) || '0'}
                  unit="%"
                  color={systemMetrics && systemMetrics.errorRate > 1 ? 'text-red-600' : 'text-green-600'}
                />
              </div>
            </div>

            {/* Alert Metrics */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Alert Metrics</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <MetricCard title="Total Alerts" value={alertMetrics?.totalAlerts || 0} />
                <MetricCard title="New Alerts" value={alertMetrics?.newAlerts || 0} color="text-blue-600" />
                <MetricCard title="Imported" value={alertMetrics?.importedAlerts || 0} color="text-green-600" />
                <MetricCard title="Merged" value={alertMetrics?.mergedAlerts || 0} color="text-purple-600" />
                <MetricCard title="Ignored" value={alertMetrics?.ignoredAlerts || 0} color="text-gray-500" />
              </div>
              <div className="mt-4 bg-white rounded-lg shadow p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-medium text-gray-700">By Severity:</span>
                  {alertMetrics?.bySeverity && Object.entries(alertMetrics.bySeverity).map(([severity, count]) => (
                    <SeverityBadge key={severity} severity={severity} count={count} />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">By Source:</span>
                  {alertMetrics?.bySource && Object.entries(alertMetrics.bySource).map(([source, count]) => (
                    <span key={source} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {source}: {count}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Case Metrics */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Case Metrics</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard title="Total Cases" value={caseMetrics?.totalCases || 0} />
                <MetricCard title="Open Cases" value={caseMetrics?.openCases || 0} color="text-blue-600" />
                <MetricCard title="Resolved" value={caseMetrics?.resolvedCases || 0} color="text-green-600" />
                <MetricCard title="Duplicated" value={caseMetrics?.duplicatedCases || 0} color="text-yellow-600" />
              </div>
              <div className="mt-4 bg-white rounded-lg shadow p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-medium text-gray-700">By Severity:</span>
                  {caseMetrics?.bySeverity && Object.entries(caseMetrics.bySeverity).map(([severity, count]) => (
                    <SeverityBadge key={severity} severity={severity} count={count} />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">By Status:</span>
                  {caseMetrics?.byStatus && Object.entries(caseMetrics.byStatus).map(([status, count]) => (
                    <span key={status} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {status}: {count}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Worker Metrics */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Worker Queue</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <MetricCard title="Active Workers" value={workerMetrics?.activeWorkers || 0} color="text-green-600" />
                <MetricCard title="Queued Jobs" value={workerMetrics?.queuedJobs || 0} color="text-yellow-600" />
                <MetricCard title="Processing" value={workerMetrics?.processingJobs || 0} color="text-blue-600" />
                <MetricCard title="Completed" value={workerMetrics?.completedJobs || 0} color="text-green-600" />
                <MetricCard title="Failed" value={workerMetrics?.failedJobs || 0} color="text-red-600" />
              </div>
              <div className="mt-4 bg-white rounded-lg shadow p-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">By Type:</span>
                  {workerMetrics?.byType && Object.entries(workerMetrics.byType).map(([type, count]) => (
                    <span key={type} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      {type}: {count}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Timestamp */}
            <div className="text-xs text-gray-400 text-center">
              Last updated: {systemMetrics?.timestamp ? new Date(systemMetrics.timestamp).toLocaleString() : 'Never'}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
