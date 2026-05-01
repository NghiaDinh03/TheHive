'use client';

import { BarChart3, PieChart, TrendingUp, Hash, List } from '@/components/FaIcon';

export type WidgetType = 'counter' | 'bar' | 'pie' | 'line' | 'list' | 'text';

export type WidgetDatum = {
  key?: string;
  date?: string;
  count?: number;
  title?: string;
  name?: string;
  _id?: string;
  [key: string]: unknown;
};

export interface WidgetDefinition {
  id: string;
  type: WidgetType;
  title: string;
  span?: number;
  entity?: string;
  field?: string;
  dateField?: string;
  interval?: string;
  filter?: string;
  content?: string;
  data?: WidgetDatum[] | Record<string, number> | number | string;
  loading?: boolean;
  error?: string;
}

interface DashboardWidgetProps {
  widget: WidgetDefinition;
  onEdit?: (widget: WidgetDefinition) => void;
  onDelete?: (widgetId: string) => void;
  editable?: boolean;
}

const WIDGET_ICONS: Record<WidgetType, typeof BarChart3> = {
  counter: Hash,
  bar: BarChart3,
  pie: PieChart,
  line: TrendingUp,
  list: List,
  text: List,
};

export function DashboardWidget({ widget, onEdit, onDelete, editable }: DashboardWidgetProps) {
  const Icon = WIDGET_ICONS[widget.type] || BarChart3;

  return (
    <div className="dashboard-widget">
      <div className="dashboard-widget-header">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-thehive-primary" />
          <h4>{widget.title}</h4>
        </div>
        {editable && (
          <div className="flex items-center gap-1">
            {onEdit && (
              <button type="button" className="thehive-btn-sm" onClick={() => onEdit(widget)} title="Edit widget">
                Edit
              </button>
            )}
            {onDelete && (
              <button type="button" className="thehive-btn-sm danger" onClick={() => onDelete(widget.id)} title="Remove widget">
                ×
              </button>
            )}
          </div>
        )}
      </div>
      <div className="dashboard-widget-body">
        {widget.loading ? <div className="thehive-empty">Loading…</div> : null}
        {!widget.loading && widget.error ? <div className="thehive-empty text-red-600">{widget.error}</div> : null}
        {!widget.loading && !widget.error ? <WidgetContent widget={widget} /> : null}
      </div>
    </div>
  );
}

function WidgetContent({ widget }: { widget: WidgetDefinition }) {
  switch (widget.type) {
    case 'counter':
      return <CounterWidget value={counterValue(widget.data)} entity={widget.entity} />;
    case 'bar':
      return <BarWidget data={seriesData(widget.data)} />;
    case 'pie':
      return <PieWidget data={seriesData(widget.data)} />;
    case 'line':
      return <LineWidget data={seriesData(widget.data)} />;
    case 'list':
      return <ListWidget data={listData(widget.data)} />;
    case 'text':
      return <TextWidget content={widget.content} />;
    default:
      return <div className="thehive-empty">Unknown widget type: {widget.type}</div>;
  }
}

function counterValue(data: WidgetDefinition['data']): number | undefined {
  if (typeof data === 'number') return data;
  if (Array.isArray(data)) {
    const first = data[0];
    if (typeof first?.count === 'number') return first.count;
  }
  return undefined;
}

function seriesData(data: WidgetDefinition['data']): Record<string, number> | undefined {
  if (!data) return undefined;
  if (!Array.isArray(data) && typeof data === 'object') return data as Record<string, number>;
  if (!Array.isArray(data)) return undefined;
  return data.reduce<Record<string, number>>((acc, item) => {
    const label = String(item.key ?? item.date ?? item.title ?? item.name ?? item._id ?? 'unknown');
    const count = typeof item.count === 'number' ? item.count : 0;
    acc[label] = count;
    return acc;
  }, {});
}

function listData(data: WidgetDefinition['data']): WidgetDatum[] | Record<string, number> | undefined {
  if (!data) return undefined;
  if (Array.isArray(data)) return data;
  if (typeof data === 'object') return data as Record<string, number>;
  return undefined;
}

function CounterWidget({ value, entity }: { value?: number; entity?: string }) {
  return (
    <div className="text-center py-4">
      <div className="text-3xl font-bold" style={{ color: 'var(--thehive-primary)' }}>
        {value !== undefined ? value : '—'}
      </div>
      {entity && <div className="text-sm text-thehive-muted mt-1 uppercase tracking-wider">{entity}</div>}
    </div>
  );
}

const BAR_COLORS = ['#3c8dbc', '#00a65a', '#f39c12', '#dd4b39', '#605ca8', '#00c0ef', '#777'];

function BarWidget({ data }: { data?: Record<string, number> }) {
  if (!data || Object.keys(data).length === 0) return <div className="thehive-empty">No data</div>;
  const entries = Object.entries(data);
  const maxVal = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <div className="space-y-2">
      {entries.map(([label, value], i) => (
        <div key={label} className="flex items-center gap-2">
          <span className="text-xs w-24 truncate text-right" title={label}>{label}</span>
          <div className="flex-1 bg-gray-100 rounded h-5 overflow-hidden">
            <div className="h-full rounded transition-all" style={{ width: `${(value / maxVal) * 100}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }} />
          </div>
          <span className="text-xs w-8 text-right font-medium">{value}</span>
        </div>
      ))}
    </div>
  );
}

function PieWidget({ data }: { data?: Record<string, number> }) {
  if (!data || Object.keys(data).length === 0) return <div className="thehive-empty">No data</div>;
  const entries = Object.entries(data);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);

  return (
    <div className="space-y-1">
      {entries.map(([label, value], i) => (
        <div key={label} className="flex items-center gap-2 text-xs">
          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }} />
          <span className="flex-1 truncate">{label}</span>
          <span className="font-medium">{value}</span>
          <span className="text-thehive-muted">({total > 0 ? Math.round((value / total) * 100) : 0}%)</span>
        </div>
      ))}
    </div>
  );
}

function LineWidget({ data }: { data?: Record<string, number> }) {
  if (!data || Object.keys(data).length === 0) return <div className="thehive-empty">No data</div>;
  const entries = Object.entries(data);
  const maxVal = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <div className="flex items-end gap-1 h-16">
      {entries.map(([label, value]) => (
        <div key={label} className="flex-1 rounded-t transition-all" style={{ height: `${(value / maxVal) * 100}%`, backgroundColor: 'var(--thehive-primary)', minHeight: '2px' }} title={`${label}: ${value}`} />
      ))}
    </div>
  );
}

function ListWidget({ data }: { data?: WidgetDatum[] | Record<string, number> }) {
  if (!data || (Array.isArray(data) && data.length === 0) || (!Array.isArray(data) && Object.keys(data).length === 0)) {
    return <div className="thehive-empty">No data</div>;
  }

  const rows = Array.isArray(data)
    ? data.map((item) => ({ label: String(item.title ?? item.name ?? item.key ?? item._id ?? 'item'), value: String(item.status ?? item.count ?? item.severity ?? item.type ?? '') }))
    : Object.entries(data).sort(([, a], [, b]) => b - a).map(([label, value]) => ({ label, value: String(value) }));

  return (
    <table className="thehive-table">
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td>{row.label}</td>
            <td className="text-right font-medium">{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TextWidget({ content }: { content?: string }) {
  return <div className="detail-markdown">{content || <span className="text-thehive-muted">No content</span>}</div>;
}
