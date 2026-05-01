'use client';

// Observable creation modal cloned from TheHive 4 legacy
// frontend/app/views/partials/observables/observable.creation.html and
// frontend/app/views/partials/observables/creation/form.html.
//
// Behaviors preserved:
//   - Type dropdown selecting from observable type registry
//   - File upload mode toggle for `file` type, with zip + password
//   - Bulk vs single multiline textarea
//   - TLP active picker, IOC/Sighted/IgnoreSimilarity icon toggles
//   - Tags input + library button (library shows known tags)
//   - Description textarea
//   - At-least-one between description and tags rule

import { useState } from 'react';
import { Tlp } from './Badges';

export type ObservableCreationPayload = {
  data_type: string;
  data: string;
  message: string;
  tlp: number;
  ioc: boolean;
  sighted: boolean;
  ignore_similarity: boolean;
  tags: string[];
  // file mode
  file?: File | null;
  is_zip?: boolean;
  zip_password?: string;
  // bulk mode (one per line vs single multiline)
  single?: boolean;
};

export function ObservableCreationModal({
  open, types, knownTags, onCancel, onSubmit, pending = false, error,
}: {
  open: boolean;
  types: string[];
  knownTags?: string[];
  onCancel: () => void;
  onSubmit: (payload: ObservableCreationPayload) => Promise<unknown> | unknown;
  pending?: boolean;
  error?: string | null;
}) {
  const [params, setParams] = useState<ObservableCreationPayload>({
    data_type: types[0] ?? 'ip', data: '', message: '', tlp: 2, ioc: false, sighted: false,
    ignore_similarity: false, tags: [], file: null, is_zip: false, zip_password: '', single: false,
  });
  const [step, setStep] = useState<'form' | 'error'>('form');
  const [errorList, setErrorList] = useState<string[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [tagInput, setTagInput] = useState('');

  if (!open) return null;
  const isFile = params.data_type === 'file' || params.data_type === 'attachment';
  const lines = params.data.split('\n').map((line) => line.trim()).filter(Boolean);
  const uniqueLines = Array.from(new Set(lines));

  function patch(change: Partial<ObservableCreationPayload>) { setParams((current) => ({ ...current, ...change })); }
  function addTagFromInput() {
    const value = tagInput.trim();
    if (value && !params.tags.includes(value)) patch({ tags: [...params.tags, value] });
    setTagInput('');
  }
  function removeTag(tag: string) { patch({ tags: params.tags.filter((tagValue) => tagValue !== tag) }); }
  function pickFromLibrary(tag: string) {
    if (!params.tags.includes(tag)) patch({ tags: [...params.tags, tag] });
    setShowLibrary(false);
  }
  async function submit() {
    if (!isFile && !params.data.trim()) { setErrorList(['Value is required.']); setStep('error'); return; }
    if (isFile && !params.file) { setErrorList(['File is required.']); setStep('error'); return; }
    if (!params.tags.length && !params.message.trim()) { setErrorList(['At least one of description or tags is required.']); setStep('error'); return; }
    try { await onSubmit(params); }
    catch (caught) { setErrorList([(caught as Error).message ?? 'Failed to create observable']); setStep('error'); }
  }

  return (
    <div className="modal-backdrop-th4" role="dialog" aria-modal="true">
      <div className="modal-dialog th4-modal-dialog">
        <form className="modal-content form-horizontal th4-modal-content" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <div className="modal-header bg-primary"><h3 className="modal-title">Create new observable(s)</h3></div>
          {step === 'form' && (
            <div className="modal-body">
              {error && <div className="admin-alert error">{error}</div>}
              <div className="form-group">
                <label className="col-md-3 control-label">Type <i className="fa fa-asterisk text-danger" /></label>
                <div className="col-md-9">
                  <select className="form-control input-sm" value={params.data_type} onChange={(event) => patch({ data_type: event.target.value })}>
                    {types.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
              </div>

              {isFile ? (
                <div className="form-group">
                  <label className="col-md-3 control-label">File <i className="fa fa-asterisk text-danger" /></label>
                  <div className="col-md-9">
                    <input type="file" className="form-control" onChange={(event) => patch({ file: event.target.files?.[0] ?? null, data: event.target.files?.[0]?.name ?? '' })} />
                    {params.file && params.file.size === 0 && <div className="mv-xxs p-xxs bg-warning">WARNING: This file seems to be empty</div>}
                    <div className="checkbox"><label>
                      <input type="checkbox" checked={!!params.is_zip} onChange={(event) => patch({ is_zip: event.target.checked })} />
                      &nbsp;The file is a zipped archive
                    </label></div>
                    {params.is_zip && (
                      <input type="text" className="form-control" placeholder="Type archive's password if available"
                        value={params.zip_password ?? ''} onChange={(event) => patch({ zip_password: event.target.value })} />
                    )}
                  </div>
                </div>
              ) : (
                <div className="form-group">
                  <label className="col-md-3 control-label">Value <i className="fa fa-asterisk text-danger" /></label>
                  <div className="col-md-9">
                    <textarea className="form-control" rows={5} placeholder={params.data_type} value={params.data}
                      onChange={(event) => patch({ data: event.target.value })} required />
                    <div className="radio"><label>
                      <input type="radio" checked={!params.single} onChange={() => patch({ single: false })} />
                      One observable per line <span className="ml-xxxs">({uniqueLines.length} unique observable{uniqueLines.length === 1 ? '' : 's'})</span>
                    </label></div>
                    <div className="radio"><label>
                      <input type="radio" checked={!!params.single} onChange={() => patch({ single: true })} />
                      One single multiline observable
                    </label></div>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="col-md-3 control-label">TLP <i className="fa fa-asterisk text-danger" /></label>
                <div className="col-md-9"><Tlp value={params.tlp} format="active" onUpdate={(next) => patch({ tlp: next })} /></div>
              </div>

              <div className="form-group">
                <label className="col-md-3 control-label">Is IOC</label>
                <div className="col-md-9"><a href="#" onClick={(event) => { event.preventDefault(); patch({ ioc: !params.ioc }); }}>
                  <i className={`text-primary fa ${params.ioc ? 'fa-star' : 'fa-star-o'}`} />
                </a></div>
              </div>

              <div className="form-group">
                <label className="col-md-3 control-label">Has been sighted</label>
                <div className="col-md-9"><a href="#" onClick={(event) => { event.preventDefault(); patch({ sighted: !params.sighted }); }}>
                  <i className={`text-primary fa ${params.sighted ? 'fa-toggle-on' : 'fa-toggle-off'}`} />
                </a></div>
              </div>

              <div className="form-group">
                <label className="col-md-3 control-label">Ignore for similarity</label>
                <div className="col-md-9"><a href="#" onClick={(event) => { event.preventDefault(); patch({ ignore_similarity: !params.ignore_similarity }); }}>
                  <i className={`text-primary fa ${params.ignore_similarity ? 'fa-chain-broken' : 'fa-chain'}`} />
                </a></div>
              </div>

              <div className="form-group">
                <label className="col-md-3 control-label">Tags <span><i className="fa fa-asterisk text-danger" /><i className="fa fa-asterisk text-danger" /></span></label>
                <div className="col-md-9">
                  <div className="input-group">
                    <div className="form-control" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: 4, minHeight: 30 }}>
                      {params.tags.map((tag) => (
                        <span key={tag} className="label label-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {tag}
                          <button type="button" className="btn btn-icon btn-clear" onClick={() => removeTag(tag)}><i className="fa fa-times text-danger" /></button>
                        </span>
                      ))}
                      <input className="form-control input-sm" style={{ flex: 1, minWidth: 100, border: 'none', boxShadow: 'none' }}
                        placeholder="Add tags" value={tagInput}
                        onChange={(event) => setTagInput(event.target.value)}
                        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); addTagFromInput(); } }}
                      />
                    </div>
                    <span className="input-group-btn">
                      <button type="button" className="btn btn-block btn-sm btn-primary" onClick={() => setShowLibrary((open) => !open)} title="Add tag from library"><span className="fa fa-plus" /></button>
                    </span>
                  </div>
                  {showLibrary && (
                    <div className="updatable-tags-suggestions" style={{ marginTop: 4 }}>
                      {(knownTags ?? []).filter((tag) => !params.tags.includes(tag)).map((tag) => (
                        <button key={tag} type="button" className="btn btn-sm btn-default" onClick={() => pickFromLibrary(tag)} style={{ margin: 2 }}>{tag}</button>
                      ))}
                      {(!knownTags || knownTags.length === 0) && <em className="text-muted">No tags in library yet.</em>}
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label className="col-sm-3 control-label">Description <span><i className="fa fa-asterisk text-danger" /><i className="fa fa-asterisk text-danger" /></span></label>
                <div className="col-sm-9">
                  <textarea className="form-control" rows={3} placeholder="Observable(s) description" value={params.message}
                    onChange={(event) => patch({ message: event.target.value })} />
                </div>
              </div>

              <p className="clearfix">
                <span className="pull-right"><i className="fa fa-asterisk text-danger" /><i className="fa fa-asterisk text-danger" /> At least, one required field</span>
                <span className="pull-right mr-xxs"><i className="fa fa-asterisk text-danger" /> Required field</span>
              </p>
            </div>
          )}
          {step === 'error' && (
            <div className="modal-body">
              <div className="admin-alert error">
                <h4 className="text-danger">Errors during creation</h4>
                <ul>{errorList.map((line, index) => <li key={index}>{line}</li>)}</ul>
              </div>
            </div>
          )}
          <div className="modal-footer text-left">
            <button className="btn btn-default" type="button" onClick={onCancel}>Cancel</button>
            {step === 'form' && (
              <button className="btn btn-primary pull-right" type="submit" disabled={pending}>
                <i className="fa fa-plus" /> Create observable(s)
              </button>
            )}
            {step === 'error' && (
              <button className="btn btn-default pull-right" type="button" onClick={() => setStep('form')}>Back to form</button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
