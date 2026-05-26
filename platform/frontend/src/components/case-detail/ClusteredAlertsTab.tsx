'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { AlertTriangle, AlertCircle, Clock, Percent, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

interface ClusteredAlertsTabProps {
	caseId: string;
}

interface ClusteredAlert {
	alert_id: string;
	title: string;
	source: string;
	severity: number;
	similarity_score: number;
	clustered_at: string;
}

export default function ClusteredAlertsTab({ caseId }: ClusteredAlertsTabProps) {
	const { data: alerts, isLoading, isError } = useQuery<ClusteredAlert[]>({
		queryKey: ['case-clustered-alerts', caseId],
		queryFn: () => apiFetch<ClusteredAlert[]>(`/api/v1/cases/${caseId}/clusters`),
		refetchOnWindowFocus: false,
	});

	const getSeverityClass = (sev: number) => {
		if (sev === 0) return 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20';
		if (sev === 1) return 'bg-yellow-500/10 text-yellow-400 ring-1 ring-yellow-500/20';
		if (sev === 2) return 'bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20';
		return 'bg-red-500/10 text-red-400 ring-1 ring-red-500/30';
	};

	const getSeverityLabel = (sev: number) => {
		if (sev === 0) return 'Low';
		if (sev === 1) return 'Medium';
		if (sev === 2) return 'High';
		return 'Critical';
	};

	if (isLoading) {
		return (
			<div className="flex flex-col items-center justify-center py-16 text-slate-500 italic text-xs select-none">
				<ShieldAlert className="w-8 h-8 text-blue-500 animate-pulse mb-2" />
				Đang phân tích các cảnh báo trùng lặp...
			</div>
		);
	}

	if (isError || !alerts) {
		return (
			<div className="p-6 text-center border border-red-900/30 rounded-2xl bg-red-950/20 shadow-md my-4">
				<AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
				<p className="font-semibold text-red-400 text-sm">Không thể tải danh sách cảnh báo gom cụm</p>
			</div>
		);
	}

	return (
		<div className="glass-panel bg-slate-950/40 ring-1 ring-slate-900/60 shadow-2xl rounded-2xl overflow-hidden flex flex-col">
			<div className="px-6 py-4 bg-slate-900/40 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<ShieldAlert className="w-5 h-5 text-blue-500" />
					<h4 className="text-slate-200 font-bold text-sm uppercase tracking-wider">
						Cảnh báo trùng lặp đã gom cụm (Clustered Alerts) ({alerts.length})
					</h4>
				</div>
			</div>

			<div className="p-6">
				{alerts.length === 0 ? (
					<div className="text-center py-12 text-slate-500 text-xs italic border border-dashed border-slate-900 rounded-xl select-none">
						Chưa phát hiện cảnh báo trùng lặp nào được gộp vào sự cố này.
					</div>
				) : (
					<div className="space-y-4">
						<p className="text-xs text-slate-400 leading-relaxed mb-4">
							Các cảnh báo dưới đây đã được hệ thống tự động gom cụm và tích hợp vào hồ sơ điều tra này dựa trên độ tương đồng cao (&gt;85%) về Indicators of Compromise (IOCs), tiêu đề và tags.
						</p>

						<div className="border border-slate-900/60 rounded-xl overflow-hidden bg-slate-950/20 shadow-lg">
							<table className="w-full text-left border-collapse text-xs select-none">
								<thead>
									<tr className="bg-slate-900/40 text-slate-400 font-semibold tracking-wider text-[10px] uppercase border-b border-slate-900">
										<th className="px-6 py-3.5">Tiêu đề cảnh báo</th>
										<th className="px-6 py-3.5">Nguồn</th>
										<th className="px-6 py-3.5">Độ nghiêm trọng</th>
										<th className="px-6 py-3.5 text-center">Tỷ lệ tương đồng</th>
										<th className="px-6 py-3.5 text-right">Thời gian gộp</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-900">
									{alerts.map((alert) => (
										<tr 
											key={alert.alert_id} 
											className="hover:bg-slate-900/30 transition-colors duration-150"
										>
											<td className="px-6 py-4 font-semibold text-slate-200">
												<Link 
													href={`/alerts/${alert.alert_id}`}
													className="text-blue-400 hover:text-blue-300 hover:underline block truncate max-w-md"
												>
													{alert.title}
												</Link>
											</td>
											<td className="px-6 py-4 text-slate-300 font-medium">
												{alert.source}
											</td>
											<td className="px-6 py-4">
												<span className={`px-2 py-0.5 rounded-lg text-[9.5px] font-bold uppercase ${getSeverityClass(alert.severity)}`}>
													{getSeverityLabel(alert.severity)}
												</span>
											</td>
											<td className="px-6 py-4 text-center">
												<div className="flex items-center justify-center gap-1 text-emerald-400 font-mono font-bold">
													<Percent className="w-3.5 h-3.5" />
													{Math.round(alert.similarity_score * 100)}%
												</div>
											</td>
											<td className="px-6 py-4 text-right text-slate-400 font-mono text-[10px]">
												<div className="flex items-center justify-end gap-1.5">
													<Clock className="w-3.5 h-3.5 text-slate-500" />
													{new Date(alert.clustered_at).toLocaleString()}
												</div>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
