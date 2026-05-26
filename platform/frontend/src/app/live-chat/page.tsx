'use client';

import { useEffect, useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { apiFetch } from '@/lib/api';
import { Dropzone } from '@/components/Dropzone';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import { Bell, BellOff, MessageSquare, Send, Paperclip, ShieldAlert } from 'lucide-react';

type CaseCore = {
  id: string;
  number: number;
  title: string;
  status: string;
  severity: number;
  tlp: number;
  assignee: string;
  updated_at: string;
};

type CaseLog = {
  id: string;
  case_id: string;
  message: string;
  created_by: string;
  created_at: string;
  attachment_id?: string;
};

export default function CentralLiveChatPage() {
  const queryClient = useQueryClient();
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [logMessage, setLogMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [mutedCases, setMutedCases] = useState<Record<string, boolean>>({});
  const [me, setMe] = useState<string>('Analyst');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Audio elements for soft sound alerts
  const pingAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    pingAudioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-84.wav'); // Soft ping sound
    pingAudioRef.current.volume = 0.3;

    // Fetch self identity
    apiFetch<any>('/api/v1/auth/me')
      .then((data) => {
        if (data?.login) setMe(data.login);
      })
      .catch(() => {});
  }, []);

  // 1. Fetch active cases list
  const { data: casesData, isLoading: isCasesLoading } = useQuery({
    queryKey: ['live-chat-cases'],
    queryFn: async () => {
      const data = await apiFetch<CaseCore[]>('/api/v1/cases');
      // Filter out only Open cases for active chat
      return data?.filter((c) => c.status === 'Open') || [];
    },
  });

  // 2. Fetch active chat details (logs of selected case)
  const { data: chatLogs, isLoading: isLogsLoading } = useQuery({
    queryKey: ['case-chat-logs', selectedCaseId],
    queryFn: async () => {
      if (!selectedCaseId) return [];
      return apiFetch<CaseLog[]>(`/api/v1/cases/${selectedCaseId}/logs`);
    },
    enabled: !!selectedCaseId,
    refetchInterval: 5000, // Long poll every 5s for real-time vibe
  });

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLogs]);

  // Monitor logs to play soft ping sound when someone else sends a message
  const prevLogsLength = useRef<number>(0);
  useEffect(() => {
    if (chatLogs && chatLogs.length > prevLogsLength.current) {
      const lastLog = chatLogs[chatLogs.length - 1];
      const isMuted = selectedCaseId ? mutedCases[selectedCaseId] : false;
      
      // Ping only if it's from another user, not muted, and targeted (either mentions me or case is assigned to me)
      if (lastLog.created_by !== me && !isMuted) {
        const isTargeted = lastLog.message.includes(`@${me}`) || 
          casesData?.find(c => c.id === selectedCaseId)?.assignee === me;
          
        if (isTargeted && pingAudioRef.current) {
          pingAudioRef.current.play().catch(() => {});
        }
      }
    }
    prevLogsLength.current = chatLogs?.length || 0;
  }, [chatLogs, me, selectedCaseId, mutedCases, casesData]);

  // Default select first case on load
  useEffect(() => {
    if (casesData && casesData.length > 0 && !selectedCaseId) {
      setSelectedCaseId(casesData[0].id);
    }
  }, [casesData, selectedCaseId]);

  // 3. Mutation to append chat message / log
  const appendMessageMutation = useMutation({
    mutationFn: async (uploadedFileId: string | null) => {
      if (!selectedCaseId) return;
      return apiFetch(`/api/v1/cases/${selectedCaseId}/logs`, {
        method: 'POST',
        json: {
          message: logMessage,
          attachment_id: uploadedFileId || undefined,
        },
      });
    },
    onSuccess: async () => {
      setLogMessage('');
      setFile(null);
      await queryClient.invalidateQueries({ queryKey: ['case-chat-logs', selectedCaseId] });
    },
  });

  // 4. File upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (f: File) => {
      const formData = new FormData();
      formData.append('file', f);
      const res = await fetch('/api/v1/attachments/upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('File upload failed');
      const data = await res.json();
      return data.id as string;
    },
  });

  const handleSend = async () => {
    if (!logMessage.trim() && !file) return;
    try {
      let attachmentId: string | null = null;
      if (file) {
        attachmentId = await uploadMutation.mutateAsync(file);
      }
      await appendMessageMutation.mutateAsync(attachmentId);
    } catch (e) {
      console.error(e);
    }
  };

  const toggleMute = (caseId: string) => {
    setMutedCases((prev) => ({ ...prev, [caseId]: !prev[caseId] }));
  };

  const renderBasicMarkdown = (text: string): string => {
    if (!text) return '';
    let html = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code class="px-1 py-0.5 bg-slate-900 rounded font-mono text-xs text-orange-400">$1</code>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-blue-400 hover:underline">$1</a>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/\n/g, '<br/>');
    if (html.includes('<li>')) {
      html = html.replace(/(<li>.*?<\/li>)/gs, '<ul class="list-disc pl-4 my-1">$1</ul>');
    }
    return html;
  };

  const activeCase = casesData?.find((c) => c.id === selectedCaseId);

  return (
    <div className="min-h-screen flex bg-thehive-body overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        
        <main className="flex-1 flex overflow-hidden">
          {/* Cột bên trái: Danh sách Cases */}
          <aside className="w-80 border-r border-slate-900 bg-slate-950/40 flex flex-col shrink-0">
            <div className="p-4 border-b border-slate-900 flex justify-between items-center shrink-0">
              <h3 className="text-slate-100 font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                <MessageSquare size={14} className="text-blue-400" />
                Active Conversions
              </h3>
              <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20 rounded-md text-[10px] font-bold">
                {casesData?.length || 0} Open
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
              {isCasesLoading ? (
                <div className="text-slate-500 text-xs italic text-center py-12">Loading cases...</div>
              ) : casesData?.length === 0 ? (
                <div className="text-slate-500 text-xs italic text-center py-12">No active open cases.</div>
              ) : (
                casesData?.map((c) => {
                  const isSelected = c.id === selectedCaseId;
                  const isMuted = mutedCases[c.id];
                  
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCaseId(c.id)}
                      className={`group relative p-3.5 rounded-xl cursor-pointer transition-all duration-300 ring-1 ${
                        isSelected
                          ? 'bg-blue-600/10 ring-blue-500/30 shadow-[0_0_15px_rgba(29,78,216,0.1)] text-slate-200'
                          : 'bg-slate-900/10 hover:bg-slate-900/30 ring-transparent hover:ring-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2 mb-1.5">
                        <span className="text-[10px] font-mono text-slate-500 group-hover:text-slate-400 transition-colors">
                          #{c.number}
                        </span>
                        <div className="flex gap-1.5 items-center">
                          {isMuted && <BellOff size={10} className="text-amber-500/70" />}
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider backdrop-blur-md ${
                            c.severity === 4 
                              ? 'bg-rose-950/20 text-rose-400 ring-1 ring-rose-500/30' 
                              : c.severity === 3 
                                ? 'bg-amber-950/20 text-amber-400 ring-1 ring-amber-500/30' 
                                : 'bg-slate-800/40 text-slate-400 ring-1 ring-slate-700'
                          }`}>
                            S{c.severity}
                          </span>
                        </div>
                      </div>

                      <h4 className={`text-xs font-bold truncate transition-colors ${isSelected ? 'text-slate-100' : 'text-slate-300 group-hover:text-slate-200'}`}>
                        {c.title}
                      </h4>

                      <div className="flex justify-between items-center mt-3 text-[10px] text-slate-500">
                        <span className="truncate max-w-[120px]">{c.assignee || 'Unassigned'}</span>
                        <span>{new Date(c.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>

          {/* Cột bên phải: Cửa sổ Chat */}
          <section className="flex-1 flex flex-col bg-slate-900/10">
            {activeCase ? (
              <>
                {/* Header */}
                <div className="px-6 py-4 bg-slate-950/30 border-b border-slate-900 flex justify-between items-center shrink-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-mono text-slate-500">Case #{activeCase.number}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                      <span className="text-[10px] text-green-400 uppercase font-bold tracking-wider">Active Stream</span>
                    </div>
                    <h2 className="text-slate-100 font-bold text-sm truncate max-w-[500px]">
                      {activeCase.title}
                    </h2>
                  </div>

                  <div className="flex gap-2 items-center">
                    {/* Mute button */}
                    <button
                      onClick={() => toggleMute(activeCase.id)}
                      className={`p-2 rounded-xl ring-1 transition-all duration-300 ${
                        mutedCases[activeCase.id]
                          ? 'bg-amber-600/10 ring-amber-500/30 text-amber-400 hover:bg-amber-600/20'
                          : 'bg-slate-900/60 ring-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                      }`}
                      title={mutedCases[activeCase.id] ? 'Unmute conversation' : 'Mute conversation'}
                    >
                      {mutedCases[activeCase.id] ? <BellOff size={14} /> : <Bell size={14} />}
                    </button>
                    
                    {/* Open details page */}
                    <button
                      onClick={() => window.open(`/cases/${activeCase.id}`, '_blank')}
                      className="px-4 py-2 bg-slate-900/60 hover:bg-slate-900 ring-1 ring-slate-800 text-slate-300 hover:text-slate-100 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                    >
                      Open Case
                    </button>
                  </div>
                </div>

                {/* Messages feed */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
                  {isLogsLoading ? (
                    <div className="text-slate-500 text-xs italic text-center py-20">Loading case timeline logs...</div>
                  ) : chatLogs?.length === 0 ? (
                    <div className="text-slate-500 text-xs italic text-center py-20">No conversation history. Start chatting below!</div>
                  ) : (
                    chatLogs?.map((log) => {
                      const isMe = log.created_by === me;
                      
                      return (
                        <div key={log.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          <div className={`flex items-center gap-2 mb-1 px-1.5 text-[10px] ${isMe ? 'flex-row-reverse' : ''}`}>
                            <strong className={`font-bold ${isMe ? 'text-blue-400' : 'text-slate-300'}`}>{log.created_by}</strong>
                            <span className="text-slate-500">{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          
                          <div className={`max-w-[70%] p-3.5 rounded-2xl shadow-lg ring-1 transition-all ${
                            isMe 
                              ? 'bg-blue-600/10 ring-blue-500/20 text-slate-200 rounded-tr-none' 
                              : 'bg-slate-950/60 ring-slate-900/50 text-slate-300 rounded-tl-none'
                          }`}>
                            <div className="prose prose-invert max-w-none text-xs leading-relaxed" dangerouslySetInnerHTML={{ __html: renderBasicMarkdown(log.message) }} />
                            
                            {log.attachment_id && (
                              <div className={`mt-2.5 inline-block ${isMe ? 'text-right w-full' : ''}`}>
                                <span
                                  onClick={() => window.open(`/api/v1/attachments/${log.attachment_id}/download`, '_blank')}
                                  className="px-2.5 py-1.5 bg-slate-950/80 hover:bg-slate-950 rounded-xl ring-1 ring-slate-900/60 text-[10px] font-semibold text-slate-300 hover:text-blue-400 cursor-pointer inline-flex items-center gap-1.5 transition-all"
                                >
                                  <Paperclip size={10} className="text-blue-400" />
                                  Attachment ID: {log.attachment_id.split('-')[0]}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Footer Chat Bar */}
                <div className="p-4 bg-slate-950/30 border-t border-slate-900 flex flex-col gap-3 shrink-0">
                  <div className="ring-1 ring-slate-900/60 rounded-xl overflow-hidden bg-slate-900/10">
                    <MarkdownEditor value={logMessage} onChange={setLogMessage} placeholder="Write your response... Use @username to notify directly." rows={2} />
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <div className="flex gap-2 items-center">
                      <Dropzone onFile={(f) => setFile(f)} compact />
                      {file && (
                        <span className="text-[10px] font-semibold text-slate-300 flex items-center bg-slate-950 px-2.5 py-1 rounded-xl ring-1 ring-slate-900/60">
                          <Paperclip size={10} className="text-blue-400 mr-1" />
                          {file.name}
                          <button className="ml-2 text-red-400 hover:text-red-300 focus:outline-none" onClick={() => setFile(null)}>×</button>
                        </span>
                      )}
                    </div>
                    
                    <button
                      onClick={handleSend}
                      disabled={(!logMessage.trim() && !file) || appendMessageMutation.isPending || uploadMutation.isPending}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold uppercase transition-all shadow-lg flex items-center gap-1.5"
                    >
                      <Send size={12} />
                      {appendMessageMutation.isPending ? 'Sending...' : 'Send Message'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 select-none">
                <ShieldAlert size={48} className="text-slate-700 mb-3 animate-pulse" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-1">No Active Chat Session</h3>
                <p className="text-xs text-slate-500 max-w-sm text-center">Select an open case from the left panel to engage with team members or customers.</p>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
