'use client';

/**
 * Flow panel — mirrors TheHive 4 legacy flow/flow.html and flow/flow-item.html.
 * Renders a timeline of entity changes (audit flow) with typed icons per entity.
 * Used in case detail sidebar and live stream.
 */

import { Activity, AlertTriangle, Bell, Briefcase, CheckSquare, Eye, FileText, LayoutDashboard, Link2, Shield, User } from '@/components/FaIcon';
import { InfoTooltip } from '@/components/ui/TooltipHelper';

export type FlowItem = {
  id: string;
  objectType: string;
  action: string;
  objectId: string;
  objectTitle?: string;
  actorId?: string;
  createdAt: string;
  beforeJson?: string;
  afterJson?: string;
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
    case 'create': return 'bg-green-900/30 text-green-400 border-green-800/30';
    case 'update': return 'bg-blue-900/30 text-blue-400 border-blue-800/30';
    case 'delete': return 'bg-red-900/30 text-red-400 border-red-800/30';
    case 'merge': return 'bg-yellow-900/30 text-yellow-400 border-yellow-800/30';
    case 'import': return 'bg-purple-900/30 text-purple-400 border-purple-800/30';
    case 'close': return 'bg-orange-900/30 text-orange-400 border-orange-800/30';
    default: return 'bg-slate-700/50 text-slate-300 border-slate-600/50';
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

function prettyJson(str?: string): string {
  if (!str) return '';
  try {
    const parsed = JSON.parse(str);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return str;
  }
}

export function FlowPanel({ items, maxHeight, showActor = true, onItemClick }: FlowPanelProps) {
  if (!items.length) {
    return <div className="thehive-empty">No flow events.</div>;
  }

  return (
    <div className="flow" style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}>
      {items.map((item) => (
        <InfoTooltip
          key={item.id}
          asChild
          content={
            <div className="flex flex-col gap-1 text-left min-w-[200px] max-w-[400px]">
              <div className="text-slate-200 text-xs border-b border-slate-700/50 pb-2 mb-2 leading-relaxed">
                At <strong className="text-blue-400">{fmt(item.createdAt)}</strong>, user <strong className="text-orange-400">{item.actorId}</strong> performed <strong className="text-slate-100 uppercase text-[10px] tracking-wider bg-slate-800 px-1 py-0.5 rounded">{actionLabel(item.action)}</strong> on this {item.objectType.replace(/_/g, ' ').toLowerCase()}.
              </div>
              {(() => {
                if (!item.afterJson) {
                  return <div className="text-slate-400 text-[11px] mt-1 italic">No extra details</div>;
                }
                if (actionLabel(item.action).toLowerCase() === 'create' || !item.beforeJson || item.beforeJson === item.afterJson) {
                  try {
                    const after = JSON.parse(item.afterJson);
                    const keys = Object.keys(after).filter(k => !['id', 'created_at', 'updated_at'].includes(k));
                    if (keys.length > 0) {
                      return (
                        <div className="text-[11px] mt-1 space-y-1">
                          <div className="text-slate-400 font-medium">Provided data:</div>
                          <ul className="list-disc pl-4 text-slate-300 space-y-0.5">
                            {keys.map(k => (
                              <li key={k}><strong className="text-slate-200">{k}</strong>: {String(after[k])}</li>
                            ))}
                          </ul>
                        </div>
                      );
                    }
                  } catch {}
                  return <div className="text-slate-400 text-[11px] mt-1 italic">No extra details</div>;
                }

                try {
                  const before = JSON.parse(item.beforeJson);
                  const after = JSON.parse(item.afterJson);
                  const changes: { field: string, old: any, new: any }[] = [];
                  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
                  
                  for (const key of allKeys) {
                    if (['id', 'created_at', 'updated_at'].includes(key)) continue;
                    const oldVal = JSON.stringify(before[key] ?? null);
                    const newVal = JSON.stringify(after[key] ?? null);
                    if (oldVal !== newVal) {
                      changes.push({ field: key, old: before[key], new: after[key] });
                    }
                  }

                  if (changes.length === 0) {
                    return <div className="text-slate-400 text-[11px] mt-1 italic">No data changed</div>;
                  }

                  return (
                    <div className="text-[11px] mt-1 space-y-1">
                      <ul className="list-disc pl-4 text-slate-300 space-y-1">
                        {changes.map(c => (
                          <li key={c.field}>
                            Changed <strong className="text-blue-400">{c.field}</strong> from <code className="bg-slate-900 px-1 rounded text-slate-400 line-through">{String(c.old ?? 'empty')}</code> to <code className="bg-slate-900 px-1 rounded text-orange-300">{String(c.new ?? 'empty')}</code>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                } catch {
                  return <div className="text-[11px] mt-1"><pre className="text-slate-300 bg-slate-900/50 p-1.5 rounded">{prettyJson(item.afterJson)}</pre></div>;
                }
              })()}
            </div>
          }
        >
          <div
            className={`flex items-start gap-3 bg-slate-800/40 border border-slate-700/30 rounded-lg p-3 mb-3 text-slate-200 transition-colors hover:bg-slate-700/60 shadow-sm cursor-pointer`}
            onClick={() => onItemClick?.(item)}
          >
            <div className="text-slate-400 bg-slate-900/50 p-1.5 rounded-md shrink-0">
              {entityIcon(item.objectType)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider border ${actionClass(item.action)}`}>
                  {actionLabel(item.action)}
                </span>
                <span className="text-slate-500 text-[10px] uppercase tracking-wider">{item.objectType.replace(/_/g, ' ')}</span>
              </div>
              <div className="mt-1 flex justify-between items-center w-full">
                <span className="text-slate-300 text-[11px] truncate"><i className="fa fa-user mr-1 text-slate-500"></i>{item.actorId || 'System'}</span>
                <span className="text-slate-400 text-[11px] shrink-0"><i className="fa fa-clock-o mr-1 text-slate-500"></i>{fmt(item.createdAt)}</span>
              </div>
            </div>
          </div>
        </InfoTooltip>
      ))}
    </div>
  );
}
