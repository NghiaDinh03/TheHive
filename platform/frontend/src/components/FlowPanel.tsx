'use client';

/**
 * Flow panel — mirrors TheHive 4 legacy flow/flow.html and flow/flow-item.html.
 * Renders a timeline of entity changes (audit flow) with typed icons per entity.
 * Used in case detail sidebar and live stream.
 */

import { Activity, AlertTriangle, Bell, Briefcase, CheckSquare, Eye, FileText, LayoutDashboard, Link2, Shield, User } from '@/components/FaIcon';

export type FlowItem = {
  id: string;
  objectType: string;
  action: string;
  objectId: string;
  objectTitle?: string;
  actorId?: string;
  createdAt: string;
  details?: Record<string, unknown>;
};

type FlowPanelProps = {
  items: FlowItem[];
  maxHeight?: number;
  showActor?: boolean;
  onItemClick?: (item: FlowItem) => void;
};

function entityIcon(type: string) {
  switch (type.toLowerCase()) {
    case 'case': return <Briefcase size={12} />;
    case 'case_task': return <CheckSquare size={12} />;
    case 'case_task_log': return <FileText size={12} />;
    case 'case_artifact': return <Eye size={12} />;
    case 'case_artifact_job': return <Activity size={12} />;
    case 'alert': return <Bell size={12} />;
    case 'action': return <Activity size={12} />;
    case 'casetemplate': return <FileText size={12} />;
    case 'organisation': return <Shield size={12} />;
    case 'dashboard': return <LayoutDashboard size={12} />;
    case 'procedure': return <Link2 size={12} />;
    case 'user': return <User size={12} />;
    default: return <Activity size={12} />;
  }
}

function actionLabel(action: string): string {
  switch (action.toLowerCase()) {
    case 'create': return 'created';
    case 'update': return 'updated';
    case 'delete': return 'deleted';
    case 'merge': return 'merged';
    case 'import': return 'imported';
    case 'close': return 'closed';
    case 'reopen': return 'reopened';
    default: return action;
  }
}

function actionClass(action: string): string {
  switch (action.toLowerCase()) {
    case 'create': return 'label-success';
    case 'update': return 'label-info';
    case 'delete': return 'label-danger';
    case 'merge': return 'label-warning';
    case 'import': return 'label-primary';
    case 'close': return 'label-warning';
    default: return 'label-default';
  }
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
});
function fmt(v: string): string {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '-' : dateFormatter.format(d);
}

export function FlowPanel({ items, maxHeight, showActor = true, onItemClick }: FlowPanelProps) {
  if (!items.length) {
    return <div className="thehive-empty">No flow events.</div>;
  }

  return (
    <div className="flow" style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}>
      {items.map((item) => (
        <div
          key={item.id}
          className={`flow-item flow-item-${item.objectType}`}
          onClick={() => onItemClick?.(item)}
          style={{ cursor: onItemClick ? 'pointer' : 'default' }}
        >
          <div className="flow-item-icon">
            {entityIcon(item.objectType)}
          </div>
          <div className="flow-item-content">
            <div className="flow-item-header">
              <span className={`label ${actionClass(item.action)}`} style={{ fontSize: '0.68rem' }}>
                {actionLabel(item.action)}
              </span>
              <span className="flow-item-type text-muted">{item.objectType.replace(/_/g, ' ')}</span>
            </div>
            {item.objectTitle && (
              <div className="flow-item-title">{item.objectTitle}</div>
            )}
            <div className="flow-item-meta">
              {showActor && item.actorId && (
                <span className="flow-item-actor">{item.actorId}</span>
              )}
              <span className="flow-item-date text-muted">{fmt(item.createdAt)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
