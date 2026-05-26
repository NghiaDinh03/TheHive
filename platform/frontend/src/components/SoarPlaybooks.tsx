'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Play, CheckCircle, XCircle, Clock, Loader2, Cpu, AlertCircle, RefreshCw } from 'lucide-react';

interface SoarPlaybooksProps {
	caseId: string;
}

interface PlaybookStep {
	id: string;
	playbook_run_id: string;
	name: string;
	status: string; // "pending", "running", "completed", "failed"
	message: string;
	position: number;
	updated_at: string;
}

interface PlaybookRun {
	id: string;
	case_id: string;
	name: string;
	status: string; // "running", "completed", "failed"
	steps: PlaybookStep[];
	created_at: string;
	updated_at: string;
}

export default function SoarPlaybooks({ caseId }: SoarPlaybooksProps) {
	const { data: playbooks, isLoading, isError, refetch } = useQuery<PlaybookRun[]>({
		queryKey: ['case-playbooks', caseId],
		queryFn: () => apiFetch<PlaybookRun[]>(`/api/v1/cases/${caseId}/playbooks`),
		refetchInterval: 3000, // Poll every 3 seconds for real-time SOAR feedback!
		refetchOnWindowFocus: false,
	});

	if (isLoading) {
		return (
			<div className="flex flex-col items-center justify-center h-48 glass-card text-slate-300">
				<Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
				<p className="text-xs">Đang tải kịch bản tự động SOAR n8n...</p>
			</div>
		);
	}

	if (isError || !playbooks) {
		return (
			<div className="flex flex-col items-center justify-center h-48 glass-card text-red-400">
				<AlertCircle className="w-8 h-8 mb-2 animate-bounce" />
				<p className="text-xs mb-2">Không thể tải thông tin SOAR Playbooks</p>
				<button 
					onClick={() => void refetch()}
					className="px-3 py-1 bg-red-950/40 border border-red-500/30 rounded text-[10px] hover:bg-red-900/40 transition"
				>
					Thử lại
				</button>
			</div>
		);
	}

	const getOverallStatusBadge = (status: string) => {
		if (status === 'completed') {
			return (
				<span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.2)]">
					Thành công
				</span>
			);
		}
		if (status === 'failed') {
			return (
				<span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 border border-red-500/30 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.2)] animate-pulse">
					Lỗi kịch bản
				</span>
			);
		}
		return (
			<span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 border border-blue-500/30 text-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.2)] flex items-center gap-1">
				<Loader2 className="w-3 h-3 animate-spin" /> Đang chạy (n8n)
			</span>
		);
	};

	const getStepIcon = (status: string) => {
		if (status === 'completed') {
			return <CheckCircle className="w-5 h-5 text-emerald-400 filter drop-shadow-[0_0_4px_rgba(52,211,153,0.4)]" />;
		}
		if (status === 'failed') {
			return <XCircle className="w-5 h-5 text-red-500 filter drop-shadow-[0_0_4px_rgba(239,68,68,0.4)] animate-pulse" />;
		}
		if (status === 'running') {
			return <Loader2 className="w-5 h-5 text-blue-400 animate-spin filter drop-shadow-[0_0_4px_rgba(96,165,250,0.4)]" />;
		}
		return <Clock className="w-5 h-5 text-slate-500" />;
	};

	return (
		<div className="space-y-4">
			{/* Header info */}
			<div className="flex justify-between items-center bg-slate-900/40 p-3 rounded-lg border border-white/5 backdrop-blur-md">
				<div className="flex items-center gap-2">
					<Cpu className="w-5 h-5 text-blue-500 animate-pulse" />
					<div>
						<h4 className="text-xs font-semibold text-white">Tự động hoá SOC (SOAR)</h4>
						<p className="text-[10px] text-slate-400">Đồng bộ kịch bản phản ứng nhanh thời gian thực qua n8n Webhook</p>
					</div>
				</div>
				<button 
					onClick={() => void refetch()}
					className="p-1 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-slate-400 hover:text-white transition"
					title="Làm mới"
				>
					<RefreshCw className="w-3.5 h-3.5" />
				</button>
			</div>

			{playbooks.length === 0 ? (
				<div className="flex flex-col items-center justify-center p-8 glass-card border border-white/5 rounded-xl bg-slate-950/20 text-slate-400 text-center">
					<Cpu className="w-10 h-10 text-slate-600 mb-2" />
					<p className="text-xs font-medium">Chưa có kịch bản SOAR nào được kích hoạt</p>
					<p className="text-[10px] text-slate-500 mt-1">Khi sự cố kích hoạt các rule giám sát, n8n Playbook sẽ tự động chạy tại đây.</p>
				</div>
			) : (
				<div className="space-y-4">
					{playbooks.map((run) => (
						<div 
							key={run.id} 
							className="glass-card border border-white/10 rounded-xl overflow-hidden bg-slate-950/30 backdrop-blur-md shadow-lg"
						>
							{/* Playbook Header */}
							<div className="flex justify-between items-center p-3.5 bg-white/5 border-b border-white/5">
								<div>
									<h5 className="text-xs font-bold text-slate-200 flex items-center gap-2">
										<span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
										{run.name}
									</h5>
									<p className="text-[9px] text-slate-400 mt-0.5">
										Kích hoạt: {new Date(run.created_at).toLocaleString('vi-VN')}
									</p>
								</div>
								<div>{getOverallStatusBadge(run.status)}</div>
							</div>

							{/* Vertical Steps Timeline */}
							<div className="p-4 space-y-4 relative">
								{/* Draw vertical connector line */}
								{run.steps.length > 1 && (
									<div 
										className="absolute left-6.5 top-8 bottom-8 w-0.5 bg-gradient-to-b from-blue-500/30 to-slate-800"
										style={{ left: '26px' }}
									/>
								)}

								{run.steps.map((step, idx) => {
									const isCurrent = step.status === 'running';
									return (
										<div 
											key={step.id} 
											className={`flex gap-4 items-start relative transition-all duration-300 ${isCurrent ? 'scale-[1.01] bg-blue-950/10 p-2 rounded-lg border border-blue-500/10' : ''}`}
										>
											{/* Status Icon */}
											<div className="z-10 bg-slate-950 rounded-full p-0.5">
												{getStepIcon(step.status)}
											</div>

											{/* Step Details */}
											<div className="flex-1 min-w-0">
												<div className="flex justify-between items-center">
													<h6 className={`text-xs font-semibold ${isCurrent ? 'text-blue-400 font-bold' : 'text-slate-300'}`}>
														{step.name}
													</h6>
													<span className="text-[9px] text-slate-500">
														{new Date(step.updated_at).toLocaleTimeString('vi-VN')}
													</span>
												</div>
												
												{step.message && (
													<p className={`text-[10px] mt-1 p-2 rounded font-mono break-all leading-relaxed ${
														step.status === 'failed' ? 'bg-red-950/20 border border-red-500/10 text-red-300' :
														step.status === 'completed' ? 'bg-emerald-950/20 border border-emerald-500/10 text-emerald-300' :
														'bg-slate-900/60 border border-white/5 text-slate-300'
													}`}>
														{step.message}
													</p>
												)}
											</div>
										</div>
									);
								})}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
