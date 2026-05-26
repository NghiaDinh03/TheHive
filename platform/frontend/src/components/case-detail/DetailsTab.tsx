'use client';

import { InfoTooltip } from '@/components/ui/TooltipHelper';
import { Severity, Tlp, Pap, TagList } from '@/components/Badges';
import { UpdatableSimpleText, UpdatableDate, UpdatableTags, UpdatableText, UpdatableUser } from '@/components/Updatable';
import { CaseCore, CustomField, RelatedCase, ResponderAction } from './types';
import { useState } from 'react';

// Simple single-color Lucide-style SVG Icons to stay clean and professional for SOC-Eye
const IconId = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
    <rect width="18" height="18" x="3" y="3" rx="2"/>
    <path d="M7 21v-4a4 4 0 0 1 8 0v4"/>
    <circle cx="12" cy="11" r="3"/>
  </svg>
);

const IconText = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
    <path d="M17 6.1H3"/>
    <path d="M21 12.1H3"/>
    <path d="M15 18H3"/>
  </svg>
);

const IconDatabase = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
    <ellipse cx="12" cy="5" rx="9" ry="3"/>
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/>
  </svg>
);

interface DetailsTabProps {
  item: CaseCore;
  customFields: CustomField[];
  updateCase: { mutate: (patch?: Record<string, unknown>) => void; isPending: boolean };
  canWrite: boolean;
  relatedCases: RelatedCase[];
  responderActions: ResponderAction[];
  relatedFilter: string;
  setRelatedFilter: (v: string) => void;
  searchUsers: (q: string) => Promise<{ login: string; name: string }[]>;
  meLogin?: string;
  triggerReassign: (newAssignee: string) => void;
}

export default function DetailsTab({
  item,
  updateCase,
  canWrite,
  relatedCases,
  responderActions,
  relatedFilter,
  setRelatedFilter,
  searchUsers,
  meLogin,
  triggerReassign
}: DetailsTabProps) {
  const disabled = !canWrite || updateCase.isPending;

  return (
    <div className="flex flex-col xl:flex-row gap-6 items-stretch">
      {/* Left Column: Basic Details & Description */}
      <div className="flex-1 glass-panel bg-slate-950/40 ring-1 ring-slate-900/60 shadow-2xl rounded-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900/40 flex items-center gap-2">
          <IconId />
          <h4 className="text-slate-200 font-bold text-sm uppercase tracking-wider">Basic Case Details</h4>
        </div>
        
        {/* Metadata Grid */}
        <div className="p-6">
          <div className="grid grid-cols-[140px_1fr] gap-x-6 gap-y-4 items-center text-sm">
            <InfoTooltip content="Unique Title of the Security Case">
              <span className="text-slate-400 font-medium uppercase tracking-wider text-xs select-none">Title</span>
            </InfoTooltip>
            <div className="text-slate-200 font-medium">
              {canWrite ? (
                <UpdatableSimpleText value={item.title} disabled={disabled} onUpdate={(title) => updateCase.mutate({ title })} />
              ) : (
                <span>{item.title}</span>
              )}
            </div>
            
            <InfoTooltip content="Assigned SOC Analyst responsible for triage and containment">
              <span className="text-slate-400 font-medium uppercase tracking-wider text-xs select-none">Assignee</span>
            </InfoTooltip>
            <div>
              {canWrite ? (
                <UpdatableUser
                  value={item.assignee || ''}
                  disabled={disabled}
                  blankText="Unassigned"
                  query={searchUsers}
                  defaultUser={meLogin}
                  onUpdate={(newAssignee) => {
                    if (item.assignee && newAssignee !== item.assignee && newAssignee !== '') {
                      triggerReassign(newAssignee);
                    } else {
                      updateCase.mutate({ assignee: newAssignee });
                    }
                  }}
                />
              ) : item.assignee ? (
                <span className="text-slate-200">{item.assignee}</span>
              ) : (
                <em className="text-yellow-500/80 font-medium text-xs">Unassigned</em>
              )}
            </div>

            <InfoTooltip content="Triage Severity rating">
              <span className="text-slate-400 font-medium uppercase tracking-wider text-xs select-none">Severity</span>
            </InfoTooltip>
            <div>
              {canWrite ? (
                <Severity value={item.severity} active onUpdate={(severity) => updateCase.mutate({ severity })} />
              ) : (
                <Severity value={item.severity} />
              )}
            </div>
            
            <InfoTooltip content="Traffic Light Protocol (Data Sharing restriction)">
              <span className="text-slate-400 font-medium uppercase tracking-wider text-xs select-none">TLP restriction</span>
            </InfoTooltip>
            <div>
              {canWrite ? (
                <Tlp value={item.tlp} format="active" onUpdate={(tlp) => updateCase.mutate({ tlp })} />
              ) : (
                <Tlp value={item.tlp} />
              )}
            </div>
            
            <InfoTooltip content="Permissible Actions Protocol (Operational restriction)">
              <span className="text-slate-400 font-medium uppercase tracking-wider text-xs select-none">PAP restriction</span>
            </InfoTooltip>
            <div>
              {canWrite ? (
                <Pap value={item.pap} format="active" onUpdate={(pap) => updateCase.mutate({ pap })} />
              ) : (
                <Pap value={item.pap} />
              )}
            </div>
            
            <InfoTooltip content="Exact timestamp when the security incident occurred">
              <span className="text-slate-400 font-medium uppercase tracking-wider text-xs select-none">Date occurred</span>
            </InfoTooltip>
            <div className="text-slate-300">
              {canWrite ? (
                <UpdatableDate value={item.start_date ?? null} disabled={disabled} onUpdate={(start_date) => updateCase.mutate({ start_date })} clearable />
              ) : item.start_date ? (
                <span>{new Date(item.start_date).toLocaleString()}</span>
              ) : (
                <em className="text-slate-500 text-xs">Undefined</em>
              )}
            </div>
            
            <InfoTooltip content="Categorization tags for threat lookup">
              <span className="text-slate-400 font-medium uppercase tracking-wider text-xs select-none">Tags</span>
            </InfoTooltip>
            <div>
              {canWrite ? (
                <UpdatableTags value={item.tags ?? []} disabled={disabled} onUpdate={(tags) => updateCase.mutate({ tags })} clearable />
              ) : (
                <TagList data={item.tags} />
              )}
            </div>
            
            {item.status !== 'Open' && (
              <>
                <span className="text-green-500 font-semibold uppercase tracking-wider text-xs select-none">Closed date</span>
                <span className="text-green-400 font-semibold">{item.end_date ? new Date(item.end_date).toLocaleString() : <em>Undefined</em>}</span>
              </>
            )}
          </div>
        </div>

        {/* Description & Summary Section */}
        <div className="px-6 py-4 bg-slate-900/40 flex items-center gap-2">
          <IconText />
          <h4 className="text-slate-200 font-bold text-sm uppercase tracking-wider">Incident narrative</h4>
        </div>
        <div className="p-6 flex-1 flex flex-col gap-6">
          <div>
            <span className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 select-none">Incident description</span>
            {canWrite ? (
              <UpdatableText value={item.description || ''} disabled={disabled} onUpdate={(description) => updateCase.mutate({ description })} clearable />
            ) : (
              <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{item.description || <em className="text-slate-500">No description provided.</em>}</div>
            )}
          </div>
          {(item.summary || item.status !== 'Open') && (
            <div className="pt-5">
              <span className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 select-none">Closure summary</span>
              {canWrite ? (
                <UpdatableText value={item.summary || ''} disabled={disabled} onUpdate={(summary) => updateCase.mutate({ summary })} clearable />
              ) : (
                <div className="text-sm text-slate-300 bg-slate-900/20 p-4 rounded-xl ring-1 ring-slate-900/60 leading-relaxed font-mono">{item.summary || <em className="text-slate-500">No closure summary provided yet.</em>}</div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Right Column: Additional Metadata, Related Cases, and Actions */}
      <div className="w-full xl:w-[420px] shrink-0 flex flex-col gap-6">
        {/* Additional details */}
        <div className="glass-panel bg-slate-950/40 ring-1 ring-slate-900/60 shadow-2xl rounded-2xl overflow-hidden">
          <div className="px-6 py-4 bg-slate-900/40 flex items-center gap-2">
            <IconDatabase />
            <h4 className="text-slate-200 font-bold text-sm uppercase tracking-wider">System Metadata</h4>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-[110px_1fr] gap-x-4 gap-y-4 items-center text-xs">
              <span className="text-slate-400 font-medium">Owner</span>
              <span className="text-slate-200 font-semibold bg-slate-900/50 px-3 py-1.5 rounded-lg ring-1 ring-slate-900/60 truncate">{item.owner || 'System Creator'}</span>
              
              <span className="text-slate-400 font-medium">Organization</span>
              <span className="text-slate-200 font-semibold bg-slate-900/50 px-3 py-1.5 rounded-lg ring-1 ring-slate-900/60 truncate">{item.owning_organisation || 'Global SOC'}</span>
              
              <span className="text-slate-400 font-medium">Case Template</span>
              <span className="text-slate-300 font-medium bg-slate-900/50 px-3 py-1.5 rounded-lg ring-1 ring-slate-900/60 truncate italic">{item.case_template || 'None'}</span>
              
              <span className="text-slate-400 font-medium">Impact Status</span>
              <span className="text-slate-300 font-semibold bg-slate-900/50 px-3 py-1.5 rounded-lg ring-1 ring-slate-900/60">
                {item.impact_status === 'NoImpact' ? 'No Impact' : item.impact_status === 'WithImpact' ? 'With Impact' : item.impact_status === 'NotApplicable' ? 'Not Applicable' : item.impact_status || '—'}
              </span>
              
              <span className="text-slate-400 font-medium">Resolution</span>
              <span className="text-slate-300 font-semibold bg-slate-900/50 px-3 py-1.5 rounded-lg ring-1 ring-slate-900/60">
                {item.resolution_status === 'TruePositive' ? 'True Positive' : item.resolution_status === 'FalsePositive' ? 'False Positive' : item.resolution_status === 'Indeterminate' ? 'Indeterminate' : item.resolution_status === 'Other' ? 'Other' : item.resolution_status || '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Related Cases */}
        <div className="glass-panel bg-slate-950/40 ring-1 ring-slate-900/60 shadow-2xl rounded-2xl overflow-hidden">
          <RelatedCasesPanel relatedCases={relatedCases} filter={relatedFilter} setFilter={setRelatedFilter} />
        </div>

        {/* Responder Actions */}
        <div className="glass-panel bg-slate-950/40 ring-1 ring-slate-900/60 shadow-2xl rounded-2xl overflow-hidden">
          <ResponderActionsPanel actions={responderActions} />
        </div>
      </div>
    </div>
  );
}

/* ─── Related Cases Sub-Panel ───────────────────────────────────────────────── */
function RelatedCasesPanel({ relatedCases, filter, setFilter }: {
  relatedCases: RelatedCase[]; filter: string; setFilter: (v: string) => void;
}) {
  const filtered = filter ? relatedCases.filter(c => c.resolution_status === filter || c.status === filter) : relatedCases;
  const stats = relatedCases.reduce<Record<string, number>>((acc, c) => {
    const key = c.resolution_status || c.status || 'Unknown';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  function caseDuration(start?: string, end?: string) {
    if (!start) return null;
    const s = new Date(start);
    const e = end ? new Date(end) : new Date();
    const hours = Math.max(0, Math.round((e.getTime() - s.getTime()) / 36e5));
    if (hours < 24) return `${hours} hours`;
    return `${Math.round(hours / 24)} days`;
  }

  const getStatusLabel = (st: string) => {
    if (st === 'TruePositive') return 'True Positive';
    if (st === 'FalsePositive') return 'False Positive';
    if (st === 'Indeterminate') return 'Indeterminate';
    if (st === 'Other') return 'Other';
    if (st === 'Open') return 'Open';
    if (st === 'Resolved') return 'Resolved';
    return st;
  };

  return (
    <div>
      <div className="px-6 py-4 bg-slate-900/40 flex items-center justify-between">
        <h4 className="text-slate-200 font-bold text-xs uppercase tracking-wider select-none">Related Incidents ({relatedCases.length})</h4>
      </div>
      <div className="p-5">
        {relatedCases.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            <button className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all duration-150 ${filter === '' ? 'bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/30' : 'bg-slate-900/50 text-slate-400 hover:text-slate-200 hover:bg-slate-900 ring-1 ring-slate-900/60'}`} onClick={() => setFilter('')}>All ({relatedCases.length})</button>
            {Object.entries(stats).map(([key, count]) => (
              <button key={key} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all duration-150 ${filter === key ? 'bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/30' : 'bg-slate-900/50 text-slate-400 hover:text-slate-200 hover:bg-slate-900 ring-1 ring-slate-900/60'}`} onClick={() => setFilter(key)}>{getStatusLabel(key)} ({count})</button>
            ))}
          </div>
        )}
        {filtered.length === 0 && <div className="p-6 text-center text-slate-500 text-xs italic bg-slate-900/10 rounded-xl border border-dashed border-slate-900 select-none">No related cases found.</div>}
        <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
          {filtered.map(rc => (
            <div key={rc.id} className="relative bg-slate-900/40 ring-1 ring-slate-900/60 rounded-xl p-3 shadow-sm hover:ring-slate-800 transition-all pl-4 overflow-hidden">
              <div className={`absolute left-0 top-0 bottom-0 w-1 bg-tlp-${rc.tlp}`} />
              <div className="flex flex-wrap items-center gap-2 mb-1 justify-between">
                <a href={`/cases/${rc.id}`} className="font-semibold text-xs text-blue-400 hover:text-blue-300 hover:underline">#{String(rc.number).padStart(7, '0')} - {rc.title}</a>
                <SeverityInline value={rc.severity} />
              </div>
              <div className="flex justify-between items-center text-slate-500 text-[10px]">
                {rc.start_date && <span>Duration: {caseDuration(rc.start_date, rc.end_date)}</span>}
                <span>{rc.links_count} matched IOCs</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Responder Actions Sub-Panel ───────────────────────────────────────────── */
function ResponderActionsPanel({ actions }: { actions: ResponderAction[] }) {
  if (!actions.length) return null;
  const statusClass = (s: string) => {
    switch (s) {
      case 'Success': return 'px-2 py-0.5 bg-green-950/20 text-green-400 border border-green-900/30 rounded text-[9px] uppercase font-bold';
      case 'InProgress': return 'px-2 py-0.5 bg-yellow-950/20 text-yellow-400 border border-yellow-900/30 rounded text-[9px] uppercase font-bold';
      case 'Waiting': return 'px-2 py-0.5 bg-blue-950/20 text-blue-400 border border-blue-900/30 rounded text-[9px] uppercase font-bold';
      case 'Failure': return 'px-2 py-0.5 bg-red-950/20 text-red-400 border border-red-900/30 rounded text-[9px] uppercase font-bold';
      default: return 'px-2 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 rounded text-[9px] uppercase font-bold';
    }
  };

  return (
    <div>
      <div className="px-6 py-4 bg-slate-900/40">
        <h4 className="text-slate-200 font-bold text-xs uppercase tracking-wider select-none">Active Responders ({actions.length})</h4>
      </div>
      <div className="p-4 space-y-2.5 max-h-[220px] overflow-y-auto">
        {actions.map(a => (
          <div key={a.id} className="bg-slate-900/30 ring-1 ring-slate-900/60 rounded-xl p-3 flex items-center justify-between text-xs hover:ring-slate-800 transition-all">
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold text-slate-200">{a.responder_name}</span>
              <span className="text-[10px] text-slate-500">{a.start_date ? new Date(a.start_date).toLocaleDateString() : '—'}</span>
            </div>
            <span className={statusClass(a.status)}>{a.status === 'InProgress' ? 'In Progress' : a.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SeverityInline({ value }: { value: number }) {
  const labels: Record<number, string> = { 0: 'Low', 1: 'Medium', 2: 'High', 3: 'Critical', 4: 'Critical' };
  const klass: Record<number, string> = { 
    0: 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20 shadow-[0_0_8px_rgba(59,130,246,0.1)]', 
    1: 'bg-yellow-500/10 text-yellow-400 ring-1 ring-yellow-500/20 shadow-[0_0_8px_rgba(234,179,8,0.1)]', 
    2: 'bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20 shadow-[0_0_10px_rgba(249,115,22,0.15)]', 
    3: 'bg-red-500/10 text-red-400 ring-1 ring-red-500/30 font-bold shadow-[0_0_12px_rgba(239,68,68,0.2)]', 
    4: 'bg-red-600/20 text-red-500 ring-1 ring-red-500 font-extrabold shadow-[0_0_16px_rgba(239,68,68,0.4)]' 
  };
  return <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-extrabold tracking-wider ${klass[value] ?? 'bg-slate-700 text-slate-400'}`}>{labels[value] ?? `S${value}`}</span>;
}
