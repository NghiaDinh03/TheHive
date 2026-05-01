'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Bell, LogOut, Settings, UserCircle2 } from '@/components/FaIcon';

interface TopbarProps {
  user?: { login: string; name?: string };
}

export function Topbar({ user }: TopbarProps) {
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  return (
    <header className="thehive-navbar h-[50px] flex items-center px-0 justify-between">
      {/* Left spacer — sidebar toggle placeholder (matches AdminLTE layout) */}
      <div className="flex items-center h-full" />

      {/* Right nav items */}
      <div className="flex items-stretch text-white text-sm h-full">
        <button
          type="button"
          className="thehive-btn-ghost flex items-center gap-1.5 px-4 border-l border-white/10"
          title="Notifications"
          onClick={() => router.push('/notifications')}
        >
          <Bell size={16} />
        </button>

        {/* User dropdown */}
        <div className="relative flex items-stretch" ref={dropdownRef}>
          <button
            type="button"
            className="thehive-btn-ghost flex items-center gap-2 px-4 border-l border-white/10 hover:bg-black/10 transition-colors"
            onClick={() => setDropdownOpen((v) => !v)}
            aria-haspopup="true"
            aria-expanded={dropdownOpen}
          >
            <UserCircle2 size={18} />
            <span className="hidden md:inline font-medium text-[13px]">{user?.name || user?.login || 'unknown'}</span>
            <span className="text-[10px] opacity-60">▾</span>
          </button>

          {dropdownOpen && (
            <div
              className="absolute right-0 top-full mt-0 w-52 bg-white text-gray-800 shadow-lg rounded-b border border-gray-200 z-50"
              style={{ minWidth: 200 }}
            >
              <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
                <div className="font-medium text-sm truncate">{user?.name || user?.login}</div>
                {user?.name && <div className="text-xs text-gray-500 truncate">{user.login}</div>}
              </div>
              <Link
                href="/personal-settings"
                className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                onClick={() => setDropdownOpen(false)}
              >
                <Settings size={14} />
                Personal settings
              </Link>
              <div className="border-t border-gray-100" />
              <button
                type="button"
                onClick={() => {
                  sessionStorage.clear();
                  router.push('/login');
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50 transition-colors text-left"
              >
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
