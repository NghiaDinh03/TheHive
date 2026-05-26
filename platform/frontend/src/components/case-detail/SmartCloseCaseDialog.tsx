'use client';

import { useEffect, useState } from 'react';
import { Task, Observable, CaseCore } from './types';

interface SmartCloseCaseDialogProps {
  item: CaseCore;
  tasks: Task[];
  observables: Observable[];
  onClose: () => void;
  confirmClose: { mutate: (payload: { impact_status: string; resolution_status: string; summary: string }) => void; isPending: boolean };
}

export default function SmartCloseCaseDialog({
  item,
  tasks,
  observables,
  onClose,
  confirmClose
}: SmartCloseCaseDialogProps) {
  const [impactStatus, setImpactStatus] = useState('NoImpact');
  const [resolutionStatus, setResolutionStatus] = useState('TruePositive');
  const [summary, setSummary] = useState('');
  
  const [impactOpen, setImpactOpen] = useState(false);
  const [resolutionOpen, setResolutionOpen] = useState(false);

  // Checks for Pre-closure SOC Checklist
  const unassigned = !item.assignee || item.assignee.trim() === '';
  const unfinishedTasks = tasks.filter(t => t.status === 'Waiting' || t.status === 'InProgress');
  const hasUnfinishedTasks = unfinishedTasks.length > 0;
  const unmarkedIOCs = observables.filter(o => !o.sighted && !o.ioc);

  // Smart suggestions & Auto-generated summary upon mount
  useEffect(() => {
    // 1. Suggest Resolution Status based on IOCs
    const hasMaliciousIOC = observables.some(o => o.ioc || (o.malicious_score && o.malicious_score >= 70));
    if (hasMaliciousIOC) {
      setResolutionStatus('TruePositive');
    } else {
      setResolutionStatus('FalsePositive');
    }

    // 2. Auto-generate closure Summary in Markdown
    const maliciousIOCs = observables.filter(o => o.ioc || (o.malicious_score && o.malicious_score >= 70));
    const completedTasks = tasks.filter(t => t.status === 'Completed');
    
    const summaryMD = `### NCS FUSION CLOSE CASE SUMMARY
* **Incident Resolution**: ${hasMaliciousIOC ? 'True Positive (Confirmed Threat)' : 'False Positive (Benign/False Alarm)'}
* **Key Threat Indicators (IOCs) Found**:
${maliciousIOCs.length > 0 
  ? maliciousIOCs.map(o => `  - ${o.data} (${o.data_type} - Score: ${o.malicious_score ?? 0}/100)`).join('\n') 
  : '  - No critical malicious indicators flagged.'}
* **Completed Triage & Containment Tasks**:
${completedTasks.length > 0 
  ? completedTasks.map(t => `  - [x] ${t.title}`).join('\n') 
  : '  - No tasks completed.'}
* **Closure Note**: Threat contained successfully. Indicators synced to Threat Intel.`;

    setSummary(summaryMD);
  }, [observables, tasks]);

  const handleConfirm = () => {
    if (unassigned || hasUnfinishedTasks) return; // Hard block closure
    confirmClose.mutate({
      impact_status: impactStatus,
      resolution_status: resolutionStatus,
      summary: summary
    });
  };

  const impactOptions = [
    { value: 'NoImpact', label: 'No Impact', desc: 'No impact on business operations' },
    { value: 'WithImpact', label: 'With Impact', desc: 'Negative business impact experienced' },
    { value: 'NotApplicable', label: 'Not Applicable', desc: 'Impact assessment not applicable' }
  ];

  const resolutionOptions = [
    { value: 'TruePositive', label: 'True Positive', desc: 'Confirmed security incident or policy violation' },
    { value: 'FalsePositive', label: 'False Positive', desc: 'False alarm due to benign activity or logs' },
    { value: 'Indeterminate', label: 'Indeterminate', desc: 'Undetermined or inconclusive forensics' },
    { value: 'Other', label: 'Other', desc: 'Other reasons not covered above' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-[500px] p-6 bg-slate-950/95 ring-1 ring-slate-900/60 rounded-2xl shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-150 text-slate-300 flex flex-col gap-5 max-h-[90vh] overflow-y-auto scrollbar-thin">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-red-400">
            <rect width="18" height="18" x="3" y="3" rx="2"/>
            <path d="m15 9-6 6"/>
            <path d="m9 9 6 6"/>
          </svg>
          <h4 className="text-base font-bold text-slate-100 uppercase tracking-wider select-none">Close Case Request</h4>
        </div>

        {/* SOC Checklist Panel (Hard Block logic) */}
        <div className="bg-slate-900/30 p-4 rounded-xl ring-1 ring-slate-900/60 flex flex-col gap-3">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none">Pre-closure SOC Checklist</span>
          
          <div className="flex flex-col gap-2.5 text-xs">
            {/* 1. Assignee Check */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${unassigned ? 'bg-red-500' : 'bg-green-500'}`} />
                Case Assignee Assigned?
              </span>
              <span className={`font-bold ${unassigned ? 'text-red-400' : 'text-green-400'}`}>
                {unassigned ? 'NO (BLOCKED)' : 'YES'}
              </span>
            </div>

            {/* 2. Tasks Check */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${hasUnfinishedTasks ? 'bg-red-500' : 'bg-green-500'}`} />
                All Tasks Completed / Cancelled?
              </span>
              <span className={`font-bold ${hasUnfinishedTasks ? 'text-red-400' : 'text-green-400'}`}>
                {hasUnfinishedTasks ? `NO (${unfinishedTasks.length} PENDING - BLOCKED)` : 'YES'}
              </span>
            </div>

            {/* 3. Observables warning */}
            {unmarkedIOCs.length > 0 && (
              <div className="text-[10.5px] text-yellow-500/80 mt-1 bg-yellow-950/10 border border-yellow-900/20 px-3 py-2 rounded-lg leading-relaxed select-none">
                ⚠️ Notice: <strong>{unmarkedIOCs.length} observables</strong> have not been classified as IOCs or sighted. Make sure to review them before closure.
              </div>
            )}

            {/* Hard Block Error Message */}
            {(unassigned || hasUnfinishedTasks) && (
              <div className="text-[10.5px] text-red-400 font-bold bg-red-950/20 border border-red-900/30 px-3 py-2.5 rounded-lg leading-relaxed mt-1.5">
                🚨 Case cannot be closed yet:
                {unassigned && <div className="font-normal mt-0.5">• You must assign a responsible Analyst to this case first.</div>}
                {hasUnfinishedTasks && <div className="font-normal mt-0.5">• All case tasks must be completed or cancelled before closure.</div>}
              </div>
            )}
          </div>
        </div>

        {/* Inputs (only interactive if not blocked) */}
        <div className="flex flex-col gap-4">
          {/* Impact Status Custom Dropdown */}
          <div className="flex flex-col gap-1.5 relative">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none">Impact Status</span>
            <button
              onClick={() => { setImpactOpen(!impactOpen); setResolutionOpen(false); }}
              disabled={unassigned || hasUnfinishedTasks}
              className="w-full bg-slate-900/80 hover:bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-left text-xs font-semibold text-slate-200 transition-all flex justify-between items-center"
            >
              <span>{impactOptions.find(o => o.value === impactStatus)?.label || impactStatus}</span>
              <span>▼</span>
            </button>
            {impactOpen && (
              <div className="absolute z-50 w-full mt-16 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl p-1 animate-in fade-in duration-100">
                {impactOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setImpactStatus(opt.value); setImpactOpen(false); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-slate-900 transition-colors flex flex-col ${opt.value === impactStatus ? 'text-blue-400 bg-blue-600/5 font-bold' : 'text-slate-400'}`}
                  >
                    <span>{opt.label}</span>
                    <span className="text-[9.5px] text-slate-500 font-normal">{opt.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Resolution Status Custom Dropdown */}
          <div className="flex flex-col gap-1.5 relative">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none">Resolution Status</span>
            <button
              onClick={() => { setResolutionOpen(!resolutionOpen); setImpactOpen(false); }}
              disabled={unassigned || hasUnfinishedTasks}
              className="w-full bg-slate-900/80 hover:bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-left text-xs font-semibold text-slate-200 transition-all flex justify-between items-center"
            >
              <span>{resolutionOptions.find(o => o.value === resolutionStatus)?.label || resolutionStatus}</span>
              <span>▼</span>
            </button>
            {resolutionOpen && (
              <div className="absolute z-50 w-full mt-16 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl p-1 animate-in fade-in duration-100">
                {resolutionOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setResolutionStatus(opt.value); setResolutionOpen(false); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-slate-900 transition-colors flex flex-col ${opt.value === resolutionStatus ? 'text-blue-400 bg-blue-600/5 font-bold' : 'text-slate-400'}`}
                  >
                    <span>{opt.label}</span>
                    <span className="text-[9.5px] text-slate-500 font-normal">{opt.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Markdown summary text area */}
          <label className="flex flex-col gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none">
            Closure Summary (Auto-generated Markdown)
            <textarea
              className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500/40 leading-relaxed shadow-inner"
              rows={6}
              value={summary}
              disabled={unassigned || hasUnfinishedTasks}
              onChange={e => setSummary(e.target.value)}
            />
          </label>
        </div>

        {/* Footer buttons */}
        <div className="flex gap-3 mt-4 border-t border-slate-900 pt-4 justify-end shrink-0">
          <button
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl text-xs font-bold uppercase transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
            disabled={unassigned || hasUnfinishedTasks || confirmClose.isPending}
            onClick={handleConfirm}
          >
            {confirmClose.isPending ? 'Closing...' : 'Confirm Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
