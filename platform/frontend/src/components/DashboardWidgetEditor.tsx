'use client';

// Dashboard widget editor cloned from TheHive 4 legacy directives:
//   frontend/app/views/directives/dashboard/{counter,donut,line,multiline,text}/edit.html
// Exposes a tabset (Basic / Series / Filters / Customize / Sort) that mutates a
// widget definition object compatible with TheHive 4 dashboard JSON schema.

import { useState } from 'react';

export type DashboardEntity = 'case' | 'alert' | 'task' | 'observable' | 'log' | 'audit';

export type WidgetSeries = {
  agg?: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'top' | 'time' | 'field';
  field?: string;
  label?: string;
  color?: string;
  filter?: WidgetFilter;
};

export type WidgetFilter = {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'in' | 'contains';
  value: string;
};

export type WidgetDefinition = {
  type: 'counter' | 'donut' | 'line' | 'multiline' | 'text' | 'bar';
  title: string;
  description?: string;
  entity: DashboardEntity;
  field?: string;
  series?: WidgetSeries[];
  filters?: WidgetFilter[];
  sort?: 'asc' | 'desc';
  limit?: number;
  customize?: Record<string, { label?: string; color?: string }>;
  text?: string;
};

const ENTITY_OPTIONS: DashboardEntity[] = ['case', 'alert', 'task', 'observable', 'log', 'audit'];

/**
 * The widget editor is a controlled component: the parent owns
 * `widget` and `setWidget`. Tabs match legacy edit.html layout.
 */
export function DashboardWidgetEditor({
  widget, onChange,
}: { widget: WidgetDefinition; onChange: (next: WidgetDefinition) => void }) {
  const [tab, setTab] = useState<'basic' | 'series' | 'filters' | 'sort' | 'customize'>('basic');

  const showSeries = widget.type === 'counter' || widget.type === 'line' || widget.type === 'multiline' || widget.type === 'bar';
  const showSort = widget.type === 'donut' || widget.type === 'bar';
  const showCustomize = widget.type === 'donut' || widget.type === 'bar';

  return (
    <div className="nav-tabs-custom dashboard-widget-editor">
      <ul className="nav nav-tabs">
        <li className={tab === 'basic' ? 'active' : ''}><button type="button" onClick={() => setTab('basic')}><i className="fa fa-bars" /> Basic</button></li>
        {showSeries && <li className={tab === 'series' ? 'active' : ''}><button type="button" onClick={() => setTab('series')}><i className="fa fa-sort" /> Series</button></li>}
        {showSort && <li className={tab === 'sort' ? 'active' : ''}><button type="button" onClick={() => setTab('sort')}><i className="fa fa-sort" /> Sort</button></li>}
        <li className={tab === 'filters' ? 'active' : ''}><button type="button" onClick={() => setTab('filters')}><i className="fa fa-filter" /> Filters</button></li>
        {showCustomize && <li className={tab === 'customize' ? 'active' : ''}><button type="button" onClick={() => setTab('customize')}><i className="fa fa-paint-brush" /> Customize</button></li>}
      </ul>
      <div className="tab-content widget-editor-pane">
        {tab === 'basic' && <BasicTab widget={widget} onChange={onChange} />}
        {tab === 'series' && showSeries && <SeriesTab widget={widget} onChange={onChange} />}
        {tab === 'sort' && showSort && <SortTab widget={widget} onChange={onChange} />}
        {tab === 'filters' && <FiltersTab widget={widget} onChange={onChange} />}
        {tab === 'customize' && showCustomize && <CustomizeTab widget={widget} onChange={onChange} />}
      </div>
    </div>
  );
}

function BasicTab({ widget, onChange }: { widget: WidgetDefinition; onChange: (w: WidgetDefinition) => void }) {
  return (
    <div className="form-horizontal">
      <div className="form-group">
        <label className="col-sm-3 control-label">Widget type</label>
        <div className="col-sm-9">
          <select className="form-control input-sm" value={widget.type} onChange={(event) => onChange({ ...widget, type: event.target.value as WidgetDefinition['type'] })}>
            <option value="counter">Counter</option>
            <option value="donut">Donut</option>
            <option value="line">Line</option>
            <option value="multiline">Multi-line</option>
            <option value="bar">Bar</option>
            <option value="text">Text / Markdown</option>
          </select>
        </div>
      </div>
      <div className="form-group">
        <label className="col-sm-3 control-label">Title</label>
        <div className="col-sm-9">
          <input className="form-control input-sm" value={widget.title} onChange={(event) => onChange({ ...widget, title: event.target.value })} />
        </div>
      </div>
      <div className="form-group">
        <label className="col-sm-3 control-label">Description</label>
        <div className="col-sm-9">
          <input className="form-control input-sm" value={widget.description ?? ''} onChange={(event) => onChange({ ...widget, description: event.target.value })} />
        </div>
      </div>
      {widget.type !== 'text' ? (
        <>
          <div className="form-group">
            <label className="col-sm-3 control-label">Entity</label>
            <div className="col-sm-9">
              <select className="form-control input-sm" value={widget.entity} onChange={(event) => onChange({ ...widget, entity: event.target.value as DashboardEntity })}>
                {ENTITY_OPTIONS.map((entity) => <option key={entity} value={entity}>{entity}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="col-sm-3 control-label">Field</label>
            <div className="col-sm-9">
              <input className="form-control input-sm" placeholder="e.g. status, severity, tlp, tags" value={widget.field ?? ''} onChange={(event) => onChange({ ...widget, field: event.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="col-sm-3 control-label">Limit</label>
            <div className="col-sm-9">
              <input type="number" className="form-control input-sm" value={widget.limit ?? 10} onChange={(event) => onChange({ ...widget, limit: Number(event.target.value) || 10 })} />
            </div>
          </div>
        </>
      ) : (
        <div className="form-group">
          <label className="col-sm-3 control-label">Markdown</label>
          <div className="col-sm-9">
            <textarea className="form-control" rows={6} value={widget.text ?? ''} onChange={(event) => onChange({ ...widget, text: event.target.value })} />
          </div>
        </div>
      )}
    </div>
  );
}

function SeriesTab({ widget, onChange }: { widget: WidgetDefinition; onChange: (w: WidgetDefinition) => void }) {
  const series = widget.series ?? [];
  function patch(index: number, change: Partial<WidgetSeries>) {
    const next = series.slice();
    next[index] = { ...next[index], ...change };
    onChange({ ...widget, series: next });
  }
  function remove(index: number) { onChange({ ...widget, series: series.filter((_, i) => i !== index) }); }
  function add() { onChange({ ...widget, series: [...series, { agg: 'count', label: `Series ${series.length + 1}`, color: '#3c8dbc' }] }); }
  return (
    <div className="widget-series-editor">
      <table className="table table-condensed">
        <thead><tr><th>Aggregation</th><th>Field</th><th>Label</th><th style={{ width: 80 }}>Colour</th><th style={{ width: 30 }} /></tr></thead>
        <tbody>
          {series.map((row, index) => (
            <tr key={index}>
              <td><select className="form-control input-sm" value={row.agg ?? 'count'} onChange={(event) => patch(index, { agg: event.target.value as WidgetSeries['agg'] })}>
                {['count', 'sum', 'avg', 'min', 'max', 'top', 'time', 'field'].map((agg) => <option key={agg} value={agg}>{agg}</option>)}
              </select></td>
              <td><input className="form-control input-sm" value={row.field ?? ''} onChange={(event) => patch(index, { field: event.target.value })} /></td>
              <td><input className="form-control input-sm" value={row.label ?? ''} onChange={(event) => patch(index, { label: event.target.value })} /></td>
              <td><input type="color" className="form-control input-sm" value={row.color ?? '#3c8dbc'} onChange={(event) => patch(index, { color: event.target.value })} /></td>
              <td><button type="button" className="btn btn-icon btn-clear" onClick={() => remove(index)} title="Remove series"><i className="fa fa-times text-danger" /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="btn btn-sm btn-primary" onClick={add}><i className="fa fa-plus" /> Add series</button>
    </div>
  );
}

function FiltersTab({ widget, onChange }: { widget: WidgetDefinition; onChange: (w: WidgetDefinition) => void }) {
  const filters = widget.filters ?? [];
  function patch(index: number, change: Partial<WidgetFilter>) {
    const next = filters.slice(); next[index] = { ...next[index], ...change };
    onChange({ ...widget, filters: next });
  }
  function remove(index: number) { onChange({ ...widget, filters: filters.filter((_, i) => i !== index) }); }
  function add() { onChange({ ...widget, filters: [...filters, { field: '', operator: 'eq', value: '' }] }); }
  return (
    <div className="widget-filters-editor">
      <table className="table table-condensed">
        <thead><tr><th>Field</th><th>Operator</th><th>Value</th><th style={{ width: 30 }} /></tr></thead>
        <tbody>
          {filters.map((row, index) => (
            <tr key={index}>
              <td><input className="form-control input-sm" value={row.field} onChange={(event) => patch(index, { field: event.target.value })} /></td>
              <td><select className="form-control input-sm" value={row.operator} onChange={(event) => patch(index, { operator: event.target.value as WidgetFilter['operator'] })}>
                {['eq', 'neq', 'gt', 'lt', 'in', 'contains'].map((operator) => <option key={operator} value={operator}>{operator}</option>)}
              </select></td>
              <td><input className="form-control input-sm" value={row.value} onChange={(event) => patch(index, { value: event.target.value })} /></td>
              <td><button type="button" className="btn btn-icon btn-clear" onClick={() => remove(index)} title="Remove filter"><i className="fa fa-times text-danger" /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="btn btn-sm btn-primary" onClick={add}><i className="fa fa-plus" /> Add filter</button>
    </div>
  );
}

function SortTab({ widget, onChange }: { widget: WidgetDefinition; onChange: (w: WidgetDefinition) => void }) {
  return (
    <div className="form-horizontal">
      <div className="form-group">
        <label className="col-sm-3 control-label">Sort direction</label>
        <div className="col-sm-9">
          <select className="form-control input-sm" value={widget.sort ?? 'desc'} onChange={(event) => onChange({ ...widget, sort: event.target.value as 'asc' | 'desc' })}>
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function CustomizeTab({ widget, onChange }: { widget: WidgetDefinition; onChange: (w: WidgetDefinition) => void }) {
  const customize = widget.customize ?? {};
  const keys = Object.keys(customize);
  function patch(key: string, change: { label?: string; color?: string }) {
    onChange({ ...widget, customize: { ...customize, [key]: { ...(customize[key] ?? {}), ...change } } });
  }
  function remove(key: string) {
    const copy = { ...customize }; delete copy[key];
    onChange({ ...widget, customize: copy });
  }
  function addKey() {
    const candidate = window.prompt('Value to customise (e.g. Open, Resolved, 1, 2):');
    if (candidate) patch(candidate, {});
  }
  return (
    <div className="widget-customize-editor">
      <p className="text-muted">Override label and colour for specific values reported by the aggregation.</p>
      <table className="table table-condensed">
        <thead><tr><th>Value</th><th>Display label</th><th style={{ width: 80 }}>Colour</th><th style={{ width: 30 }} /></tr></thead>
        <tbody>
          {keys.map((key) => (
            <tr key={key}>
              <td><code>{key}</code></td>
              <td><input className="form-control input-sm" value={customize[key]?.label ?? ''} onChange={(event) => patch(key, { label: event.target.value })} /></td>
              <td><input type="color" className="form-control input-sm" value={customize[key]?.color ?? '#3c8dbc'} onChange={(event) => patch(key, { color: event.target.value })} /></td>
              <td><button type="button" className="btn btn-icon btn-clear" onClick={() => remove(key)} title="Remove"><i className="fa fa-times text-danger" /></button></td>
            </tr>
          ))}
          {keys.length === 0 && <tr><td colSpan={4}><em className="text-muted">No customisation rules.</em></td></tr>}
        </tbody>
      </table>
      <button type="button" className="btn btn-sm btn-primary" onClick={addKey}><i className="fa fa-plus" /> Add value override</button>
    </div>
  );
}
