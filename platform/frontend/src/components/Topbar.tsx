'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Bell, LogOut, Settings, UserCircle2, ChevronDown } from '@/components/FaIcon';
import { cn } from '@/lib/utils';

interface TopbarProps {
  user?: { login: string; name?: string; avatar?: string };
}

export function Topbar({ user }: TopbarProps) {
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  useEffect(() => {
    if (!user?.login) return;
    const token = sessionStorage.getItem('thehive.token') || '';
    if (!token) return;
    fetch('/api/v1/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((d: { avatar?: string }) => { if (d.avatar) setAvatarUrl(d.avatar); })
      .catch(() => {});
  }, [user?.login]);

  return (
    <header className="glass-topbar h-12 flex items-center justify-between px-4 shrink-0">
      <div />

      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <button
          type="button"
          title="Notifications"
          onClick={() => router.push('/notifications')}
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-lg text-slate-400',
            'hover:text-slate-200 hover:bg-white/8 transition-all duration-150'
          )}
        >
          <Bell size={16} strokeWidth={1.8} />
        </button>

        {/* User menu */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen(v => !v)}
            aria-haspopup="true"
            aria-expanded={dropdownOpen}
            className={cn(
              'flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-all duration-150',
              'text-slate-300 hover:text-white hover:bg-white/8',
              dropdownOpen && 'bg-white/8 text-white'
            )}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                className="w-6 h-6 rounded-full object-cover ring-1 ring-white/20"
              />
            ) : (
              <UserCircle2 size={18} strokeWidth={1.6} className="text-slate-400" />
            )}
            <span className="font-medium text-xs max-w-[120px] truncate">
              {user?.name || user?.login || 'unknown'}
            </span>
            <ChevronDown
              size={12}
              strokeWidth={2}
              className={cn(
                'text-slate-500 transition-transform duration-150',
                dropdownOpen && 'rotate-180'
              )}
            />
          </button>

          {/* Dropdown */}
          {dropdownOpen && (
            <div className={cn(
              'absolute right-0 top-full mt-1.5 w-52 z-50',
              'glass-panel border border-white/10 rounded-xl overflow-hidden',
              'shadow-[0_8px_32px_rgba(0,0,0,0.6)]',
              'anim-slide-up'
            )}>
              {/* Header */}
              <div className="px-4 py-3 border-b border-white/6">
                <p className="text-sm font-semibold text-slate-200 truncate">
                  {user?.name || user?.login}
                </p>
                {user?.name && (
                  <p className="text-xs text-slate-500 truncate mt-0.5">{user.login}</p>
                )}
              </div>

              {/* Items */}
              <div className="py-1">
                <Link
                  href="/personal-settings"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-white/6 transition-colors"
                >
                  <Settings size={14} strokeWidth={1.8} className="text-slate-500" />
                  Personal settings
                </Link>

                <hr className="border-white/6 mx-3 my-1" />

                <button
                  type="button"
                  onClick={() => { sessionStorage.clear(); router.push('/login'); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/8 transition-colors"
                >
                  <LogOut size={14} strokeWidth={1.8} />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
