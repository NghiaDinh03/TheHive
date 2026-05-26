'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, Printer, Globe, Loader2, Check } from 'lucide-react';

interface IncidentReportModalProps {
	isOpen: boolean;
	onClose: () => void;
	caseId: string;
	caseNumber: number;
	caseTitle: string;
}

export default function IncidentReportModal({
	isOpen,
	onClose,
	caseId,
	caseNumber,
	caseTitle,
}: IncidentReportModalProps) {
	const [lang, setLang] = useState<'vi' | 'en'>('vi');
	const [isGenerating, setIsGenerating] = useState(false);

	const handleExport = () => {
		setIsGenerating(true);
		
		// Wait a brief moment to show smooth micro-animation
		setTimeout(() => {
			setIsGenerating(false);
			const url = `/api/v1/cases/${caseId}/report?lang=${lang}`;
			// Open report in a new tab for WYSIWYG HTML-to-PDF print experience
			window.open(url, '_blank');
			onClose();
		}, 800);
	};

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="sm:max-w-[420px] glass-card border border-white/10 bg-slate-950/90 backdrop-blur-md text-white shadow-2xl p-6 rounded-xl">
				<DialogHeader className="border-b border-white/5 pb-4 mb-4">
					<DialogTitle className="text-base font-bold flex items-center gap-2 text-white">
						<FileText className="w-5 h-5 text-blue-500 animate-pulse" />
						Xuất Báo Cáo Sự Cố
					</DialogTitle>
					<DialogDescription className="text-xs text-slate-400 mt-1">
						Tạo báo cáo sự cố chuyên nghiệp đóng dấu thương hiệu NCS Fusion Center.
					</DialogDescription>
				</DialogHeader>

				{/* Case Info Preview */}
				<div className="bg-white/5 border border-white/5 p-3 rounded-lg text-xs space-y-1 mb-4 select-none">
					<div className="flex justify-between">
						<span className="text-slate-400">Mã Sự Cố:</span>
						<span className="font-mono font-bold text-slate-200">#{String(caseNumber).padStart(8, '0')}</span>
					</div>
					<div className="flex justify-between">
						<span className="text-slate-400">Tiêu đề:</span>
						<span className="font-semibold text-slate-200 text-right truncate max-w-[200px]" title={caseTitle}>
							{caseTitle}
						</span>
					</div>
				</div>

				{/* Language Choice */}
				<div className="space-y-2 mb-6">
					<label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
						Ngôn ngữ Báo cáo
					</label>
					<div className="grid grid-cols-2 gap-3">
						<button
							onClick={() => setLang('vi')}
							className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-xs font-semibold transition ${
								lang === 'vi' 
									? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]' 
									: 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:border-white/10'
							}`}
						>
							<div className="flex items-center gap-2">
								<span className="text-sm">🇻🇳</span>
								<span>Tiếng Việt</span>
							</div>
							{lang === 'vi' && <Check className="w-4 h-4 text-blue-400" />}
						</button>
						
						<button
							onClick={() => setLang('en')}
							className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-xs font-semibold transition ${
								lang === 'en' 
									? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]' 
									: 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:border-white/10'
							}`}
						>
							<div className="flex items-center gap-2">
								<span className="text-sm">🇬🇧</span>
								<span>English</span>
							</div>
							{lang === 'en' && <Check className="w-4 h-4 text-blue-400" />}
						</button>
					</div>
				</div>

				<DialogFooter className="flex gap-2 justify-end pt-4 border-t border-white/5">
					<Button
						variant="ghost"
						onClick={onClose}
						className="px-4 py-2 border border-white/10 text-xs hover:bg-white/5 text-slate-300 rounded-lg transition"
						disabled={isGenerating}
					>
						Hủy bỏ
					</Button>
					<Button
						onClick={handleExport}
						className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition shadow-[0_0_15px_rgba(29,78,216,0.4)] hover:shadow-[0_0_20px_rgba(29,78,216,0.6)] flex items-center gap-2"
						disabled={isGenerating}
					>
						{isGenerating ? (
							<>
								<Loader2 className="w-4 h-4 animate-spin" />
								Đang tạo...
							</>
						) : (
							<>
								<Printer className="w-4 h-4" />
								Tạo & In PDF
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
