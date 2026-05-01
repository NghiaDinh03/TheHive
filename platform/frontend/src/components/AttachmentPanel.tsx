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
    setMessage('ZIP downloaded. TheHive 4 password convention applies (default: malware).');
  }

  const error = (upload.error as Error | undefined)?.message ?? (attachments.error as Error | undefined)?.message;
  const rows = attachments.data?.values ?? initialAttachments;

  return (
    <div className="attachment-panel">
      <div className="attachment-panel-header">
        <div>
          <h3 className="detail-section-title">{title}</h3>
          <p>MinIO/S3 evidence storage · scan status · TheHive-style attachment list.</p>
        </div>
        <span className="label label-default">{rows.length} files</span>
      </div>
      {error && <div className="admin-alert error">{error}</div>}
      {message && <div className="admin-alert success">{message}</div>}
      <div className="attachment-dropzone">
        <strong>Upload evidence</strong>
        <span>Presigned upload URL, metadata in PostgreSQL, manual scan-clean placeholder until async scanner lands.</span>
        <input type="file" className="thehive-input" disabled={!canUpload || upload.isPending} onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} />
        <button className="thehive-btn-primary" disabled={!canUpload || !selectedFile || upload.isPending} onClick={() => upload.mutate()}>{upload.isPending ? 'Uploading…' : 'Upload + mark clean'}</button>
      </div>
      <table className="thehive-table mt-3">
        <thead><tr><th>Name</th><th>Type</th><th>Size</th><th>Scan</th><th>Uploaded by</th><th>Created</th><th>Action</th></tr></thead>
        <tbody>
          {rows.map((attachment) => <tr key={attachment.id}>
            <td>{attachment.file_name}</td>
            <td>{attachment.content_type || 'application/octet-stream'}</td>
            <td>{formatBytes(attachment.size_bytes)}</td>
            <td><span className={attachment.scan_status === 'clean' ? 'label label-success' : 'label label-warning'}>{attachment.scan_status}</span></td>
            <td>{attachment.uploaded_by || 'system'}</td>
            <td>{attachment.created_at ? new Date(attachment.created_at).toLocaleString() : '—'}</td>
            <td>
              <button
                className="thehive-btn-secondary"
                disabled={!canDownload}
                onClick={() => void downloadAttachment(attachment.id)}
                title="Direct presigned download from MinIO/S3"
              >
                {attachment.scan_status === 'clean' ? 'Download' : 'Check policy'}
              </button>
              <button
                className="thehive-btn-secondary attachment-zip-btn"
                disabled={!canDownload}
                onClick={() => void downloadZip(attachment.id)}
                title="Download as TheHive 4 password-protected ZIP (default password: malware)"
              >
                ZIP
              </button>
            </td>
          </tr>)}
          {!rows.length && <tr><td colSpan={7} className="thehive-empty">No attachments yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
