'use client';

import React from 'react';
import { Shield, Globe, FileCode, Server, HelpCircle, Eye, AlertOctagon, Cpu, Play } from 'lucide-react';

interface IOCCardProps {
	id: string;
	dataType: string;
	data: string;
	message?: string;
	tlp: number;
	ioc: boolean;
	sighted: boolean;
	tags: string[];
	maliciousScore: number;
	mispTags?: string;
	createdBy: string;
	createdAt: string;
	onTriggerEnrichment?: (id: string) => void;
}

export default function IOCCard({
	id,
	dataType,
	data,
	message,
	tlp,
	ioc,
	sighted,
	tags,
	maliciousScore,
	mispTags,
	createdBy,
	createdAt,
	onTriggerEnrichment,
}: IOCCardProps) {

	// 1. Get Icon based on DataType
	const getIOCIcon = (type: string) => {
		const normType = type.toLowerCase();
		if (normType.includes('ip') || normType.includes('ipv4') || normType.includes('ipv6')) {
			return <Server className="w-5 h-5" />;
		}
		if (normType.includes('domain') || normType.includes('url') || normType.includes('hostname')) {
			return <Globe className="w-5 h-5" />;
		}
		if (normType.includes('hash') || normType.includes('md5') || normType.includes('sha')) {
			return <FileCode className="w-5 h-5" />;
		}
		return <HelpCircle className="w-5 h-5" />;
	};

	// 2. Get TLP Styling
	const getTLPInfo = (tlpVal: number) => {
		if (tlpVal === 1) return { label: 'TLP:GREEN', color: '#22c55e', border: 'border-emerald-500/20 shadow-[0_0_10px_rgba(34,197,94,0.15)]', bg: 'bg-emerald-950/20' };
		if (tlpVal === 2) return { label: 'TLP:AMBER', color: '#f97316', border: 'border-amber-500/20 shadow-[0_0_10px_rgba(249,115,22,0.15)]', bg: 'bg-amber-950/20' };
		if (tlpVal === 3) return { label: 'TLP:RED', color: '#ef4444', border: 'border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.15)]', bg: 'bg-red-950/20' };
		return { label: 'TLP:WHITE', color: '#ffffff', border: 'border-white/10', bg: 'bg-slate-900/40' };
	};

	const tlpInfo = getTLPInfo(tlp);

	// 3. Score ring calculation
	const radius = 16;
	const circumference = 2 * Math.PI * radius;
	const strokeDashoffset = circumference - (maliciousScore / 100) * circumference;

	const getScoreColor = (score: number) => {
		if (score >= 75) return '#ef4444'; // Red
		if (score >= 40) return '#f97316'; // Amber
		return '#22c55e'; // Green
	};

	const scoreColor = getScoreColor(maliciousScore);

	// Parse MISP tags if exists (usually JSON string)
	let mispLabels: string[] = [];
	if (mispTags) {
		try {
			const parsed = JSON.parse(mispTags);
			if (Array.isArray(parsed)) {
				mispLabels = parsed;
			}
		} catch {
			// ignore parse error
		}
	}

	return (
		<div className={`relative glass-card border rounded-xl p-4 bg-slate-950/40 backdrop-blur-md transition-all duration-300 hover:scale-[1.02] flex flex-col justify-between min-h-[160px] ${tlpInfo.border}`}>
			
			{/* Top Bar: Icon + DataType + TLP + Score Ring */}
			<div className="flex justify-between items-start">
				<div className="flex gap-2.5 items-center">
					<div 
						className="p-1.5 rounded-lg bg-slate-900 border border-white/5 text-blue-400 filter drop-shadow-[0_0_5px_rgba(59,130,246,0.3)]"
						style={{ color: tlpInfo.color }}
					>
						{getIOCIcon(dataType)}
					</div>
					<div>
						<span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{dataType}</span>
						<div className="flex gap-1.5 items-center mt-0.5">
							<span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${tlpInfo.bg}`} style={{ color: tlpInfo.color }}>
								{tlpInfo.label}
							</span>
							{ioc && (
								<span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-950/20 border border-red-500/30 text-red-400 flex items-center gap-0.5 shadow-[0_0_6px_rgba(239,68,68,0.1)]">
									<Shield className="w-2.5 h-2.5" /> IOC
								</span>
							)}
							{sighted && (
								<span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-950/20 border border-blue-500/30 text-blue-400 flex items-center gap-0.5">
									<Eye className="w-2.5 h-2.5" /> Sighted
								</span>
							)}
						</div>
					</div>
				</div>

				{/* Circular Score Ring */}
				<div className="relative flex items-center justify-center w-10 h-10 select-none" title={`Độ độc hại: ${maliciousScore}%`}>
					<svg className="w-full h-full transform -rotate-90">
						<circle cx="20" cy="20" r={radius} fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
						<circle 
							cx="20" 
							cy="20" 
							r={radius} 
							fill="transparent" 
							stroke={scoreColor} 
							strokeWidth="3" 
							strokeDasharray={circumference}
							strokeDashoffset={strokeDashoffset}
							strokeLinecap="round"
							className="transition-all duration-500"
							style={{ filter: `drop-shadow(0 0 3px ${scoreColor})` }}
						/>
					</svg>
					<span className="absolute text-[9px] font-bold" style={{ color: scoreColor }}>
						{maliciousScore}%
					</span>
				</div>
			</div>

			{/* Middle: IOC Value (Clean and prominent) */}
			<div className="my-3 flex-1 min-w-0">
				<p className="text-xs font-mono font-bold text-slate-200 break-all select-all hover:text-white transition bg-slate-900/60 p-2 rounded border border-white/5">
					{data}
				</p>
				{message && (
					<p className="text-[10px] text-slate-400 mt-1 italic line-clamp-2" title={message}>
						{message}
					</p>
				)}
			</div>

			{/* Bottom: Tags / Action Trigger */}
			<div className="border-t border-white/5 pt-2.5 flex justify-between items-center mt-auto">
				{/* Taxonomy Tags */}
				<div className="flex flex-wrap gap-1 max-w-[75%] overflow-hidden max-h-[38px]">
					{tags.map((tag, idx) => (
						<span 
							key={`tag-${idx}`} 
							className="text-[9px] px-1.5 py-0.2 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-slate-400 transition"
						>
							{tag}
						</span>
					))}
					{mispLabels.map((tag, idx) => (
						<span 
							key={`misp-${idx}`} 
							className="text-[9px] px-1.5 py-0.2 bg-purple-950/20 border border-purple-500/20 text-purple-300 rounded shadow-[0_0_4px_rgba(168,85,247,0.1)]"
						>
							{tag}
						</span>
					))}
					{tags.length === 0 && mispLabels.length === 0 && (
						<span className="text-[9px] text-slate-500">Chưa gắn nhãn</span>
					)}
				</div>

				{/* Enrichment Trigger Button (n8n integration) */}
				{onTriggerEnrichment && (
					<button
						onClick={() => onTriggerEnrichment(id)}
						className="p-1.5 rounded-lg bg-blue-950/30 border border-blue-500/20 hover:border-blue-400 text-blue-400 hover:text-blue-300 hover:bg-blue-950/50 shadow-[0_0_8px_rgba(59,130,246,0.1)] hover:shadow-[0_0_10px_rgba(59,130,246,0.3)] transition duration-200 group flex items-center justify-center"
						title="Chạy n8n Enricher"
					>
						<Play className="w-3 h-3 group-hover:scale-110 transition" />
					</button>
				)}
			</div>
		</div>
	);
}
