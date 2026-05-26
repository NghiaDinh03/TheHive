'use client';

import React, { useState, useEffect } from 'react';
import { Globe, Check } from 'lucide-react';

export default function LanguageSwitcher() {
	const [lang, setLang] = useState<'vi' | 'en'>('vi');
	const [isOpen, setIsOpen] = useState(false);

	useEffect(() => {
		const storedLang = localStorage.getItem('ncs-lang') as 'vi' | 'en';
		if (storedLang === 'en' || storedLang === 'vi') {
			setLang(storedLang);
		}
	}, []);

	const handleLanguageChange = (selected: 'vi' | 'en') => {
		setLang(selected);
		localStorage.setItem('ncs-lang', selected);
		setIsOpen(false);
		// Force reload or trigger event so i18n context updates everywhere!
		window.location.reload();
	};

	return (
		<div className="relative select-none z-40">
			{/* Trigger Button */}
			<button
				onClick={() => setIsOpen(!isOpen)}
				className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 bg-slate-950/40 hover:bg-slate-900/60 text-slate-300 hover:text-white transition duration-200 text-xs"
			>
				<Globe className="w-3.5 h-3.5 text-blue-400" />
				<span>{lang === 'vi' ? 'VI' : 'EN'}</span>
			</button>

			{/* Dropdown Menu (Glassmorphism design) */}
			{isOpen && (
				<>
					{/* Click outside backdrop overlay */}
					<div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsOpen(false)} />
					
					<div className="absolute right-0 mt-1.5 w-32 rounded-lg border border-white/10 bg-slate-950/95 backdrop-blur-md shadow-2xl p-1 z-50 animate-[slide-up_0.15s_ease-out]">
						<button
							onClick={() => handleLanguageChange('vi')}
							className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-[11px] font-semibold transition ${
								lang === 'vi' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
							}`}
						>
							<div className="flex items-center gap-1.5">
								<span>🇻🇳</span>
								<span>Tiếng Việt</span>
							</div>
							{lang === 'vi' && <Check className="w-3.5 h-3.5" />}
						</button>
						
						<button
							onClick={() => handleLanguageChange('en')}
							className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-[11px] font-semibold transition ${
								lang === 'en' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
							}`}
						>
							<div className="flex items-center gap-1.5">
								<span>🇬🇧</span>
								<span>English</span>
							</div>
							{lang === 'en' && <Check className="w-3.5 h-3.5" />}
						</button>
					</div>
				</>
			)}
		</div>
	);
}
