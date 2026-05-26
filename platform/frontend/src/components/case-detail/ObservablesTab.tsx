'use client';

import { useState } from 'react';
import { Observable } from './types';
import { Tlp, ObservableFlags, TagList } from '@/components/Badges';
import { ObservableCreationModal, ObservableCreationPayload } from '@/components/ObservableCreationModal';
import ThreatMap from '@/components/ThreatMap';

// SVG Icons mỏng, đơn sắc Lucide-style cho trực SOC dịu mắt
const IconGrid = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect width="7" height="7" x="3" y="3" rx="1"/>
    <rect width="7" height="7" x="14" y="3" rx="1"/>
    <rect width="7" height="7" x="14" y="14" rx="1"/>
    <rect width="7" height="7" x="3" y="14" rx="1"/>
  </svg>
);

const IconMap = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/>
    <path d="M15 5.764v15M9 3.236v15"/>
  </svg>
);

interface ObservablesTabProps {
  observables: Observable[];
  canWrite: boolean;
  createObs: { mutate: (file: File | null) => void; isPending: boolean };
  patchObs: { mutate: (v: { obsId: string; patch: Record<string, unknown> }) => void };
  deleteObs: { mutate: (id: string) => void };
  obsForm: any;
  setObsForm: (v: any) => void;
  caseId: string;
}

export default function ObservablesTab({
  observables,
  canWrite,
  createObs,
  patchObs,
  deleteObs,
  setObsForm,
  caseId
}: ObservablesTabProps) {
  const [viewMode, setViewMode] = useState<'cards' | 'map'>('cards');
  const [showModal, setShowModal] = useState(false);
  const [selectedObs, setSelectedObs] = useState<Observable | null>(null);
  const [drawerTab, setDrawerTab] = useState<'parsed' | 'raw'>('parsed');

  const types = ['ip', 'domain', 'url', 'mail', 'hash', 'filename', 'fqdn', 'uri_path', 'user-agent', 'regexp', 'file', 'other'];
  const knownTags = Array.from(new Set(observables.flatMap((o) => o.tags))).sort();

  function handleSubmit(payload: ObservableCreationPayload) {
    setObsForm({
      data_type: payload.data_type,
      data: payload.data,
      message: payload.message,
      tlp: payload.tlp,
      ioc: payload.ioc,
      sighted: payload.sighted,
      tags: payload.tags.join(', '),
    });
    createObs.mutate(payload.file ?? null);
    setShowModal(false);
  }

  // Radial Progress color class based on score
  const getScoreColor = (score?: number) => {
    if (!score) return 'stroke-slate-700 text-slate-500';
    if (score >= 70) return 'stroke-red-500 text-red-400 drop-shadow-[0_0_6px_rgba(239,68,68,0.4)]';
    if (score >= 40) return 'stroke-orange-500 text-orange-400 drop-shadow-[0_0_6px_rgba(249,115,22,0.3)]';
    return 'stroke-green-500 text-green-400 drop-shadow-[0_0_6px_rgba(34,197,94,0.3)]';
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header controls */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          {/* Dual-View Switcher */}
          <div className="flex bg-slate-950/40 p-1 rounded-xl ring-1 ring-slate-900/60 shadow-inner">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all duration-150 flex items-center gap-1.5 ${viewMode === 'cards' ? 'bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/20' : 'text-slate-400 hover:text-slate-200'}`}
              title="Cards View"
            >
              <IconGrid /> Cards
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all duration-150 flex items-center gap-1.5 ${viewMode === 'map' ? 'bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/20' : 'text-slate-400 hover:text-slate-200'}`}
              title="Threat Map View"
            >
              <IconMap /> Threat Map
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          {canWrite && (
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase transition-all shadow-lg flex items-center gap-1.5"
            >
              Add Observable
            </button>
          )}
        </div>
      </div>

      <ObservableCreationModal
        open={showModal}
        types={types}
        knownTags={knownTags}
        pending={createObs.isPending}
        onCancel={() => setShowModal(false)}
        onSubmit={handleSubmit}
      />

      {/* Render Dual-View Content */}
      {viewMode === 'map' ? (
        <div className="glass-panel bg-slate-950/40 ring-1 ring-slate-900/60 rounded-2xl overflow-hidden h-[540px] relative">
          {/* Interactive SVG Threat Map */}
          <ThreatMap caseId={caseId} />
        </div>
      ) : (
        /* IOC Cards Grid (SOC-Eye clean design) */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {observables.length === 0 ? (
            <div className="col-span-full p-12 text-center text-slate-500 text-sm italic select-none">No observables found.</div>
          ) : (
            observables.map(o => {
              const score = o.malicious_score ?? 0;
              const radius = 18;
              const strokeWidth = 3.5;
              const circumference = 2 * Math.PI * radius;
              const strokeDashoffset = circumference - (score / 100) * circumference;

              return (
                <div
                  key={o.id}
                  onClick={() => setSelectedObs(o)}
                  className="glass-panel bg-slate-950/30 ring-1 ring-slate-900/60 hover:ring-slate-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between gap-4 transition-all hover:-translate-y-0.5 cursor-pointer relative"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <Tlp value={o.tlp} format="icon" />
                        <span className="px-2 py-0.5 bg-slate-900 text-slate-400 rounded text-[9.5px] uppercase font-bold tracking-wider">{o.data_type}</span>
                        {o.ioc && (
                          <span className="px-1.5 py-0.5 bg-red-500/10 text-red-400 ring-1 ring-red-500/20 rounded text-[8.5px] uppercase font-extrabold tracking-wider">IOC</span>
                        )}
                      </div>
                      <div className="font-mono text-slate-200 text-xs font-semibold break-all">{o.data}</div>
                      {o.message && <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-2">{o.message}</p>}
                    </div>

                    {/* Radial Score Indicator */}
                    <div className="relative shrink-0 flex items-center justify-center w-12 h-12" title={`Malicious score: ${score}/100`}>
                      <svg className="w-12 h-12 transform -rotate-90">
                        {/* Background circle */}
                        <circle cx="24" cy="24" r={radius} strokeWidth={strokeWidth} className="stroke-slate-900" fill="transparent" />
                        {/* Foreground circle */}
                        <circle
                          cx="24"
                          cy="24"
                          r={radius}
                          strokeWidth={strokeWidth}
                          className={`${getScoreColor(score)} transition-all duration-300`}
                          fill="transparent"
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeDashoffset}
                        />
                      </svg>
                      <span className={`absolute text-[9.5px] font-extrabold ${score >= 70 ? 'text-red-400' : score >= 40 ? 'text-orange-400' : 'text-slate-400'}`}>{score}</span>
                    </div>
                  </div>

                  <div className="pt-3 flex items-center justify-between gap-3 text-[10px]">
                    <div className="flex-1 overflow-hidden">
                      <TagList data={o.tags} />
                    </div>
                    {canWrite && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteObs.mutate(o.id);
                        }}
                        className="px-2 py-1 bg-red-600/10 hover:bg-red-600/30 text-red-400 rounded-lg font-bold uppercase transition-all select-none"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Side Drawer Overlay for Observable details */}
      {selectedObs && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setSelectedObs(null)}>
          <div className="w-[500px] h-full bg-slate-950/95 ring-1 ring-slate-900/60 shadow-2xl flex flex-col transform transition-transform" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-4 flex justify-between items-center bg-slate-900/40 shrink-0">
              <h3 className="text-sm text-slate-200 font-bold uppercase tracking-wider flex items-center gap-1.5">
                Observable Details
              </h3>
              <button className="text-slate-400 hover:text-slate-200 focus:outline-none" onClick={() => setSelectedObs(null)}>
                ✖
              </button>
            </div>
            
            {/* Tabs */}
            <div className="flex bg-slate-900/40 shrink-0">
              <button className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${drawerTab === 'parsed' ? 'text-blue-400 border-b-2 border-blue-500' : 'text-slate-400 hover:text-slate-300'}`} onClick={() => setDrawerTab('parsed')}>Parsed Information</button>
              <button className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${drawerTab === 'raw' ? 'text-blue-400 border-b-2 border-blue-500' : 'text-slate-400 hover:text-slate-300'}`} onClick={() => setDrawerTab('raw')}>Raw JSON</button>
            </div>
            
            {/* Content area */}
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-5 text-xs text-slate-300 bg-slate-900/10">
              {drawerTab === 'parsed' ? (
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none">Indicators Data</span>
                    <div className="font-mono text-xs text-slate-200 bg-slate-950 p-3 rounded-xl ring-1 ring-slate-900/60 break-all select-all">{selectedObs.data}</div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none">Indicator type</span>
                      <span className="text-xs text-slate-200 bg-slate-900/60 px-3 py-1.5 rounded-lg ring-1 ring-slate-900/60 font-semibold uppercase">{selectedObs.data_type}</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none">TLP level</span>
                      <div className="flex items-center h-[28px]"><Tlp value={selectedObs.tlp} /></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none">Threat Score</span>
                      <span className="text-xs text-slate-200 bg-slate-900/60 px-3 py-1.5 rounded-lg ring-1 ring-slate-900/60 font-bold">{selectedObs.malicious_score ?? 0} / 100</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none">Flags status</span>
                      <div className="flex items-center h-[28px]"><ObservableFlags observable={selectedObs} /></div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none">Tags / Classes</span>
                    <div className="flex flex-wrap gap-1 mt-1"><TagList data={selectedObs.tags} /></div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none">Description & Context</span>
                    <p className="text-xs text-slate-300 bg-slate-900/40 p-3 rounded-xl ring-1 ring-slate-900/60 leading-relaxed">{selectedObs.message || <em className="text-slate-500">None</em>}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div><span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Created by</span><span className="text-xs text-slate-300 font-semibold">{selectedObs.created_by}</span></div>
                    <div><span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Created at</span><span className="text-xs text-slate-300 font-semibold">{new Date(selectedObs.created_at).toLocaleString()}</span></div>
                  </div>
                </div>
              ) : (
                <pre className="text-[10.5px] font-mono text-slate-300 bg-slate-950 p-4 rounded-xl ring-1 ring-slate-900/60 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(selectedObs, null, 2)}</pre>
              )}
            </div>
            
            <div className="p-4 bg-slate-900/40 shrink-0 flex justify-end">
              <button className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold uppercase transition-colors" onClick={() => setSelectedObs(null)}>Close Drawer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
