'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AdminShell } from '@/components/AdminShell';
import { apiFetch, ApiError } from '@/lib/api';
import { Plus, Trash2, Edit2, CheckCircle2, XCircle, ChevronDown, ChevronUp } from '@/components/FaIcon';

type AutonomousRule = {
  id?: string;
  name: string;
  description: string;
  observable_type: string;
  threat_score_threshold: number;
  webhook_url: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

type AutonomousLog = {
  id: string;
  rule_id: string;
  rule_name: string;
  observable_id: string;
  observable_type: string;
  observable_value: string;
  threat_score: number;
  action_taken: string;
  status: string;
  response_payload: string;
  triggered_at: string;
};

export default function AutonomousPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'rules' | 'logs'>('rules');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutonomousRule | null>(null);
  
  // States for expandable rows in logs
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [observableType, setObservableType] = useState('ip');
  const [threatScore, setThreatScore] = useState(80);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  // Queries
  const { data: rules = [], isLoading: rulesLoading, error: rulesError } = useQuery<AutonomousRule[]>({
    queryKey: ['autonomous-rules'],
    queryFn: () => apiFetch('/api/v1/admin/autonomous/rules'),
  });

  const { data: logs = [], isLoading: logsLoading, error: logsError } = useQuery<AutonomousLog[]>({
    queryKey: ['autonomous-logs'],
    queryFn: () => apiFetch('/api/v1/admin/autonomous/logs'),
    refetchInterval: activeTab === 'logs' ? 5000 : false, // Auto refresh logs every 5s when active
  });

  // Mutations
  const createRuleMutation = useMutation({
    mutationFn: (newRule: AutonomousRule) =>
      apiFetch('/api/v1/admin/autonomous/rules', { method: 'POST', json: newRule }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autonomous-rules'] });
      closeDrawer();
    },
    onError: (err) => {
      setFormError(err instanceof ApiError ? err.problem.detail || err.problem.title : 'Không thể tạo quy tắc');
    },
  });

  const updateRuleMutation = useMutation({
    mutationFn: ({ id, rule }: { id: string; rule: AutonomousRule }) =>
      apiFetch(`/api/v1/admin/autonomous/rules/${id}`, { method: 'PUT', json: rule }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autonomous-rules'] });
      closeDrawer();
    },
    onError: (err) => {
      setFormError(err instanceof ApiError ? err.problem.detail || err.problem.title : 'Không thể cập nhật quy tắc');
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/admin/autonomous/rules/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autonomous-rules'] });
    },
  });

  // Handle open drawer for create
  const openCreateDrawer = () => {
    setEditingRule(null);
    setName('');
    setDescription('');
    setObservableType('ip');
    setThreatScore(80);
    setWebhookUrl('');
    setIsActive(true);
    setFormError(null);
    setIsDrawerOpen(true);
  };

  // Handle open drawer for edit
  const openEditDrawer = (rule: AutonomousRule) => {
    setEditingRule(rule);
    setName(rule.name);
    setDescription(rule.description || '');
    setObservableType(rule.observable_type);
    setThreatScore(rule.threat_score_threshold);
    setWebhookUrl(rule.webhook_url);
    setIsActive(rule.is_active);
    setFormError(null);
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setEditingRule(null);
  };

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Vui lòng nhập tên quy tắc');
      return;
    }
    if (!webhookUrl.trim() || !webhookUrl.startsWith('http')) {
      setFormError('Vui lòng nhập URL Webhook hợp lệ (bắt đầu bằng http/https)');
      return;
    }

    const payload: AutonomousRule = {
      name,
      description,
      observable_type: observableType,
      threat_score_threshold: threatScore,
      webhook_url: webhookUrl,
      is_active: isActive,
    };

    if (editingRule && editingRule.id) {
      updateRuleMutation.mutate({ id: editingRule.id, rule: payload });
    } else {
      createRuleMutation.mutate(payload);
    }
  };

  const toggleLogExpand = (id: string) => {
    setExpandedLogs((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <AdminShell title="Phản ứng Sự cố Tự động" small="Cấu hình n8n SOAR Active Mitigation">
      {/* Tab Switcher */}
      <div className="flex border-b border-slate-900/60 mb-6 bg-slate-950/20 p-1 rounded-xl w-fit ring-1 ring-slate-900/40 backdrop-blur-md">
        <button
          onClick={() => setActiveTab('rules')}
          className={`px-6 py-2 rounded-lg font-medium text-sm transition-all duration-300 ${
            activeTab === 'rules'
              ? 'bg-blue-600/80 text-white shadow-lg ring-1 ring-blue-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/40'
          }`}
        >
          Quy tắc Tự động
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-6 py-2 rounded-lg font-medium text-sm transition-all duration-300 ${
            activeTab === 'logs'
              ? 'bg-blue-600/80 text-white shadow-lg ring-1 ring-blue-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/40'
          }`}
        >
          Lịch sử Phản ứng
        </button>
      </div>

      {/* Rules Tab */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-slate-400 text-sm">
              Thiết lập các quy tắc để CyberAI tự động cô lập hoặc ngăn chặn hiểm họa qua n8n Webhook khi Threat Score vượt ngưỡng.
            </p>
            <button
              onClick={openCreateDrawer}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors ring-1 ring-blue-500/30"
            >
              <Plus size={14} /> Thêm Quy tắc
            </button>
          </div>

          <div className="bg-slate-950/30 ring-1 ring-slate-900/60 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md">
            {rulesLoading ? (
              <div className="p-8 text-center text-slate-400">Đang tải danh sách quy tắc...</div>
            ) : rulesError ? (
              <div className="p-8 text-center text-red-400">Có lỗi xảy ra khi tải danh sách quy tắc.</div>
            ) : rules.length === 0 ? (
              <div className="p-12 text-center text-slate-500">Chưa có quy tắc tự động nào được tạo. Nhấn "Thêm Quy tắc" để bắt đầu.</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/40 border-b border-slate-900/60 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="p-4">Tên Quy tắc</th>
                    <th className="p-4">Loại Observable</th>
                    <th className="p-4">Ngưỡng Threat Score</th>
                    <th className="p-4">SOAR Webhook URL</th>
                    <th className="p-4 text-center">Trạng thái</th>
                    <th className="p-4 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/40 text-slate-200 text-sm">
                  {rules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-slate-900/20 transition-colors duration-150">
                      <td className="p-4 font-medium">
                        <div>{rule.name}</div>
                        {rule.description && (
                          <div className="text-xs text-slate-500 font-normal mt-0.5">{rule.description}</div>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="bg-slate-900 ring-1 ring-slate-800 text-blue-400 text-xs px-2.5 py-1 rounded-full font-mono font-semibold uppercase">
                          {rule.observable_type}
                        </span>
                      </td>
                      <td className="p-4 font-mono font-bold text-orange-400">
                        &gt;= {rule.threat_score_threshold}
                      </td>
                      <td className="p-4 max-w-xs truncate font-mono text-slate-400 text-xs">
                        {rule.webhook_url}
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                            rule.is_active
                              ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
                              : 'bg-slate-900 text-slate-500 ring-1 ring-slate-800'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${rule.is_active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                          {rule.is_active ? 'Đang bật' : 'Vô hiệu'}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEditDrawer(rule)}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-900/60 rounded-lg transition-all"
                            title="Sửa"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Bạn có chắc chắn muốn xóa quy tắc này?')) {
                                deleteRuleMutation.mutate(rule.id!);
                              }
                            }}
                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                            title="Xóa"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          <p className="text-slate-400 text-sm">
            Nhật ký tự động kích hoạt n8n SOAR Active Mitigation khi phát hiện IOC độc hại trên hệ thống Fusion Center. (Tự động cập nhật 5 giây/lần)
          </p>

          <div className="bg-slate-950/30 ring-1 ring-slate-900/60 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md">
            {logsLoading ? (
              <div className="p-8 text-center text-slate-400">Đang tải lịch sử phản ứng...</div>
            ) : logsError ? (
              <div className="p-8 text-center text-red-400">Có lỗi xảy ra khi tải lịch sử phản ứng.</div>
            ) : logs.length === 0 ? (
              <div className="p-12 text-center text-slate-500">Chưa ghi nhận lịch sử phản ứng tự động nào.</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/40 border-b border-slate-900/60 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="p-4 w-8"></th>
                    <th className="p-4">Thời gian</th>
                    <th className="p-4">Quy tắc</th>
                    <th className="p-4">Đối tượng (IOC)</th>
                    <th className="p-4">Threat Score</th>
                    <th className="p-4">Hành động</th>
                    <th className="p-4">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/40 text-slate-200 text-sm">
                  {logs.map((log) => {
                    const isExpanded = !!expandedLogs[log.id];
                    return (
                      <tr key={log.id} className="hover:bg-slate-900/10 transition-colors duration-150 group">
                        <td className="p-4">
                          <button
                            onClick={() => toggleLogExpand(log.id)}
                            className="p-1 text-slate-400 hover:text-white rounded transition-colors"
                          >
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        </td>
                        <td className="p-4 font-mono text-xs text-slate-400 whitespace-nowrap">
                          {new Date(log.triggered_at).toLocaleString('vi-VN')}
                        </td>
                        <td className="p-4 font-medium text-slate-300">{log.rule_name}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span className="bg-slate-900 text-blue-400 text-[10px] font-semibold px-2 py-0.5 rounded uppercase font-mono">
                              {log.observable_type}
                            </span>
                            <span className="font-mono text-xs text-slate-300 max-w-[200px] truncate" title={log.observable_value}>
                              {log.observable_value}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-red-400">{log.threat_score}</span>
                            <div className="w-16 bg-slate-900 h-1.5 rounded-full overflow-hidden ring-1 ring-slate-800">
                              <div className="bg-red-500 h-full" style={{ width: `${log.threat_score}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-xs text-slate-400 font-mono">{log.action_taken}</td>
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                              log.status === 'Success'
                                ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25'
                                : log.status === 'Pending'
                                ? 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/25'
                                : 'bg-red-500/15 text-red-400 ring-1 ring-red-500/25'
                            }`}
                          >
                            {log.status === 'Success' ? (
                              <>
                                <CheckCircle2 size={11} /> Thành công
                              </>
                            ) : log.status === 'Pending' ? (
                              <>
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping mr-1" />
                                Đang xử lý
                              </>
                            ) : (
                              <>
                                <XCircle size={11} /> Thất bại
                              </>
                            )}
                          </span>
                        </td>
                        
                        {/* Expandable row content */}
                        {isExpanded && (
                          <tr className="bg-slate-950/60">
                            <td colSpan={7} className="p-4">
                              <div className="space-y-2">
                                <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                                  Chi tiết kết quả phản hồi từ n8n Webhook SOAR:
                                </div>
                                <pre className="p-3 bg-slate-950 ring-1 ring-slate-900 rounded-xl font-mono text-[11px] text-slate-400 overflow-x-auto whitespace-pre-wrap max-h-60 leading-relaxed shadow-inner">
                                  {log.response_payload || 'Không có payload phản hồi.'}
                                </pre>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Slide Drawer (Thêm / Sửa quy tắc) */}
      {isDrawerOpen && (
        <>
          {/* Overlay */}
          <div onClick={closeDrawer} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-all duration-300" />
          
          {/* Drawer container */}
          <div className="fixed right-0 top-0 h-full w-96 bg-slate-950/95 backdrop-blur-lg border-l border-slate-900 shadow-2xl z-50 transform translate-x-0 transition-transform duration-300 ease-in-out p-6 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white">
                  {editingRule ? 'Cập nhật Quy tắc' : 'Thêm Quy tắc Mới'}
                </h3>
                <button
                  onClick={closeDrawer}
                  className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-slate-900 transition-colors"
                >
                  <XCircle size={18} />
                </button>
              </div>

              {formError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-xs mb-4">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Tên Quy tắc</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ví dụ: Block IP Bruteforce trên Firewall"
                    className="w-full bg-slate-900/60 ring-1 ring-slate-900/60 text-white rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none placeholder-slate-600 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Mô tả quy tắc</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Nhập mô tả hoạt động hoặc mục tiêu của quy tắc..."
                    rows={3}
                    className="w-full bg-slate-900/60 ring-1 ring-slate-900/60 text-white rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none placeholder-slate-600 transition-all resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Loại Thực thể (IOC)</label>
                    <select
                      value={observableType}
                      onChange={(e) => setObservableType(e.target.value)}
                      className="w-full bg-slate-900/60 ring-1 ring-slate-900/60 text-white rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all cursor-pointer"
                    >
                      <option value="ip">IP Address</option>
                      <option value="domain">Domain</option>
                      <option value="hash">File Hash</option>
                      <option value="url">URL</option>
                      <option value="user">User</option>
                      <option value="mail">Email</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Threat Score tối thiểu</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={threatScore}
                        onChange={(e) => setThreatScore(parseInt(e.target.value) || 0)}
                        className="w-20 bg-slate-900/60 ring-1 ring-slate-900/60 text-white rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all font-mono font-bold"
                      />
                      <span className="text-slate-500 text-xs">/ 100</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">n8n SOAR Webhook URL</label>
                  <input
                    type="text"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="http://n8n-server:5678/webhook/..."
                    className="w-full bg-slate-900/60 ring-1 ring-slate-900/60 text-white rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none placeholder-slate-600 transition-all font-mono text-xs"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Webhook URL được cấu hình làm Trigger trong Playbook SOAR của n8n.
                  </p>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-900/40 rounded-xl ring-1 ring-slate-900/40">
                  <div>
                    <div className="text-sm font-semibold text-white">Kích hoạt Quy tắc</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Quy tắc sẽ lập tức hoạt động sau khi lưu</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-white" />
                  </label>
                </div>
              </form>
            </div>

            <div className="flex gap-3 pt-6 border-t border-slate-900/60">
              <button
                onClick={closeDrawer}
                className="flex-1 bg-slate-900 hover:bg-slate-850 text-slate-300 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors ring-1 ring-slate-900/40"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleSubmit}
                disabled={createRuleMutation.isPending || updateRuleMutation.isPending}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors ring-1 ring-blue-500/30 flex items-center justify-center"
              >
                {createRuleMutation.isPending || updateRuleMutation.isPending ? 'Đang lưu...' : 'Lưu Quy tắc'}
              </button>
            </div>
          </div>
        </>
      )}
    </AdminShell>
  );
}
