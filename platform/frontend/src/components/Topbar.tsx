'use client';

import { useRouter } from 'next/navigation';
import { Bell, LogOut, UserCircle2, Search } from 'lucide-react';

interface TopbarProps {
  user?: { login: string; name?: string };
}

export function Topbar({ user }: TopbarProps) {
  const router = useRouter();
  return (
    <header className="thehive-navbar h-14 flex items-center px-4 justify-between">
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <div className="relative w-full">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60"
            size={16}
          />
          <input
            type="text"
            placeholder="Search… (Phase 7)"
            disabled
            className="w-full bg-white/10 placeholder-white/60 text-white text-sm rounded-sm pl-9 pr-3 py-1.5 border border-white/15 focus:outline-none disabled:cursor-not-allowed"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 text-white text-sm">
        <button
          type="button"
          className="thehive-btn-ghost flex items-center gap-1.5"
          title="Notifications (Phase 7)"
          disabled
        >
          <Bell size={15} />
        </button>
        <span className="hidden md:flex items-center gap-1.5 px-2">
          <UserCircle2 size={18} />
          <span className="font-medium">{user?.login ?? 'unknown'}</span>
        </span>
        <button
          type="button"
          onClick={() => {
            sessionStorage.clear();
            router.push('/login');
          }}
          className="thehive-btn-ghost flex items-center gap-1.5"
        >
          <LogOut size={15} />
          <span>Sign out</span>
        </button>
      </div>
    </header>
  );
}
