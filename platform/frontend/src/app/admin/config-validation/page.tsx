'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';

interface ConfigCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
}

interface ConfigValidationResult {
  valid: boolean;
  checks: ConfigCheck[];
  summary: string;
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'pass') {
    return (
      <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    );
  }
  if (status === 'fail') {
    return (
      <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  );
}

export default function ConfigValidationPage() {
  const { data, isLoading, refetch } = useQuery<ConfigValidationResult>({
    queryKey: ['config-validation'],
    queryFn: () => apiFetch('/api/v1/admin/config/validate'),
  });

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Topbar />
        <main className="flex-1 p-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Config Validation</h1>
                <p className="text-sm text-gray-500">Production configuration health checks</p>
              </div>
              <button
                onClick={() => refetch()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                Re-validate
              </button>
            </div>

            {isLoading ? (
              <div className="text-center py-12 text-gray-500">Validating configuration...</div>
            ) : data ? (
              <>
                <div className={`mb-6 p-4 rounded-lg ${data.valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex items-center gap-2">
                    <StatusIcon status={data.valid ? 'pass' : 'fail'} />
                    <span className={`font-medium ${data.valid ? 'text-green-800' : 'text-red-800'}`}>
                      {data.summary}
                    </span>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {data.checks.map((check) => (
                        <tr key={check.name}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <StatusIcon status={check.status} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {check.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {check.message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
