'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from '@/components/FaIcon';
import { AdminShell } from '@/components/AdminShell';
import { ApiError, apiFetch } from '@/lib/api';

type SystemSettings = {
  cyberai_api_url?: string;
  cyberai_model?: string;
  openai_api_url?: string;
  openai_api_key?: string;
  openai_model?: string;
  gemini_api_key?: string;
  gemini_model?: string;
};

type AIStatus = {
  status: string;
  provider: string;
  error?: string;
};

export default function AIIntegrationsPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<SystemSettings>({
    cyberai_api_url: 'http://cyber-ai-service:8000',
    cyberai_model: 'gemma',
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 1. Fetch current settings
  const settingsQuery = useQuery({
    queryKey: ['admin-ai-settings'],
    queryFn: async () => apiFetch<SystemSettings>('/api/v1/admin/settings'),
  });

  // 2. Fetch AI service status
  const aiStatusQuery = useQuery({
    queryKey: ['admin-ai-status'],
    queryFn: async () => apiFetch<AIStatus>('/api/v1/admin/settings/ai-status'),
    refetchInterval: 15000, // Check every 15s
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setDraft((prev) => ({ ...prev, ...settingsQuery.data }));
    }
  }, [settingsQuery.data]);

  // 3. Save settings mutation
  const saveMutation = useMutation({
    mutationFn: (payload: SystemSettings) =>
      apiFetch<any>('/api/v1/admin/settings', { method: 'POST', json: payload }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-ai-settings'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-ai-status'] });
      setMessage('AI settings and endpoints saved successfully.');
      setError(null);
      setTimeout(() => setMessage(null), 5000);
    },
    onError: (err) => {
      setMessage(null);
      setError(err instanceof ApiError ? err.problem.detail || err.problem.title : 'Save settings failed');
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveMutation.mutate(draft);
  }

  const isOnline = aiStatusQuery.data?.status === 'online';

  return (
    <AdminShell title="AI & SOAR Integrations" small="configure dynamic threat analysis endpoints">
      {message && <div className="admin-alert success mb-4 p-4 rounded-xl backdrop-blur-md bg-emerald-950/20 ring-1 ring-emerald-500/30 text-emerald-300">{message}</div>}
      {error && <div className="admin-alert error mb-4 p-4 rounded-xl backdrop-blur-md bg-rose-950/20 ring-1 ring-rose-500/30 text-rose-300">{error}</div>}

      <div className="row">
        <div className="col-md-12">
          <form onSubmit={submit} className="form-horizontal">
            {/* Local CyberAI Gemma section */}
            <div className="box backdrop-blur-lg bg-slate-950/80 ring-1 ring-slate-800/80 rounded-2xl shadow-2xl p-6 mb-6">
              <div className="box-header with-border flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
                <h3 className="box-title text-slate-100 font-bold text-lg flex items-center gap-3">
                  🤖 Local CyberAI (Gemma / Llama 3.1)
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium backdrop-blur-md transition-all duration-500 ${
                    aiStatusQuery.isLoading 
                      ? 'bg-slate-800 text-slate-400 ring-1 ring-slate-700'
                      : isOnline 
                        ? 'bg-emerald-950/40 text-emerald-400 ring-1 ring-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                        : 'bg-rose-950/40 text-rose-400 ring-1 ring-rose-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full mr-1.5 animate-pulse ${isOnline ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                    {aiStatusQuery.isLoading ? 'Checking...' : isOnline ? 'Online' : 'Offline'}
                  </span>
                </h3>
              </div>

              <div className="box-body flex flex-col gap-5">
                {settingsQuery.isLoading ? (
                  <div className="text-slate-400 py-4 text-center">Loading integration endpoints...</div>
                ) : (
                  <>
                    <div className="form-group flex flex-col md:flex-row gap-4 items-start">
                      <label className="col-md-3 text-slate-300 font-medium md:pt-2">
                        Endpoint URL
                      </label>
                      <div className="col-md-9 w-full">
                        <input
                          type="text"
                          className="w-full bg-slate-900/60 ring-1 ring-slate-800 text-slate-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-slate-700/80 transition-all placeholder-slate-600"
                          placeholder="e.g. http://cyber-ai-service:8000"
                          value={draft.cyberai_api_url || ''}
                          onChange={(e) => setDraft({ ...draft, cyberai_api_url: e.target.value })}
                        />
                        <span className="text-xs text-slate-400 mt-1.5 block">
                          URL of the CyberAI FastAPI Assessment backend service. Default is `http://cyber-ai-service:8000`.
                        </span>
                      </div>
                    </div>

                    <div className="form-group flex flex-col md:flex-row gap-4 items-start">
                      <label className="col-md-3 text-slate-300 font-medium md:pt-2">
                        Model Name
                      </label>
                      <div className="col-md-9 w-full">
                        <input
                          type="text"
                          className="w-full bg-slate-900/60 ring-1 ring-slate-800 text-slate-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-slate-700/80 transition-all placeholder-slate-600"
                          placeholder="e.g. gemma"
                          value={draft.cyberai_model || ''}
                          onChange={(e) => setDraft({ ...draft, cyberai_model: e.target.value })}
                        />
                        <span className="text-xs text-slate-400 mt-1.5 block">
                          Internal model alias for the assessment pipeline (e.g. `gemma`, `llama3.1`).
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Cloud LLM Providers */}
            <div className="box backdrop-blur-lg bg-slate-950/80 ring-1 ring-slate-800/80 rounded-2xl shadow-2xl p-6 mb-6">
              <div className="box-header with-border mb-6 pb-4 border-b border-slate-800">
                <h3 className="box-title text-slate-100 font-bold text-lg">
                  ☁️ Cloud AI Providers (Optional)
                </h3>
              </div>

              <div className="box-body flex flex-col gap-6">
                {/* OpenAI Section */}
                <div className="border border-slate-800/60 rounded-xl p-4 bg-slate-900/20">
                  <h4 className="text-slate-200 font-bold mb-4 flex items-center gap-2">
                    🟢 OpenAI ChatGPT
                  </h4>
                  <div className="flex flex-col gap-4">
                    <div className="form-group flex flex-col md:flex-row gap-4 items-start">
                      <label className="col-md-3 text-slate-300 font-medium md:pt-2">API Key</label>
                      <div className="col-md-9 w-full">
                        <input
                          type="password"
                          className="w-full bg-slate-900/60 ring-1 ring-slate-800 text-slate-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-slate-700/80 transition-all placeholder-slate-600"
                          placeholder="sk-..."
                          value={draft.openai_api_key || ''}
                          onChange={(e) => setDraft({ ...draft, openai_api_key: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="form-group flex flex-col md:flex-row gap-4 items-start">
                      <label className="col-md-3 text-slate-300 font-medium md:pt-2">Model</label>
                      <div className="col-md-9 w-full">
                        <input
                          type="text"
                          className="w-full bg-slate-900/60 ring-1 ring-slate-800 text-slate-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-slate-700/80 transition-all placeholder-slate-600"
                          placeholder="gpt-4o"
                          value={draft.openai_model || ''}
                          onChange={(e) => setDraft({ ...draft, openai_model: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Google Gemini Section */}
                <div className="border border-slate-800/60 rounded-xl p-4 bg-slate-900/20">
                  <h4 className="text-slate-200 font-bold mb-4 flex items-center gap-2">
                    🟣 Google Gemini
                  </h4>
                  <div className="flex flex-col gap-4">
                    <div className="form-group flex flex-col md:flex-row gap-4 items-start">
                      <label className="col-md-3 text-slate-300 font-medium md:pt-2">API Key</label>
                      <div className="col-md-9 w-full">
                        <input
                          type="password"
                          className="w-full bg-slate-900/60 ring-1 ring-slate-800 text-slate-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-slate-700/80 transition-all placeholder-slate-600"
                          placeholder="AIzaSy..."
                          value={draft.gemini_api_key || ''}
                          onChange={(e) => setDraft({ ...draft, gemini_api_key: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="form-group flex flex-col md:flex-row gap-4 items-start">
                      <label className="col-md-3 text-slate-300 font-medium md:pt-2">Model</label>
                      <div className="col-md-9 w-full">
                        <input
                          type="text"
                          className="w-full bg-slate-900/60 ring-1 ring-slate-800 text-slate-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-slate-700/80 transition-all placeholder-slate-600"
                          placeholder="gemini-1.5-pro"
                          value={draft.gemini_model || ''}
                          onChange={(e) => setDraft({ ...draft, gemini_model: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions button */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="submit"
                disabled={saveMutation.isPending || settingsQuery.isLoading}
                className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-950 font-bold px-6 py-2.5 rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50"
              >
                <Save size={14} />
                {saveMutation.isPending ? 'Saving Settings...' : 'Save Configurations'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AdminShell>
  );
}
