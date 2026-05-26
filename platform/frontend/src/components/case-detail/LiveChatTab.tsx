'use client';

import { useState } from 'react';
import { CaseLog, User } from './types';
import { Dropzone } from '@/components/Dropzone';
import { MarkdownEditor } from '@/components/MarkdownEditor';

interface LiveChatTabProps {
  logs: CaseLog[];
  logMessage: string;
  setLogMessage: (v: string) => void;
  appendLog: { mutate: (f: File | null) => void; isPending: boolean };
  canWrite: boolean;
  me?: string;
}

export default function LiveChatTab({
  logs,
  logMessage,
  setLogMessage,
  appendLog,
  canWrite,
  me
}: LiveChatTabProps) {
  const [file, setFile] = useState<File | null>(null);

  const handleSend = () => {
    if (!logMessage.trim() && !file) return;
    appendLog.mutate(file);
    setFile(null);
    setLogMessage('');
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

  return (
    <div className="flex flex-col h-[640px] glass-panel bg-slate-950/40 ring-1 ring-slate-900/60 shadow-2xl rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-slate-900/40 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <h4 className="text-slate-200 font-bold text-sm uppercase tracking-wider select-none">Live Customer Chat</h4>
        </div>
        <span className="px-2 py-0.5 bg-green-500/10 text-green-400 ring-1 ring-green-500/20 rounded text-[10px] uppercase font-bold tracking-wider">Active Channel</span>
      </div>

      {/* Message feed */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-900/10 scrollbar-thin">
        {logs.length === 0 ? (
          <div className="text-center text-slate-500 text-xs italic py-12 select-none">No messages exchanged yet. Start the conversation...</div>
        ) : (
          logs.map((log) => {
            const isMe = log.created_by === me;
            
            return (
              <div key={log.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                {/* Meta details */}
                <div className={`flex items-center gap-2 mb-1 px-1.5 text-[10px] ${isMe ? 'flex-row-reverse' : ''}`}>
                  <strong className={`font-bold ${isMe ? 'text-blue-400' : 'text-slate-300'}`}>{log.created_by}</strong>
                  <span className="text-slate-500">{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                
                {/* Chat bubble */}
                <div className={`max-w-[75%] p-3.5 rounded-2xl shadow-lg ring-1 transition-all ${
                  isMe 
                    ? 'bg-blue-600/10 ring-blue-500/20 text-slate-200 rounded-tr-none' 
                    : 'bg-slate-900/60 ring-slate-900/60 text-slate-300 rounded-tl-none'
                }`}>
                  <div className="prose prose-invert max-w-none text-xs leading-relaxed" dangerouslySetInnerHTML={{ __html: renderBasicMarkdown(log.message) }} />
                  
                  {log.attachment_id && (
                    <div className={`mt-2.5 inline-block ${isMe ? 'text-right w-full' : ''}`}>
                      <span
                        onClick={() => window.open(`/api/v1/attachments/${log.attachment_id}/download`, '_blank')}
                        className="px-2.5 py-1.5 bg-slate-950/80 hover:bg-slate-950 rounded-xl ring-1 ring-slate-900/60 text-[10px] font-semibold text-slate-300 hover:text-blue-400 cursor-pointer inline-flex items-center gap-1.5 transition-all"
                        title="Download attachment"
                      >
                        {/* Office-style attachment icon */}
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-blue-400">
                          <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                        </svg>
                        {log.attachment_id.split('-')[0]}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Editor footer */}
      {canWrite && (
        <div className="p-4 bg-slate-900/30 flex flex-col gap-3 shrink-0">
          <div className="ring-1 ring-slate-900/60 rounded-xl overflow-hidden">
            <MarkdownEditor value={logMessage} onChange={setLogMessage} placeholder="Write your message... (Markdown supported)" rows={2} />
          </div>
          
          <div className="flex justify-between items-center">
            <div className="flex gap-2 items-center">
              <Dropzone onFile={(f) => setFile(f)} compact />
              {file && (
                <span className="text-[10px] font-semibold text-slate-300 flex items-center bg-slate-950 px-2.5 py-1 rounded-xl ring-1 ring-slate-900/60">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400 mr-1">
                    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                  </svg>
                  {file.name}
                  <button className="ml-2 text-red-400 hover:text-red-300 focus:outline-none" onClick={() => setFile(null)}>×</button>
                </span>
              )}
            </div>
            
            <button
              onClick={handleSend}
              disabled={(!logMessage.trim() && !file) || appendLog.isPending}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg flex items-center gap-1.5"
            >
              {appendLog.isPending ? 'Sending...' : 'Send Message'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
