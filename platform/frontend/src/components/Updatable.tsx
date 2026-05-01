'use client';

// Updatable input components ported from TheHive 4 AngularJS directives
// at frontend/app/views/directives/updatable-*.html
// Behavior: click value to edit inline, OK/Cancel/Clear buttons matching
// glyphicon ok / remove / erase semantics. onUpdate(newValue) is called
// only when user confirms; onClear sends an empty/null value.

import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';

type Common<T> = {
  value: T;
  onUpdate: (newValue: T) => void | Promise<unknown>;
  onClear?: () => void | Promise<unknown>;
  clearable?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

function EditButtons({ onSubmit, onCancel, onClear, clearable }: {
  onSubmit?: () => void;
  onCancel: () => void;
  onClear?: () => void;
  clearable?: boolean;
}) {
  return (
    <span className="input-group-btn">
      {onSubmit && (
        <button type="submit" className="btn btn-sm btn-default" onClick={onSubmit} title="Save">
          <i className="glyphicon glyphicon-ok text-success" />
        </button>
      )}
      <button type="button" className="btn btn-sm btn-default" onClick={onCancel} title="Cancel">
        <i className="glyphicon glyphicon-remove text-danger" />
      </button>
      {clearable && onClear && (
        <button type="button" className="btn btn-sm btn-default" onClick={onClear} title="Clear">
          <i className="glyphicon glyphicon-erase text-danger" />
        </button>
      )}
    </span>
  );
}

function PencilIcon({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  return (
    <small className={`updatable-input-icon${size === 'lg' ? ' lg' : ''}`}>
      <i className="glyphicon glyphicon-pencil" />
    </small>
  );
}

/** updatable-simple-text: single line text/integer/float */
export function UpdatableSimpleText({
  value, onUpdate, onClear, clearable, disabled, placeholder,
  inputType = 'text', className,
}: Common<string> & { inputType?: 'text' | 'integer' | 'float' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => { setDraft(value ?? ''); }, [value]);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    setEditing(false);
    if (draft !== value) void onUpdate(draft);
  }
  function cancel() { setDraft(value ?? ''); setEditing(false); }
  function clear() { setEditing(false); if (onClear) void onClear(); else void onUpdate(''); }

  if (disabled) return <span className={className}>{value || <em className="text-warning">Not Specified</em>}</span>;
  if (!editing) {
    return (
      <span className={`updatable-input updatable-input-text ${className ?? ''}`}>
        <span className="updatable-input-value-wrapper" onClick={() => setEditing(true)}>
          {value !== '' && value !== null && value !== undefined
            ? <span className="updatable-value">{value}</span>
            : <span className="updatable-value text-warning"><em>Not Specified</em></span>}
          <PencilIcon />
        </span>
      </span>
    );
  }
  return (
    <form className="updatable-input updatable-input-text" onSubmit={submit}>
      <div className="input-group input-group-sm">
        <input
          autoFocus
          type={inputType === 'text' ? 'text' : 'number'}
          step={inputType === 'float' ? '.01' : inputType === 'integer' ? '1' : undefined}
          className="form-control input-sm"
          placeholder={placeholder}
          value={draft}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft(event.target.value)}
          onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => { if (event.key === 'Escape') cancel(); }}
        />
        <EditButtons onSubmit={() => submit()} onCancel={cancel} onClear={clear} clearable={clearable} />
      </div>
    </form>
  );
}

/** updatable-text: multiline markdown */
export function UpdatableText({
  value, onUpdate, onClear, clearable, disabled, placeholder, className,
}: Common<string>) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => { setDraft(value ?? ''); }, [value]);

  function update() { setEditing(false); if (draft !== value) void onUpdate(draft); }
  function cancel() { setDraft(value ?? ''); setEditing(false); }
  function clear() { setEditing(false); if (onClear) void onClear(); else void onUpdate(''); }

  if (disabled) {
    return <div className={`description-pane markdown ${className ?? ''}`}>{value || <em className="text-warning">Not Specified</em>}</div>;
  }
  if (!editing) {
    if (!value) {
      return (
        <span className={`updatable-input updatable-input-text ${className ?? ''}`}>
          <span className="updatable-input-value-wrapper" onClick={() => setEditing(true)}>
            <span className="updatable-value text-warning"><em>Not Specified</em></span>
            <PencilIcon />
          </span>
        </span>
      );
    }
    return (
      <span className={`updatable-input updatable-input-text ${className ?? ''}`}>
        <span className="updatable-input-value-wrapper updatable-input-markdown">
          <small className="updatable-input-icon clickable" onClick={() => setEditing(true)}>
            <i className="glyphicon glyphicon-pencil" />
          </small>
          <div className="markdown" style={{ whiteSpace: 'pre-wrap' }}>{value}</div>
        </span>
      </span>
    );
  }
  return (
    <div className="form-group updatable-input updatable-input-text">
      <textarea
        autoFocus
        className="form-control content-box"
        rows={10}
        placeholder={placeholder}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <div className="mt-xxxs">
        <div className="btn-group btn-group-sm">
          <button type="button" className="btn btn-sm btn-default" onClick={update} title="Save">
            <i className="text-success glyphicon glyphicon-ok" />
          </button>
          <button type="button" className="btn btn-sm btn-default" onClick={cancel} title="Cancel">
            <i className="text-danger glyphicon glyphicon-remove" />
          </button>
          {clearable && (
            <button type="button" className="btn btn-sm btn-default" onClick={clear} title="Clear">
              <i className="text-danger glyphicon glyphicon-erase" />
            </button>
          )}
        </div>
        <a className="pull-right" href="https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet" target="_blank" rel="noreferrer">
          <i className="fa fa-question-circle" /> Markdown Reference
        </a>
      </div>
    </div>
  );
}

/** updatable-tags: list of string tags */
export function UpdatableTags({
  value, onUpdate, onClear, clearable, disabled, placeholder = 'Add labels',
  source, className,
}: Common<string[]> & { source?: (query: string) => Promise<string[]> | string[] }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(value ?? []);
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setDraft(value ?? []); }, [value]);

  function update() { setEditing(false); void onUpdate(draft); }
  function cancel() { setDraft(value ?? []); setEditing(false); }
  function clear() { setEditing(false); if (onClear) void onClear(); else void onUpdate([]); }
  function addCurrent() {
    const v = input.trim();
    if (v && !draft.includes(v)) setDraft((d) => [...d, v]);
    setInput(''); setSuggestions([]);
  }
  function removeAt(index: number) { setDraft((d) => d.filter((_, i) => i !== index)); }
  async function refreshSuggestions(q: string) {
    setInput(q);
    if (!source || q.length < 3) { setSuggestions([]); return; }
    const out = await source(q);
    setSuggestions(out.filter((s) => !draft.includes(s)).slice(0, 8));
  }

  if (disabled) {
    return (
      <span className={`tags-list flexwrap ${className ?? ''}`}>
        {(value ?? []).length === 0
          ? <em className="text-warning">Not Specified</em>
          : (value ?? []).map((t) => <span key={t} className="label label-primary mb-xxxs mr-xxxs">{t}</span>)}
      </span>
    );
  }

  if (!editing) {
    return (
      <span className={`updatable-input updatable-input-tags ${className ?? ''}`}>
        <span
          className={`updatable-input-value-wrapper${(value ?? []).length > 0 ? ' tags-list flexwrap' : ''}`}
          onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 0); }}
        >
          {(!value || value.length === 0) && <span className="updatable-value text-warning"><em>Not Specified</em></span>}
          {(value ?? []).map((t) => <span key={t} className="label label-primary mb-xxxs mr-xxxs">{t}</span>)}
          <PencilIcon size={(value ?? []).length > 0 ? 'lg' : 'sm'} />
        </span>
      </span>
    );
  }

  return (
    <div className="updatable-input updatable-input-tags">
      <div className="form-group">
        <div className="ti-input-sm form-control" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: 4 }}>
          {draft.map((t, i) => (
            <span key={t} className="label label-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {t}
              <button type="button" className="btn btn-icon btn-clear" onClick={() => removeAt(i)} aria-label="remove">
                <i className="fa fa-times text-danger" />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            className="form-control input-sm"
            style={{ flex: 1, minWidth: 80, border: 'none', boxShadow: 'none' }}
            placeholder={placeholder}
            value={input}
            onChange={(event) => void refreshSuggestions(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); addCurrent(); }
              if (event.key === 'Backspace' && !input && draft.length) removeAt(draft.length - 1);
              if (event.key === 'Escape') cancel();
            }}
          />
        </div>
        {suggestions.length > 0 && (
          <ul className="updatable-tags-suggestions">
            {suggestions.map((s) => (
              <li key={s}>
                <button type="button" className="btn btn-sm btn-default" onClick={() => { setDraft((d) => [...d, s]); setInput(''); setSuggestions([]); }}>{s}</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="btn-group btn-group-sm">
        <button type="button" className="btn btn-sm btn-default" onClick={update} title="Save">
          <i className="text-success glyphicon glyphicon-ok" />
        </button>
        <button type="button" className="btn btn-sm btn-default" onClick={cancel} title="Cancel">
          <i className="text-danger glyphicon glyphicon-remove" />
        </button>
        {clearable && (
          <button type="button" className="btn btn-sm btn-default" onClick={clear} title="Clear">
            <i className="text-danger glyphicon glyphicon-erase" />
          </button>
        )}
      </div>
    </div>
  );
}

/** updatable-select: enum picker */
export function UpdatableSelect({
  value, onUpdate, onClear, clearable, disabled, options, className,
}: Common<string> & { options: ReadonlyArray<string | [string, string]> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => { setDraft(value ?? ''); }, [value]);

  function commit(next: string) { setEditing(false); if (next !== value) void onUpdate(next); }
  function cancel() { setDraft(value ?? ''); setEditing(false); }
  function clear() { setEditing(false); if (onClear) void onClear(); else void onUpdate(''); }

  if (disabled) return <span className={className}>{value || <em className="text-warning">Not Specified</em>}</span>;
  if (!editing) {
    return (
      <span className={`updatable-input updatable-input-select ${className ?? ''}`}>
        <span className="updatable-input-value-wrapper" onClick={() => setEditing(true)}>
          {value
            ? <span className="updatable-value">{labelOf(options, value)}</span>
            : <span className="updatable-value text-warning"><em>Not Specified</em></span>}
          <PencilIcon />
        </span>
      </span>
    );
  }
  return (
    <form className="updatable-input updatable-input-select" onSubmit={(event) => { event.preventDefault(); commit(draft); }}>
      <div className="input-group input-group-sm">
        <select
          autoFocus
          className="form-control input-sm"
          value={draft}
          onChange={(event) => { setDraft(event.target.value); commit(event.target.value); }}
        >
          {options.map((option) => {
            const [v, l] = Array.isArray(option) ? option : [option, option];
            return <option key={v} value={v}>{l}</option>;
          })}
        </select>
        <EditButtons onSubmit={() => commit(draft)} onCancel={cancel} onClear={clear} clearable={clearable} />
      </div>
    </form>
  );
}

/** updatable-boolean: True / False picker */
export function UpdatableBoolean({
  value, onUpdate, disabled, trueText = 'True', falseText = 'False', className,
}: Common<boolean | null> & { trueText?: string; falseText?: string }) {
  const [editing, setEditing] = useState(false);
  if (disabled) return <span className={className}>{value === null || value === undefined ? <em className="text-warning">Not Specified</em> : value ? trueText : falseText}</span>;
  if (!editing) {
    return (
      <span className={`updatable-input updatable-input-boolean ${className ?? ''}`}>
        <span className="updatable-input-value-wrapper" onClick={() => setEditing(true)}>
          {value === null || value === undefined
            ? <span className="updatable-value text-warning"><em>Not Specified</em></span>
            : <span className="updatable-value">{value ? trueText : falseText}</span>}
          <PencilIcon />
        </span>
      </span>
    );
  }
  return (
    <span className="updatable-input updatable-input-boolean">
      <div className="input-group input-group-sm">
        <select
          autoFocus
          className="form-control input-sm"
          value={value === null || value === undefined ? '' : value ? 'true' : 'false'}
          onChange={(event) => { const next = event.target.value === 'true'; setEditing(false); void onUpdate(next); }}
        >
          <option value="true">{trueText}</option>
          <option value="false">{falseText}</option>
        </select>
        <EditButtons onCancel={() => setEditing(false)} />
      </div>
    </span>
  );
}

/** updatable-date: ISO date editor with Now toggle */
export function UpdatableDate({
  value, onUpdate, onClear, clearable, disabled, className,
}: Common<string | null>) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(toLocalInput(value));
  const [useNow, setUseNow] = useState(false);
  useEffect(() => { setDraft(toLocalInput(value)); }, [value]);

  function submit() {
    setEditing(false);
    const next = useNow ? new Date().toISOString() : draft ? new Date(draft).toISOString() : '';
    if (next !== value) void onUpdate(next);
  }
  function cancel() { setDraft(toLocalInput(value)); setUseNow(false); setEditing(false); }
  function clear() { setEditing(false); if (onClear) void onClear(); else void onUpdate(''); }

  if (disabled) return <span className={className}>{value ? new Date(value).toLocaleString() : <em className="text-warning">Not Specified</em>}</span>;
  if (!editing) {
    return (
      <span className={`updatable-input updatable-input-date ${className ?? ''}`}>
        <span className="updatable-input-value-wrapper" onClick={() => setEditing(true)}>
          {value
            ? <span className="updatable-value">{new Date(value).toLocaleString()}</span>
            : <span className="updatable-value text-warning"><em>Not Specified</em></span>}
          <PencilIcon />
        </span>
      </span>
    );
  }
  return (
    <form className="updatable-input updatable-input-date" onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <div className="input-group input-group-sm">
        <input
          autoFocus
          type="datetime-local"
          className="form-control input-sm input-datetime"
          value={useNow ? '' : draft}
          onChange={(event) => { setUseNow(false); setDraft(event.target.value); }}
        />
        <span className="input-group-btn">
          <button type="button" className={`btn btn-sm ${useNow ? 'btn-primary' : 'btn-default'}`} onClick={() => setUseNow((v) => !v)}>Now</button>
          <button type="submit" className="btn btn-sm btn-default" title="Save">
            <i className="text-success glyphicon glyphicon-ok" />
          </button>
          <button type="button" className="btn btn-sm btn-default" onClick={cancel} title="Cancel">
            <i className="text-danger glyphicon glyphicon-remove" />
          </button>
          {clearable && (
            <button type="button" className="btn btn-sm btn-default" onClick={clear} title="Clear">
              <i className="text-danger glyphicon glyphicon-erase" />
            </button>
          )}
        </span>
      </div>
    </form>
  );
}

/** updatable-user: assignee picker with async search */
export function UpdatableUser({
  value, onUpdate, onClear, clearable, disabled, blankText = 'Not Assigned', query, className,
}: Common<string> & { blankText?: string; query?: (q: string) => Promise<Array<{ login: string; name: string }>> }) {
  const [editing, setEditing] = useState(false);
  const [filter, setFilter] = useState('');
  const [users, setUsers] = useState<Array<{ login: string; name: string }>>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing || !query) return;
    let cancelled = false;
    void Promise.resolve(query(filter)).then((result) => { if (!cancelled) setUsers(result); });
    return () => { cancelled = true; };
  }, [editing, filter, query]);

  function pick(login: string) { setEditing(false); if (login !== value) void onUpdate(login); }
  function cancel() { setEditing(false); }
  function clear() { setEditing(false); if (onClear) void onClear(); else void onUpdate(''); }

  if (disabled) return <span className={className}>{value || <em className="text-warning">{blankText}</em>}</span>;
  if (!editing) {
    return (
      <span className={`updatable-input updatable-input-user ${className ?? ''}`}>
        <span className="updatable-input-value-wrapper" onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 0); }}>
          {value
            ? <span className="updatable-value">{value}</span>
            : <span className="updatable-value text-warning"><em>{blankText}</em></span>}
          <PencilIcon />
        </span>
      </span>
    );
  }
  return (
    <div className="updatable-input updatable-input-user">
      <div className="input-group input-group-sm">
        <input
          ref={inputRef}
          className="form-control input-sm"
          placeholder="Search user…"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Escape') cancel(); }}
        />
        <EditButtons onCancel={cancel} onClear={clear} clearable={clearable} />
      </div>
      <ul className="updatable-user-suggestions">
        {users.map((user) => (
          <li key={user.login}>
            <button type="button" className="btn btn-sm btn-default" onClick={() => pick(user.login)}>
              {user.login}{user.name ? ` — ${user.name}` : ''}
            </button>
          </li>
        ))}
        {users.length === 0 && <li><em className="text-muted">No matches</em></li>}
      </ul>
    </div>
  );
}

/** updatable-colour: hex colour picker */
export function UpdatableColour({
  value, onUpdate, onClear, clearable, disabled, className,
}: Common<string>) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '#3c8dbc');
  useEffect(() => { setDraft(value || '#3c8dbc'); }, [value]);

  if (disabled) {
    return <span className={`updatable-colour ${className ?? ''}`} style={{ background: value || 'transparent', display: 'inline-block', width: 16, height: 16, border: '1px solid #ccc' }} />;
  }
  if (!editing) {
    return (
      <span className={`updatable-input updatable-input-colour ${className ?? ''}`} onClick={() => setEditing(true)}>
        <span className="updatable-colour" style={{ background: value || 'transparent', display: 'inline-block', width: 16, height: 16, border: '1px solid #ccc', verticalAlign: 'middle', marginRight: 4 }} />
        <span className="updatable-value">{value || <em className="text-warning">Not Specified</em>}</span>
        <PencilIcon />
      </span>
    );
  }
  return (
    <form
      className="updatable-input updatable-input-colour"
      onSubmit={(event) => { event.preventDefault(); setEditing(false); if (draft !== value) void onUpdate(draft); }}
    >
      <div className="input-group input-group-sm">
        <input type="color" className="form-control input-sm" value={draft} onChange={(event) => setDraft(event.target.value)} />
        <EditButtons
          onSubmit={() => { setEditing(false); if (draft !== value) void onUpdate(draft); }}
          onCancel={() => { setDraft(value || '#3c8dbc'); setEditing(false); }}
          onClear={() => { setEditing(false); if (onClear) void onClear(); else void onUpdate(''); }}
          clearable={clearable}
        />
      </div>
    </form>
  );
}

function labelOf(options: ReadonlyArray<string | [string, string]>, value: string): string {
  for (const option of options) {
    if (Array.isArray(option)) { if (option[0] === value) return option[1]; }
    else if (option === value) return option;
  }
  return value;
}

function toLocalInput(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export type UpdatableProps = { children?: ReactNode };
