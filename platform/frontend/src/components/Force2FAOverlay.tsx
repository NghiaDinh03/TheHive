'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '@/lib/api';
import { QRCodeSVG } from 'qrcode.react';

type UserProfile = {
  login: string;
  totp_enabled?: boolean;
  force_2fa?: boolean;
  must_change_password?: boolean;
};

export function Force2FAOverlay() {
  const queryClient = useQueryClient();
  const [totpSetupUri, setTotpSetupUri] = useState<string | null>(null);
  const [totpVerifyCode, setTotpVerifyCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<UserProfile>('/api/v1/auth/me'),
    retry: false,
  });

  const setupTotp = useMutation({
    mutationFn: () => apiFetch<{ uri: string }>('/api/v1/auth/totp/setup'),
    onSuccess: (data) => setTotpSetupUri(data.uri),
    onError: (e: any) => setError(e instanceof ApiError ? (e.problem.detail || e.problem.title) : String(e)),
  });

  const verifyTotp = useMutation({
    mutationFn: () => apiFetch('/api/v1/auth/totp/verify', { method: 'POST', json: { code: totpVerifyCode } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (e: any) => setError(e instanceof ApiError ? (e.problem.detail || e.problem.title) : String(e)),
  });

  useEffect(() => {
    // If the user needs to force 2FA, automatically fetch the setup URI if not fetched yet
    if (me.data?.force_2fa && !me.data?.totp_enabled && !me.data?.must_change_password && !totpSetupUri && !setupTotp.isPending && !setupTotp.isError) {
      setupTotp.mutate();
    }
  }, [me.data, totpSetupUri, setupTotp]);

  if (!me.data) return null;
  // If they need to change password first, don't show 2FA modal yet.
  if (me.data.must_change_password) return null;
  // If no force 2FA needed or already enabled, render nothing.
  if (!me.data.force_2fa || me.data.totp_enabled) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-md z-[999999]">
      <div className="bg-gray-900 border border-red-500/50 shadow-2xl rounded-lg w-full max-w-[500px] overflow-hidden pointer-events-auto">
        <div className="bg-red-600 px-4 py-3 flex items-center gap-2 border-b border-red-700">
          <i className="fa fa-shield text-white text-lg"></i>
          <h3 className="text-white font-medium m-0 text-base">Yêu cầu Bảo mật Bắt buộc</h3>
        </div>
        <div className="p-6">
          <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 px-4 py-3 rounded mb-6 text-sm">
            Quản trị viên đã kích hoạt yêu cầu <strong className="text-yellow-400 font-semibold">Bảo mật 2 Bước (2FA)</strong> cho tài khoản của bạn. 
            Bạn bắt buộc phải thiết lập 2FA ngay bây giờ để có thể tiếp tục sử dụng hệ thống.
          </div>
          
          {error && <div className="bg-red-500/10 border border-red-500/30 text-red-500 px-4 py-3 rounded mb-6 text-sm">{error}</div>}

          {!totpSetupUri ? (
            <div className="text-center p-8 text-gray-400">
              {setupTotp.isPending ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>Đang khởi tạo mã QR...</span>
                </div>
              ) : 'Không thể tải mã QR. Vui lòng tải lại trang.'}
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <p className="text-sm text-gray-300 mb-6 text-center">
                1. Sử dụng ứng dụng Google Authenticator hoặc Authy để quét mã QR bên dưới.<br/>
                2. Nhập mã 6 số hiện trên điện thoại vào ô xác nhận.
              </p>
              
              <div className="bg-white p-4 rounded-xl shadow-inner mb-6 inline-block">
                <QRCodeSVG value={totpSetupUri} size={180} level="M" />
              </div>

              <div className="w-full flex gap-3">
                <input
                  type="text"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono text-white focus:outline-none focus:border-red-500 transition-colors"
                  placeholder="------"
                  maxLength={6}
                  value={totpVerifyCode}
                  onChange={(e) => setTotpVerifyCode(e.target.value.replace(/[^0-9]/g, ''))}
                  disabled={verifyTotp.isPending}
                />
                <button 
                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-medium px-6 rounded-lg transition-colors whitespace-nowrap"
                  onClick={() => verifyTotp.mutate()}
                  disabled={totpVerifyCode.length !== 6 || verifyTotp.isPending}
                >
                  {verifyTotp.isPending ? 'Đang xử lý...' : 'Xác nhận & Bật'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
