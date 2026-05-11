'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Bell, LogOut, Settings, UserCircle2 } from '@/components/FaIcon';

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
    fetch('/api/v1/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => {
        if (data.avatar) setAvatarUrl(data.avatar);
      })
      .catch(() => {});
  }, [user?.login]);

  return (
    <header className="ncs-topbar">
      <div className="ncs-topbar-left" />

      <div className="ncs-topbar-right">
        <button
          type="button"
          className="ncs-topbar-btn"
          title="Notifications"
          onClick={() => router.push('/notifications')}
        >
          <Bell size={18} />
        </button>

        <div className="ncs-topbar-user" ref={dropdownRef}>
          <button
            type="button"
            className="ncs-topbar-user-btn"
            onClick={() => setDropdownOpen((v) => !v)}
            aria-haspopup="true"
            aria-expanded={dropdownOpen}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                className="ncs-topbar-avatar"
              />
            ) : (
              <UserCircle2 size={22} />
            )}
            <span className="ncs-topbar-username">{user?.name || user?.login || 'unknown'}</span>
            <span className="ncs-topbar-caret">▾</span>
          </button>

          {dropdownOpen && (
            <div className="ncs-topbar-dropdown">
              <div className="ncs-dropdown-header">
                <div className="ncs-dropdown-name">{user?.name || user?.login}</div>
                {user?.name && <div className="ncs-dropdown-email">{user.login}</div>}
              </div>
              <Link
                href="/personal-settings"
                className="ncs-dropdown-item"
                onClick={() => setDropdownOpen(false)}
              >
                <Settings size={14} />
                Personal settings
              </Link>
              <div className="ncs-dropdown-divider" />
              <button
                type="button"
                onClick={() => {
                  sessionStorage.clear();
                  router.push('/login');
                }}
                className="ncs-dropdown-item ncs-dropdown-logout"
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
