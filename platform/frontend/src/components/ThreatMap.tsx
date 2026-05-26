'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Shield, FileText, AlertTriangle, Info, Network, ZoomIn, ZoomOut } from 'lucide-react';
import Link from 'next/link';

interface ThreatMapProps {
	caseId: string;
}

interface GraphNode {
	id: string;
	label: string;
	type: string; // "case" or "observable"
	tlp?: number;
}

interface GraphLink {
	source: string;
	target: string;
}

interface GraphResponse {
	nodes: GraphNode[];
	links: GraphLink[];
}

export default function ThreatMap({ caseId }: ThreatMapProps) {
	const [zoom, setZoom] = useState<number>(1);
	const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
	const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

	const { data, isLoading, isError, refetch } = useQuery<GraphResponse>({
		queryKey: ['case-correlation', caseId],
		queryFn: () => apiFetch<GraphResponse>(`/api/v1/cases/${caseId}/correlation`),
		refetchOnWindowFocus: false,
	});

	if (isLoading) {
		return (
			<div className="flex flex-col items-center justify-center h-[500px] glass-card text-slate-300">
				<Network className="w-12 h-12 text-blue-500 animate-pulse mb-3" />
				<p className="text-sm font-medium">Đang tính toán ma trận tương quan...</p>
			</div>
		);
	}

	if (isError || !data) {
		return (
			<div className="flex flex-col items-center justify-center h-[500px] glass-card text-red-400">
				<AlertTriangle className="w-12 h-12 mb-3 animate-bounce" />
				<p className="text-sm font-medium mb-3">Lỗi tải dữ liệu tương quan</p>
				<button 
					onClick={() => void refetch()}
					className="px-4 py-2 bg-red-950/40 border border-red-500/30 rounded text-xs hover:bg-red-900/40 transition"
				>
					Thử lại
				</button>
			</div>
		);
	}

	// 1. Separate nodes
	const centerNode = data.nodes.find(n => n.id === caseId) || { id: caseId, label: 'Case hiện tại', type: 'case', tlp: 2 };
	const observableNodes = data.nodes.filter(n => n.type === 'observable');
	const relatedCaseNodes = data.nodes.filter(n => n.type === 'case' && n.id !== caseId);

	// 2. Position nodes using Solar System layout
	const width = 800;
	const height = 500;
	const centerX = width / 2;
	const centerY = height / 2;

	const nodePositions: Record<string, { x: number; y: number }> = {};

	// Center node position
	nodePositions[centerNode.id] = { x: centerX, y: centerY };

	// R1: Observable nodes (Radius 140px)
	const r1 = 130;
	observableNodes.forEach((node, i) => {
		const angle = (i * 2 * Math.PI) / (observableNodes.length || 1);
		nodePositions[node.id] = {
			x: centerX + r1 * Math.cos(angle),
			y: centerY + r1 * Math.sin(angle),
		};
	});

	// R2: Related case nodes (Radius 240px)
	const r2 = 230;
	relatedCaseNodes.forEach((node, i) => {
		const angle = (i * 2 * Math.PI) / (relatedCaseNodes.length || 1) + Math.PI / 4; // offset angle slightly to mismatch R1
		nodePositions[node.id] = {
			x: centerX + r2 * Math.cos(angle),
			y: centerY + r2 * Math.sin(angle),
		};
	});

	const getTLPColor = (tlp?: number) => {
		if (tlp === 1) return '#22c55e'; // Green
		if (tlp === 2) return '#f97316'; // Amber
		if (tlp === 3) return '#ef4444'; // Red
		return '#94a3b8'; // White
	};

	const handleNodeHover = (e: React.MouseEvent, node: GraphNode) => {
		const rect = e.currentTarget.getBoundingClientRect();
		const containerRect = e.currentTarget.parentElement?.getBoundingClientRect();
		if (containerRect) {
			setTooltipPos({
				x: rect.left - containerRect.left + rect.width / 2,
				y: rect.top - containerRect.top - 10,
			});
		}
		setHoveredNode(node);
	};

	return (
		<div className="relative glass-card border border-white/10 rounded-xl overflow-hidden p-6 bg-slate-950/40 backdrop-blur-md shadow-2xl">
			{/* Header controls */}
			<div className="flex justify-between items-center mb-4 border-b border-white/5 pb-4">
				<div>
					<h3 className="text-base font-semibold text-white flex items-center gap-2">
						<Network className="w-5 h-5 text-blue-500 animate-pulse" />
						Bản đồ Tương quan Mối đe dọa (Threat Map)
					</h3>
					<p className="text-xs text-slate-400 mt-1">
						Trực quan tương quan IOC giữa các Case (Mô hình Hệ Mặt Trời SOC Premium)
					</p>
				</div>
				<div className="flex gap-2 no-print">
					<button 
						onClick={() => setZoom(prev => Math.max(0.6, prev - 0.1))}
						className="p-1.5 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-slate-300 transition"
						title="Thu nhỏ"
					>
						<ZoomOut className="w-4 h-4" />
					</button>
					<button 
						onClick={() => setZoom(prev => Math.min(1.5, prev + 0.1))}
						className="p-1.5 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-slate-300 transition"
						title="Phóng to"
					>
						<ZoomIn className="w-4 h-4" />
					</button>
					<button 
						onClick={() => setZoom(1)}
						className="px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-xs text-slate-300 transition"
					>
						Reset
					</button>
				</div>
			</div>

			{/* SVG Canvas Area */}
			<div className="relative overflow-auto flex justify-center bg-slate-950/80 rounded-xl border border-white/5 p-4 select-none">
				<svg 
					width={width} 
					height={height} 
					className="transition-transform duration-200" 
					style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
				>
					{/* Background concentric orbits */}
					<circle cx={centerX} cy={centerY} r={r1} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1.5" strokeDasharray="5,5" />
					<circle cx={centerX} cy={centerY} r={r2} fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="1.5" strokeDasharray="8,8" />

					{/* Links rendering */}
					{data.links.map((link, idx) => {
						const from = nodePositions[link.source];
						const to = nodePositions[link.target];
						if (!from || !to) return null;

						// Draw curved path for outer case linkages to feel elegant
						const isOuterLink = relatedCaseNodes.some(n => n.id === link.target);
						let d = `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
						if (isOuterLink) {
							// Quadratic bezier curve
							const dx = to.x - from.x;
							const dy = to.y - from.y;
							const cx = (from.x + to.x) / 2 - dy * 0.15;
							const cy = (from.y + to.y) / 2 + dx * 0.15;
							d = `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
						}

						return (
							<path
								key={`link-${idx}`}
								d={d}
								fill="none"
								stroke={isOuterLink ? 'rgba(239, 68, 68, 0.4)' : 'rgba(59, 130, 246, 0.3)'}
								strokeWidth={isOuterLink ? 1.5 : 1}
								strokeDasharray={isOuterLink ? '4,4' : 'none'}
								className={isOuterLink ? 'animate-[dash_10s_linear_infinite]' : ''}
							/>
						);
					})}

					{/* Center Case Node */}
					<g 
						transform={`translate(${centerX}, ${centerY})`}
						onMouseEnter={(e) => handleNodeHover(e, centerNode)}
						onMouseLeave={() => setHoveredNode(null)}
						className="cursor-pointer group"
					>
						<circle 
							r="32" 
							fill="rgba(29, 78, 216, 0.2)" 
							stroke="#1d4ed8" 
							strokeWidth="2.5" 
							className="animate-[pulse_3s_infinite] filter drop-shadow-[0_0_15px_rgba(29,78,216,0.6)]"
						/>
						<circle r="26" fill="#1d4ed8" className="group-hover:fill-blue-600 transition" />
						<Shield className="w-7 h-7 text-white" style={{ transform: 'translate(-14px, -14px)' }} />
					</g>

					{/* R1: Observable Nodes */}
					{observableNodes.map((node) => {
						const pos = nodePositions[node.id];
						if (!pos) return null;
						const tlpColor = getTLPColor(node.tlp);

						return (
							<g 
								key={node.id} 
								transform={`translate(${pos.x}, ${pos.y})`}
								onMouseEnter={(e) => handleNodeHover(e, node)}
								onMouseLeave={() => setHoveredNode(null)}
								className="cursor-pointer group"
							>
								{/* Pulse ring for high TLP */}
								{node.tlp === 3 && (
									<circle 
										r="22" 
										fill="none" 
										stroke={tlpColor} 
										strokeWidth="1" 
										className="animate-ping opacity-30" 
									/>
								)}
								<circle 
									r="16" 
									fill="rgba(15, 23, 42, 0.85)" 
									stroke={tlpColor} 
									strokeWidth="2" 
									className="group-hover:scale-110 transition filter drop-shadow-[0_0_8px_rgba(0,0,0,0.5)]"
									style={{ filter: `drop-shadow(0 0 5px ${tlpColor}40)` }}
								/>
								<FileText className="w-4.5 h-4.5 text-slate-300" style={{ transform: 'translate(-9px, -9px)' }} />
							</g>
						);
					})}

					{/* R2: Related Case Nodes */}
					{relatedCaseNodes.map((node) => {
						const pos = nodePositions[node.id];
						if (!pos) return null;

						return (
							<Link key={node.id} href={`/cases/${node.id}`}>
								<g 
									transform={`translate(${pos.x}, ${pos.y})`}
									onMouseEnter={(e) => handleNodeHover(e, node)}
									onMouseLeave={() => setHoveredNode(null)}
									className="cursor-pointer group"
								>
									<circle 
										r="24" 
										fill="rgba(15, 23, 42, 0.9)" 
										stroke="#ef4444" 
										strokeWidth="2" 
										className="group-hover:stroke-red-500 filter drop-shadow-[0_0_12px_rgba(239,68,68,0.3)] transition" 
									/>
									<circle r="19" fill="rgba(239, 68, 68, 0.15)" />
									<Shield className="w-5 h-5 text-red-500 group-hover:text-red-400 transition" style={{ transform: 'translate(-10px, -10px)' }} />
								</g>
							</Link>
						);
					})}
				</svg>

				{/* Floating Tooltip Panel (Glassmorphism style) */}
				{hoveredNode && (
					<div 
						className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-full px-3 py-2 rounded-lg border border-white/10 bg-slate-950/90 backdrop-blur-md shadow-2xl text-xs z-30 w-64"
						style={{ left: tooltipPos.x, top: tooltipPos.y }}
					>
						<div className="flex items-center gap-2 mb-1.5">
							<span className={`w-2.5 h-2.5 rounded-full`} style={{ backgroundColor: getTLPColor(hoveredNode.tlp), boxShadow: `0 0 5px ${getTLPColor(hoveredNode.tlp)}` }} />
							<span className="font-semibold text-slate-200 capitalize">
								{hoveredNode.type === 'case' ? (hoveredNode.id === caseId ? 'Sự cố hiện tại' : 'Sự cố trùng lặp') : 'Observable (IOC)'}
							</span>
						</div>
						<p className="text-slate-300 font-medium break-all">{hoveredNode.label}</p>
						
						{hoveredNode.type === 'case' && hoveredNode.id !== caseId && (
							<div className="mt-2 text-[10px] text-red-400 font-medium border-t border-white/5 pt-1 flex items-center gap-1.5 animate-pulse">
								<Info className="w-3.5 h-3.5" /> Nhấp vào nút đỏ để điều hướng
							</div>
						)}
					</div>
				)}
			</div>

			{/* Mini Legend */}
			<div className="flex gap-6 mt-4 justify-center text-xs text-slate-400 border-t border-white/5 pt-4">
				<div className="flex items-center gap-2">
					<span className="w-3.5 h-3.5 rounded-full bg-blue-600 border border-blue-500 filter drop-shadow-[0_0_4px_rgba(59,130,246,0.6)]" />
					<span>Sự cố hiện tại</span>
				</div>
				<div className="flex items-center gap-2">
					<span className="w-3.5 h-3.5 rounded-full bg-slate-900 border border-emerald-500 filter drop-shadow-[0_0_4px_rgba(16,185,129,0.4)]" />
					<span>IOC sạch (TLP:GREEN)</span>
				</div>
				<div className="flex items-center gap-2">
					<span className="w-3.5 h-3.5 rounded-full bg-slate-900 border border-amber-500 filter drop-shadow-[0_0_4px_rgba(245,158,11,0.4)]" />
					<span>IOC Nghi ngờ (TLP:AMBER)</span>
				</div>
				<div className="flex items-center gap-2">
					<span className="w-3.5 h-3.5 rounded-full bg-slate-900 border border-red-500 filter drop-shadow-[0_0_4px_rgba(239,68,68,0.4)]" />
					<span>IOC Độc hại (TLP:RED)</span>
				</div>
				<div className="flex items-center gap-2">
					<span className="w-3.5 h-3.5 rounded-full bg-slate-900 border border-red-600 filter drop-shadow-[0_0_6px_rgba(239,68,68,0.6)]" />
					<span>Sự cố liên quan khác</span>
				</div>
			</div>
		</div>
	);
}
