'use client';

import { useEffect, useState, useRef } from 'react';
import { apiFetch } from '@/lib/api';

// Lucide-style thin single-color SVG Icons
const IconCpu = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400">
    <rect width="16" height="16" x="4" y="4" rx="2"/>
    <rect width="6" height="6" x="9" y="9" rx="1"/>
    <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 15h3M1 9h3M1 15h3"/>
  </svg>
);

const IconShield = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400">
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c4 0 7-2 7-2s3 2 7 2a1 1 0 0 1 1 1z"/>
  </svg>
);

const IconAlert = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-orange-400">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

interface AIAssistantTabProps {
  caseId: string;
  initialAssessment?: string;
  canWrite: boolean;
}

interface AIResponseJSON {
  threat_analysis: string;
  risk_rating: 'Low' | 'Medium' | 'High' | string;
  containment_recommendations: string[];
}

interface ChatMessage {
  sender: 'analyst' | 'cyberai';
  text: string;
  timestamp: Date;
}

export default function AIAssistantTab({
  caseId,
  initialAssessment,
  canWrite
}: AIAssistantTabProps) {
  const [assessment, setAssessment] = useState<AIResponseJSON | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [providerConfigured, setProviderConfigured] = useState(true);

  // Chatbot states
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if system has AI integration config
    apiFetch<{ configured: boolean }>('/api/v1/admin/settings/ai-status')
      .then(res => setProviderConfigured(res.configured))
      .catch(() => setProviderConfigured(false));

    if (initialAssessment) {
      try {
        const parsed = JSON.parse(initialAssessment) as AIResponseJSON;
        setAssessment(parsed);
      } catch {
        // Fallback if not JSON
        setAssessment({
          threat_analysis: initialAssessment,
          risk_rating: 'Unknown',
          containment_recommendations: []
        });
      }
    }
  }, [initialAssessment]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, chatLoading]);

  const handleRequestAnalysis = async () => {
    if (!canWrite) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<{ response: string }>('/api/v1/cases/' + caseId + '/ai-analyze', {
        method: 'POST'
      });
      
      const parsed = JSON.parse(data.response) as AIResponseJSON;
      setAssessment(parsed);
    } catch (err: any) {
      setError(err.message || 'AI Analysis failed. Make sure CyberAI is healthy.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const text = chatInput.trim();
    setChatInput('');
    
    const newMsg: ChatMessage = {
      sender: 'analyst',
      text,
      timestamp: new Date()
    };
    setChatHistory(prev => [...prev, newMsg]);
    setChatLoading(true);

    try {
      const data = await apiFetch<{ response: string }>('/api/v1/cases/' + caseId + '/ai-chat', {
        method: 'POST',
        json: { message: text }
      });

      const replyMsg: ChatMessage = {
        sender: 'cyberai',
        text: data.response,
        timestamp: new Date()
      };
      setChatHistory(prev => [...prev, replyMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        sender: 'cyberai',
        text: 'Có lỗi xảy ra khi kết nối tới CyberAI: ' + (err.message || 'Không thể nhận phản hồi.'),
        timestamp: new Date()
      };
      setChatHistory(prev => [...prev, errorMsg]);
    } finally {
      setChatLoading(false);
    }
  };

  const getRiskClass = (rating?: string) => {
    switch (rating?.toLowerCase()) {
      case 'high': return 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20 shadow-[0_0_8px_rgba(239,68,68,0.25)] font-bold';
      case 'medium': return 'bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20 shadow-[0_0_8px_rgba(249,115,22,0.2)] font-bold';
      case 'low': return 'bg-green-500/10 text-green-400 ring-1 ring-green-500/20 shadow-[0_0_8px_rgba(34,197,94,0.15)] font-bold';
      default: return 'bg-slate-800 text-slate-400 ring-1 ring-slate-800';
    }
  };

  if (!providerConfigured) {
    return (
      <div className="p-8 text-center glass-panel bg-slate-950/40 ring-1 ring-slate-900/60 rounded-2xl">
        <IconAlert />
        <h4 className="text-slate-300 font-bold text-sm uppercase mt-4 select-none">AI Provider Not Configured</h4>
        <p className="text-slate-500 text-xs mt-2 leading-relaxed max-w-sm mx-auto">
          Please ask your system administrator to configure the CyberAI Gemma endpoints or external AI APIs in the **AI Integrations Settings** page first.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top action block */}
      <div className="glass-panel bg-slate-950/40 ring-1 ring-slate-900/60 shadow-xl rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-600/10 ring-1 ring-purple-500/20 flex items-center justify-center shadow-lg">
            <IconCpu />
          </div>
          <div className="flex flex-col">
            <h3 className="text-slate-200 font-bold text-sm uppercase tracking-wider select-none">CyberAI Incident Copilot</h3>
            <span className="text-[10px] text-slate-500 mt-0.5">Powered by Local Gemma LLM Model Assessment</span>
          </div>
        </div>
        {canWrite && (
          <button
            onClick={handleRequestAnalysis}
            disabled={loading}
            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold uppercase transition-all shadow-[0_0_15px_rgba(147,51,234,0.3)] hover:shadow-[0_0_20px_rgba(147,51,234,0.5)] disabled:opacity-50 flex items-center gap-1.5 shrink-0"
          >
            {loading ? 'Analyzing...' : 'Request AI Assessment'}
          </button>
        )}
      </div>

      {error && (
        <div className="text-xs text-red-400 font-bold bg-red-950/15 border border-red-900/20 px-4 py-3 rounded-xl shadow-sm">{error}</div>
      )}

      {loading && (
        <div className="p-16 text-center glass-panel bg-slate-950/40 ring-1 ring-slate-900/60 rounded-2xl flex flex-col items-center gap-3 select-none">
          <div className="w-8 h-8 rounded-full border-t-2 border-r-2 border-purple-500 animate-spin" />
          <span className="text-xs text-slate-400 font-medium">CyberAI is assessing threat patterns and parsing logs...</span>
        </div>
      )}

      {/* Analysis Result Display */}
      {assessment && !loading && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-stretch">
          {/* Main analysis block */}
          <div className="glass-panel bg-slate-950/40 ring-1 ring-slate-900/60 shadow-2xl rounded-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-slate-900/40 border-b border-slate-900 flex items-center gap-2">
              <IconShield />
              <h4 className="text-slate-200 font-bold text-xs uppercase tracking-wider select-none">Threat & Impact Analysis</h4>
            </div>
            <div className="p-6 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap flex-1">
              {assessment.threat_analysis}
            </div>
          </div>

          {/* Right recommendations block */}
          <div className="flex flex-col gap-6">
            {/* Risk rating */}
            <div className="glass-panel bg-slate-950/40 ring-1 ring-slate-900/60 shadow-2xl rounded-2xl overflow-hidden">
              <div className="px-6 py-4 bg-slate-900/40 border-b border-slate-900">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none">AI Risk Rating</span>
              </div>
              <div className="p-6 flex flex-col items-center justify-center gap-3">
                <span className={`px-4 py-1 rounded-xl text-xs uppercase font-extrabold tracking-wider ${getRiskClass(assessment.risk_rating)}`}>
                  {assessment.risk_rating}
                </span>
                <span className="text-[10px] text-slate-500 text-center leading-relaxed">
                  Calculated based on threat severity, malware attributes and IOC impact.
                </span>
              </div>
            </div>

            {/* Recommendations */}
            <div className="glass-panel bg-slate-950/40 ring-1 ring-slate-900/60 shadow-2xl rounded-2xl overflow-hidden flex-1 flex flex-col">
              <div className="px-6 py-4 bg-slate-900/40 border-b border-slate-900">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none">Containment Steps</span>
              </div>
              <div className="p-6 flex-1 bg-slate-900/10">
                {assessment.containment_recommendations?.length === 0 ? (
                  <div className="text-slate-500 text-xs italic text-center py-6 select-none">No steps recommended.</div>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {assessment.containment_recommendations?.map((step, idx) => (
                      <li key={idx} className="bg-slate-950/60 ring-1 ring-slate-900/60 rounded-xl p-3 flex gap-3 text-xs leading-normal hover:ring-slate-800 transition-all">
                        <span className="text-purple-400 font-extrabold shrink-0">#{idx + 1}</span>
                        <span className="text-slate-300">{step}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive AI Chat Copilot Section */}
      <div className="glass-panel bg-slate-950/40 ring-1 ring-slate-900/60 shadow-2xl rounded-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 bg-slate-900/40 border-b border-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconCpu />
            <h4 className="text-slate-200 font-bold text-xs uppercase tracking-wider select-none">CyberAI Copilot Chat (Trợ lý Phân tích Sự cố SOC)</h4>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Session: #{caseId.slice(0, 8)}</span>
        </div>
        
        {/* Chat History Panel */}
        <div className="p-6 min-h-[300px] max-h-[450px] overflow-y-auto flex flex-col gap-4 bg-slate-900/10">
          {chatHistory.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12 select-none">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-600 mb-2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <h5 className="text-slate-400 font-bold text-xs select-none">Chưa có cuộc hội thoại nào</h5>
              <p className="text-slate-600 text-[10.5px] mt-1 leading-normal max-w-xs select-none">
                Đặt câu hỏi cho CyberAI để phân tích sâu hơn các hành vi mã độc, logs hoặc đề xuất thêm phương án cô lập sự cố.
              </p>
            </div>
          ) : (
            chatHistory.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 max-w-[85%] ${msg.sender === 'analyst' ? 'self-end flex-row-reverse' : 'self-start'}`}>
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ring-1 text-[10px] font-bold ${
                  msg.sender === 'analyst' ? 'bg-blue-600/10 ring-blue-500/20 text-blue-400' : 'bg-purple-600/10 ring-purple-500/20 text-purple-400'
                }`}>
                  {msg.sender === 'analyst' ? 'AN' : 'AI'}
                </div>
                {/* Bubble content */}
                <div className={`p-4 rounded-2xl text-xs leading-relaxed shadow-md transition-all ${
                  msg.sender === 'analyst'
                    ? 'bg-blue-600/15 text-blue-100 ring-1 ring-blue-500/20 rounded-tr-none'
                    : 'bg-slate-950/80 text-slate-200 ring-1 ring-slate-900 rounded-tl-none border-l-2 border-purple-500/60'
                }`}>
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                  <div className="text-[9px] text-slate-500 mt-2 text-right font-mono select-none">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))
          )}
          
          {chatLoading && (
            <div className="self-start flex gap-3 max-w-[85%]">
              <div className="w-8 h-8 rounded-full bg-purple-600/10 ring-1 ring-purple-500/20 flex items-center justify-center text-purple-400 animate-pulse text-[10px] font-bold">
                AI
              </div>
              <div className="bg-slate-950/50 ring-1 ring-slate-900 rounded-2xl rounded-tl-none p-4 text-xs text-slate-400 flex items-center gap-1.5 shadow-md">
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        
        {/* Chat input bar */}
        <div className="p-4 bg-slate-950/60 border-t border-slate-900 flex gap-3 items-center">
          <input
            type="text"
            className="flex-1 bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500/40 shadow-inner"
            placeholder="Đặt câu hỏi phân tích sự cố (ví dụ: Địa chỉ IP này có độc hại không? Cách ly máy chủ thế nào?)..."
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendChatMessage()}
            disabled={chatLoading}
          />
          <button
            onClick={handleSendChatMessage}
            disabled={chatLoading || !chatInput.trim()}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold uppercase transition-all shadow-[0_0_12px_rgba(59,130,246,0.25)] disabled:opacity-50 flex items-center gap-1.5 shrink-0"
          >
            Gửi tin
          </button>
        </div>
      </div>
    </div>
  );
}
