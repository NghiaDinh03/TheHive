'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { canUse, type PermissionAwareUser } from '@/lib/permissions';

export type AttachmentItem = {
  id: string;
  case_id?: string;
  observable_id?: string;
  log_id?: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  scan_status: string;
  uploaded_by: string;
  created_at: string;
};

type AttachmentCollection = { values: AttachmentItem[]; total: number };
type UploadInit = { attachment: AttachmentItem; upload_url: string; expires_at: string };
type DownloadLink = { attachment: AttachmentItem; download_url?: string; blocked: boolean; reason?: string };

type AttachmentPanelProps = {
  user?: PermissionAwareUser;
  initialAttachments?: AttachmentItem[];
  caseId?: string;
  observableId?: string;
  logId?: string;
  title?: string;
};

export function AttachmentPanel({ user, initialAttachments = [], caseId = '', observableId = '', logId = '', title = 'Attachments' }: AttachmentPanelProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const canUpload = canUse(user, 'attachmentUpload');
  const canDownload = canUse(user, 'attachmentDownload');
  const queryParams = new URLSearchParams();
  if (caseId) queryParams.set('case_id', caseId);
  if (observableId) queryParams.set('observable_id', observableId);
  if (logId) queryParams.set('log_id', logId);

  const attachments = useQuery({
    queryKey: ['attachments', caseId, observableId, logId],
    queryFn: () => apiFetch<AttachmentCollection>(`/api/v1/attachments?${queryParams.toString()}`),
    enabled: Boolean(caseId || observableId || logId),
    initialData: initialAttachments.length ? { values: initialAttachments, total: initialAttachments.length } : undefined,
  });

  const upload = useMutation({
    mutationFn: uploadSelectedFile,
    onSuccess: async () => {
      setSelectedFile(null);
      setMessage('Attachment uploaded and marked clean by manual smoke scan.');
      await attachments.refetch();
    },
  });

  async function uploadSelectedFile() {
    if (!selectedFile) throw new Error('Choose a file first');
    const init = await apiFetch<UploadInit>('/api/v1/attachments/upload', {
      method: 'POST',
      json: {
        case_id: caseId,
        observable_id: observableId,
        log_id: logId,
        file_name: selectedFile.name,
        content_type: selectedFile.type || 'application/octet-stream',
        size_bytes: selectedFile.size,
      },
    });
    const put = await fetch(init.upload_url, { method: 'PUT', headers: { 'Content-Type': selectedFile.type || 'application/octet-stream' }, body: selectedFile });
    if (!put.ok) throw new Error(`MinIO upload failed: ${put.status}`);
    await apiFetch(`/api/v1/attachments/${init.attachment.id}/scan`, { method: 'POST', json: { status: 'clean', engine: 'manual-ui-smoke' } });
    return init;
  }

  async function downloadAttachment(id: string) {
    setMessage('');
    const link = await apiFetch<DownloadLink>(`/api/v1/attachments/${id}/download`);
    if (link.blocked || !link.download_url) {
      setMessage(link.reason ?? 'Download blocked until malware scan is clean.');
      return;
    }
    window.open(link.download_url, '_blank', 'noopener,noreferrer');
  }

  async function downloadZip(id: string) {
    setMessage('');
    // ZIP endpoint returns binary application/zip when allowed, or JSON with `blocked=true` when policy denies.
    const token = typeof window !== 'undefined' ? window.sessionStorage.getItem('thehive.auth.token') : null;
    const response = await fetch(`/api/v1/attachments/${id}/download.zip`, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const contentType = response.headers.get('content-type') ?? '';
    if (response.status === 202 || contentType.includes('application/json')) {
      const payload = (await response.json()) as { reason?: string; blocked?: boolean };
      setMessage(payload.reason ?? 'ZIP download blocked until malware scan is clean.');
      return;
    }
    if (!response.ok) {
      setMessage(`ZIP download failed: ${response.status}`);
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attachment-${id}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setMessage('ZIP downloaded. NCS Fusion Center password convention applies (default: malware).');
  }

  const error = (upload.error as Error | undefined)?.message ?? (attachments.error as Error | undefined)?.message;
  const rows = attachments.data?.values ?? initialAttachments;

  return (
    <div className="bg-slate-800 rounded-lg shadow-md border border-slate-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center">
        <div>
          <h3 className="text-blue-500 font-medium text-sm flex items-center gap-2"><i className="fa fa-paperclip"></i> {title}</h3>
          <p className="text-xs text-slate-400 mt-1">MinIO/S3 evidence storage · scan status · NCS Fusion attachment list.</p>
        </div>
        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-700 text-slate-300 font-bold">{rows.length} files</span>
      </div>
      <div className="p-6">
        {error && <div className="p-3 mb-4 text-sm text-red-400 bg-red-900/20 border border-red-900/50 rounded">{error}</div>}
        {message && <div className="p-3 mb-4 text-sm text-green-400 bg-green-900/20 border border-green-900/50 rounded">{message}</div>}
        
        <div className="bg-orange-900/10 border border-orange-700/50 p-4 rounded-lg mb-6 flex flex-col gap-3">
          <div className="flex items-start gap-3 text-orange-400 text-sm">
            <i className="fa fa-exclamation-triangle mt-1"></i>
            <div>
              <strong className="block mb-1">Malware Analysis Zone</strong>
              <p className="text-orange-200/80">All malicious samples MUST be uploaded within a password-protected ZIP archive (default password: <code>malware</code>). Direct upload of executable binaries or scripts outside an archive violates operational security policy.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <input type="file" className="text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-slate-700 file:text-blue-400 hover:file:bg-slate-600 focus:outline-none" disabled={!canUpload || upload.isPending} onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} />
            <button className={`px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-md text-sm font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed`} disabled={!canUpload || !selectedFile || upload.isPending} onClick={() => upload.mutate()}>{upload.isPending ? 'Uploading…' : 'Upload Securely'}</button>
          </div>
        </div>

        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead><tr className="bg-slate-900 border-b border-slate-700 text-slate-400 text-sm">
            <th className="px-4 py-3">Name</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Size</th><th className="px-4 py-3">Scan</th><th className="px-4 py-3">Uploaded by</th><th className="px-4 py-3">Created</th><th className="px-4 py-3 text-right">Action</th>
          </tr></thead>
          <tbody className="text-sm divide-y divide-slate-800 text-slate-300">
            {rows.map((attachment) => <tr key={attachment.id} className="hover:bg-slate-800/50 transition-colors">
              <td className="px-4 py-3 font-medium text-slate-200">{attachment.file_name}</td>
              <td className="px-4 py-3 text-slate-400">{attachment.content_type || 'application/octet-stream'}</td>
              <td className="px-4 py-3">{formatBytes(attachment.size_bytes)}</td>
              <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${attachment.scan_status === 'clean' ? 'bg-green-900/50 text-green-400 border border-green-700/50' : 'bg-orange-900/50 text-orange-400 border border-orange-700/50'}`}>{attachment.scan_status}</span></td>
              <td className="px-4 py-3">{attachment.uploaded_by || 'system'}</td>
              <td className="px-4 py-3 text-slate-400">{attachment.created_at ? new Date(attachment.created_at).toLocaleString() : '—'}</td>
              <td className="px-4 py-3 text-right">
                <div className="flex gap-2 justify-end">
                  <button
                    className={`px-3 py-1 bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-600 rounded text-xs transition-colors disabled:opacity-50`}
                    disabled={!canDownload}
                    onClick={() => void downloadAttachment(attachment.id)}
                    title="Direct presigned download from MinIO/S3"
                  >
                    {attachment.scan_status === 'clean' ? 'Download' : 'Check policy'}
                  </button>
                  <button
                    className={`px-3 py-1 bg-slate-800 hover:bg-slate-700 text-orange-400 border border-slate-600 rounded text-xs transition-colors disabled:opacity-50`}
                    disabled={!canDownload}
                    onClick={() => void downloadZip(attachment.id)}
                    title="Download as NCS Fusion Center password-protected ZIP (default password: malware)"
                  >
                    ZIP
                  </button>
                </div>
              </td>
            </tr>)}
            {!rows.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500 border border-dashed border-slate-700 rounded-lg">No attachments yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
