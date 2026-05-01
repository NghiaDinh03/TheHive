'use client';

// Sharing modal cloned from TheHive 4 legacy
//   frontend/app/views/components/sharing/sharing-modal.html
//   frontend/app/views/components/sharing/sharing-list.html
// Lets the user grant/revoke shares for a case to other organisations with a
// profile, task rule, observable rule, ownership flag and actionRequired flag.

import { useEffect, useState } from 'react';

export type ShareItem = {
  id?: string;
  organisation: string;
  profile: string;
  task_rule: 'all' | 'manual' | 'existingOnly';
  observable_rule: 'all' | 'manual' | 'existingOnly';
  owner?: boolean;
  task_action_required?: boolean;
};

export function SharingModal({
  open, shares, organisations, profiles, onCancel, onSave, pending = false,
}: {
  open: boolean;
  shares: ShareItem[];
  organisations: string[];
  profiles: string[];
  onCancel: () => void;
  onSave: (next: ShareItem[]) => Promise<unknown> | unknown;
  pending?: boolean;
}) {
  const [draft, setDraft] = useState<ShareItem[]>(shares);
  useEffect(() => { setDraft(shares); }, [shares, open]);

  if (!open) return null;
  function patch(index: number, change: Partial<ShareItem>) {
    setDraft((current) => current.map((item, i) => i === index ? { ...item, ...change } : item));
  }
  function remove(index: number) { setDraft((current) => current.filter((_, i) => i !== index)); }
  function add() {
    setDraft((current) => [...current, { organisation: organisations[0] ?? '', profile: profiles[0] ?? '', task_rule: 'all', observable_rule: 'all', owner: false, task_action_required: false }]);
  }

  return (
    <div className="modal-backdrop-th4" role="dialog" aria-modal="true">
      <div className="modal-dialog th4-modal-dialog modal-lg">
        <div className="modal-content th4-modal-content">
          <div className="modal-header bg-primary"><h3 className="modal-title">Share case</h3></div>
          <div className="modal-body">
            <table className="table table-condensed sharing-list-table">
              <thead><tr>
                <th>Organisation</th>
                <th>Profile</th>
                <th>Tasks</th>
                <th>Observables</th>
                <th title="Owner organisation can perform destructive actions">Owner</th>
                <th title="Action required">Action req.</th>
                <th />
              </tr></thead>
              <tbody>
                {draft.map((share, index) => (
                  <tr key={share.id ?? `new-${index}`}>
                    <td>
                      <select className="form-control input-sm" value={share.organisation} onChange={(event) => patch(index, { organisation: event.target.value })}>
                        {organisations.map((org) => <option key={org} value={org}>{org}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="form-control input-sm" value={share.profile} onChange={(event) => patch(index, { profile: event.target.value })}>
                        {profiles.map((profile) => <option key={profile} value={profile}>{profile}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="form-control input-sm" value={share.task_rule} onChange={(event) => patch(index, { task_rule: event.target.value as ShareItem['task_rule'] })}>
                        <option value="all">All tasks</option>
                        <option value="manual">Manual only</option>
                        <option value="existingOnly">Existing only</option>
                      </select>
                    </td>
                    <td>
                      <select className="form-control input-sm" value={share.observable_rule} onChange={(event) => patch(index, { observable_rule: event.target.value as ShareItem['observable_rule'] })}>
                        <option value="all">All observables</option>
                        <option value="manual">Manual only</option>
                        <option value="existingOnly">Existing only</option>
                      </select>
                    </td>
                    <td className="text-center">
                      <input type="checkbox" checked={!!share.owner} onChange={(event) => patch(index, { owner: event.target.checked })} />
                    </td>
                    <td className="text-center">
                      <input type="checkbox" checked={!!share.task_action_required} onChange={(event) => patch(index, { task_action_required: event.target.checked })} />
                    </td>
                    <td>
                      <button type="button" className="btn btn-icon btn-clear" onClick={() => remove(index)} title="Revoke share">
                        <i className="fa fa-times text-danger" />
                      </button>
                    </td>
                  </tr>
                ))}
                {draft.length === 0 && <tr><td colSpan={7}><em className="text-muted">No shares for this case.</em></td></tr>}
              </tbody>
            </table>
            <button type="button" className="btn btn-sm btn-primary" onClick={add}>
              <i className="fa fa-plus" /> Add share
            </button>
          </div>
          <div className="modal-footer text-left">
            <button className="btn btn-default" type="button" onClick={onCancel}>Cancel</button>
            <button className="btn btn-primary pull-right" type="button" disabled={pending} onClick={() => void onSave(draft)}>
              <i className="fa fa-share-square" /> Save shares
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
