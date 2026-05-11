'use client';

/**
 * Admin -> UI Settings.
 * Clones legacy `frontend/app/views/partials/admin/ui-settings.html`.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from '@/components/FaIcon';
import { AdminShell } from '@/components/AdminShell';
import { ApiError, apiFetch } from '@/lib/api';

type UiConfig = {
  hideEmptyCaseButton: boolean;
  force_2fa?: boolean;
};

const DEFAULT: UiConfig = { hideEmptyCaseButton: false, force_2fa: false };

export default function UiSettingsPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<UiConfig>(DEFAULT);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const config = useQuery({
    queryKey: ['admin-ui-config'],
    queryFn: async () => apiFetch<UiConfig>('/api/v1/admin/ui-config'),
  });

  useEffect(() => {
    if (config.data) setDraft({ ...DEFAULT, ...config.data });
  }, [config.data]);

  const save = useMutation({
    mutationFn: (payload: UiConfig) =>
      apiFetch<UiConfig>('/api/v1/admin/ui-config', { method: 'POST', json: payload }),
    onSuccess: async (data) => {
      setDraft(data);
      await queryClient.invalidateQueries({ queryKey: ['admin-ui-config'] });
      setMessage('UI settings saved.');
      setError(null);
    },
    onError: (err) => {
      setMessage(null);
      setError(err instanceof ApiError ? err.problem.detail || err.problem.title : 'Save failed');
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.mutate(draft);
  }

  return (
    <AdminShell title="UI Settings" small="legacy case creation options">
      {message && <div className="admin-alert success">{message}</div>}
      {error && <div className="admin-alert error">{error}</div>}

      <div className="row">
        <div className="col-md-12">
          <form name="settingsForm" className="form-horizontal" onSubmit={submit} noValidate>
            <div className="box box-primary">
              <div className="box-header with-border">
                <h3 className="box-title">UI Settings</h3>
              </div>
              <div className="box-body">
                {config.isLoading ? (
                  <div className="empty-message">Loading UI settings...</div>
                ) : (
                  <>
                    <div className="form-group">
                      <label className="col-md-3 control-label">
                        Hide <em>Empty Case</em> button
                      </label>
                      <div className="col-md-9">
                        <div className="checkbox">
                          <label>
                            <input
                              name="hideEmptyCaseButton"
                              type="checkbox"
                              checked={draft.hideEmptyCaseButton}
                              onChange={(event) => setDraft({ ...draft, hideEmptyCaseButton: event.target.checked })}
                            />{' '}
                            Check this to disallow creating empty cases
                          </label>
                        </div>
                        <span className="help-block">
                          This mirrors TheHive 4 admin setting and hides the scratch-case entry point on the create case page.
                        </span>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="col-md-3 control-label text-danger">
                        Global Security
                      </label>
                      <div className="col-md-9">
                        <div className="checkbox">
                          <label>
                            <input
                              name="force_2fa"
                              type="checkbox"
                              checked={draft.force_2fa || false}
                              onChange={(event) => setDraft({ ...draft, force_2fa: event.target.checked })}
                            />{' '}
                            <strong className="text-danger">Force 2FA for all users</strong>
                          </label>
                        </div>
                        <span className="help-block">
                          If enabled, any user who has not configured 2FA will not be able to log in. Ensure you have enabled 2FA for yourself first before turning this on!
                        </span>
                      </div>
                    </div>
                  </>
                )}

                <div className="mt-s clearfix">
                  <button className="btn btn-primary pull-right" disabled={save.isPending || config.isLoading} type="submit">
                    <Save size={13} /> {save.isPending ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </AdminShell>
  );
}
