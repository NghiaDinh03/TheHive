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
import { Button } from '@/components/ui/button';

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
    <span className="flex items-center gap-1.5 ml-2">
      {onSubmit && (
        <Button type="submit" variant="outline" size="sm" className="h-7 px-3 bg-green-600/20 hover:bg-green-600/40 border-green-600/30 text-green-400 transition-colors shadow-sm gap-1.5" title="Save">
          <i className="fa fa-check" /> Save
        </Button>
      )}
      <Button type="button" variant="outline" size="sm" className="h-7 px-3 bg-slate-700/50 hover:bg-slate-700 border-slate-600/50 text-slate-300 transition-colors shadow-sm gap-1.5" onClick={onCancel} title="Cancel">
        <i className="fa fa-times" /> Cancel
      </Button>
      {clearable && onClear && (
        <Button type="button" variant="outline" size="sm" className="h-7 px-3 bg-red-900/40 hover:bg-red-800/60 border-red-800/50 text-red-400 transition-colors shadow-sm gap-1.5" onClick={onClear} title="Clear">
          <i className="fa fa-eraser" /> Clear
        </Button>
      )}
    </span>
  );
}

function PencilIcon({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  return (
    <i className="fa fa-pencil text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs ml-2" />
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
      <span className={`group inline-flex items-center cursor-pointer hover:bg-slate-800/60 px-2 py-1 -ml-2 rounded transition-colors ${className ?? ''}`} onClick={() => setEditing(true)}>
        {value !== '' && value !== null && value !== undefined
          ? <span className="text-slate-200">{value}</span>
          : <span className="text-yellow-500/80 italic text-sm">Not Specified</span>}
        <PencilIcon />
      </span>
    );
  }
  return (
    <form className={`flex items-center ${className ?? ''}`} onSubmit={submit}>
      <input
        autoFocus
        type={inputType === 'text' ? 'text' : 'number'}
        step={inputType === 'float' ? '.01' : inputType === 'integer' ? '1' : undefined}
        className="flex-1 bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-inner"
        placeholder={placeholder}
        value={draft}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft(event.target.value)}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => { if (event.key === 'Escape') cancel(); }}
      />
      <EditButtons onSubmit={() => submit()} onCancel={cancel} onClear={clear} clearable={clearable} />
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
        <div className={`group inline-flex items-center cursor-pointer hover:bg-slate-800/60 px-2 py-1 -ml-2 rounded transition-colors ${className ?? ''}`} onClick={() => setEditing(true)}>
          <span className="text-yellow-500/80 italic text-sm">Not Specified</span>
          <PencilIcon />
        </div>
      );
    }
    return (
      <div className={`group relative cursor-pointer hover:bg-slate-800/60 px-2 py-2 -ml-2 rounded transition-colors ${className ?? ''}`} onClick={() => setEditing(true)}>
        <div className="absolute top-2 right-2">
          <PencilIcon />
        </div>
        <div className="prose prose-invert max-w-none text-slate-300 text-sm" style={{ whiteSpace: 'pre-wrap' }}>{value}</div>
      </div>
    );
  }
  return (
    <div className={`flex flex-col gap-2 ${className ?? ''}`}>
      <textarea
        autoFocus
        className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-inner font-mono"
        rows={10}
        placeholder={placeholder}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <div className="flex justify-between items-center mt-1">
        <a className="text-xs text-slate-500 hover:text-blue-400 transition-colors flex items-center gap-1" href="https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet" target="_blank" rel="noreferrer">
          <i className="fa fa-question-circle" /> Markdown Reference
        </a>
        <EditButtons onSubmit={update} onCancel={cancel} onClear={clear} clearable={clearable} />
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
      <div className={`group inline-flex flex-wrap items-center gap-1.5 cursor-pointer hover:bg-slate-800/60 px-2 py-1 -ml-2 rounded transition-colors min-h-[30px] ${className ?? ''}`} onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 0); }}>
        {(!value || value.length === 0) && <span className="text-yellow-500/80 italic text-sm">Not Specified</span>}
        {(value ?? []).map((t) => <span key={t} className="px-2 py-0.5 rounded text-[11px] bg-blue-900/40 text-blue-300 font-medium">{t}</span>)}
        <PencilIcon />
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-2 relative ${className ?? ''}`}>
      <div className="flex-1 bg-slate-800 border border-slate-700 rounded-md p-1.5 shadow-inner focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 flex flex-wrap gap-1.5 items-center">
        {draft.map((t, i) => (
          <span key={t} className="px-2 py-0.5 rounded text-[11px] bg-blue-900/40 text-blue-300 font-medium flex items-center gap-1.5">
            {t}
            <button type="button" className="text-blue-300/50 hover:text-red-400" onClick={() => removeAt(i)} aria-label="remove">
              <i className="fa fa-times" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          className="flex-1 min-w-[100px] bg-transparent border-none text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-0 px-1"
          placeholder={placeholder}
          value={input}
          onChange={(event) => void refreshSuggestions(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); addCurrent(); }
            if (event.key === 'Backspace' && !input && draft.length) removeAt(draft.length - 1);
            if (event.key === 'Escape') cancel();
          }}
        />
        {suggestions.length > 0 && (
          <ul className="absolute top-full left-0 mt-1 w-full max-w-sm bg-slate-800 border border-slate-700 rounded-md shadow-xl z-50 overflow-hidden">
            {suggestions.map((s) => (
              <li key={s}>
                <button type="button" className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition-colors" onClick={() => { setDraft((d) => [...d, s]); setInput(''); setSuggestions([]); }}>{s}</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <EditButtons onSubmit={update} onCancel={cancel} onClear={clear} clearable={clearable} />
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
      <span className={`group inline-flex items-center cursor-pointer hover:bg-slate-800/60 px-2 py-1 -ml-2 rounded transition-colors ${className ?? ''}`} onClick={() => setEditing(true)}>
        {value
          ? <span className="text-slate-200">{labelOf(options, value)}</span>
          : <span className="text-yellow-500/80 italic text-sm">Not Specified</span>}
        <PencilIcon />
      </span>
    );
  }
  return (
    <form className={`flex items-center ${className ?? ''}`} onSubmit={(event) => { event.preventDefault(); commit(draft); }}>
      <select
        autoFocus
        className="flex-1 bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-inner"
        value={draft}
        onChange={(event) => { setDraft(event.target.value); commit(event.target.value); }}
      >
        {options.map((option) => {
          const [v, l] = Array.isArray(option) ? option : [option, option];
          return <option key={v} value={v}>{l}</option>;
        })}
      </select>
      <EditButtons onSubmit={() => commit(draft)} onCancel={cancel} onClear={clear} clearable={clearable} />
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
      <span className={`group inline-flex items-center cursor-pointer hover:bg-slate-800/60 px-2 py-1 -ml-2 rounded transition-colors ${className ?? ''}`} onClick={() => setEditing(true)}>
        {value === null || value === undefined
          ? <span className="text-yellow-500/80 italic text-sm">Not Specified</span>
          : <span className={value ? 'text-green-400 font-medium' : 'text-slate-300'}>{value ? trueText : falseText}</span>}
        <PencilIcon />
      </span>
    );
  }
  return (
    <div className={`flex items-center ${className ?? ''}`}>
      <select
        autoFocus
        className="flex-1 bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-inner"
        value={value === null || value === undefined ? '' : value ? 'true' : 'false'}
        onChange={(event) => { const next = event.target.value === 'true'; setEditing(false); void onUpdate(next); }}
      >
        <option value="true">{trueText}</option>
        <option value="false">{falseText}</option>
      </select>
      <EditButtons onCancel={() => setEditing(false)} />
    </div>
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
      <span className={`group inline-flex items-center cursor-pointer hover:bg-slate-800/60 px-2 py-1 -ml-2 rounded transition-colors ${className ?? ''}`} onClick={() => setEditing(true)}>
        {value
          ? <span className="text-slate-200">{new Date(value).toLocaleString()}</span>
          : <span className="text-yellow-500/80 italic text-sm">Not Specified</span>}
        <PencilIcon />
      </span>
    );
  }
  return (
    <form className={`flex items-center ${className ?? ''}`} onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <div className="flex bg-slate-800 border border-slate-700 rounded-md focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 shadow-inner overflow-hidden">
        <input
          autoFocus
          type="datetime-local"
          className="bg-transparent border-none px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-0"
          value={useNow ? '' : draft}
          onChange={(event) => { setUseNow(false); setDraft(event.target.value); }}
        />
        <button type="button" className={`px-3 py-1.5 text-xs font-medium border-l border-slate-700 transition-colors ${useNow ? 'bg-blue-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200'}`} onClick={() => setUseNow((v) => !v)}>Now</button>
      </div>
      <EditButtons onSubmit={submit} onCancel={cancel} onClear={clear} clearable={clearable} />
    </form>
  );
}

/** updatable-user: assignee picker with async search */
export function UpdatableUser({
  value, onUpdate, onClear, clearable, disabled, blankText = 'Not Assigned', query, defaultUser, className,
}: Common<string> & { blankText?: string; query?: (q: string) => Promise<Array<{ login: string; name: string }>>; defaultUser?: string }) {
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
  function cancel() { setEditing(false); setFilter(''); }
  function clear() { setEditing(false); setFilter(''); if (onClear) void onClear(); else void onUpdate(''); }

  if (disabled) return <span className={className}>{value || <em className="text-warning">{blankText}</em>}</span>;
  if (!editing) {
    return (
      <span className={`group inline-flex items-center cursor-pointer hover:bg-slate-800/60 px-2 py-1 -ml-2 rounded transition-colors ${className ?? ''}`} onClick={() => { 
        setFilter(!value && defaultUser ? defaultUser : ''); 
        setEditing(true); 
        setTimeout(() => inputRef.current?.focus(), 0); 
      }}>
        {value
          ? <span className="text-slate-200 font-medium"><i className="fa fa-user-circle-o text-slate-500 mr-1.5"></i> {value}</span>
          : <span className="text-yellow-500/80 italic text-sm">{blankText}</span>}
        <PencilIcon />
      </span>
    );
  }
  return (
    <div className={`relative flex items-center ${className ?? ''}`}>
      <input
        ref={inputRef}
        className="flex-1 bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-inner min-w-[200px]"
        placeholder="Search user…"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Escape') cancel(); }}
      />
      <EditButtons onCancel={cancel} onClear={clear} clearable={clearable} />
      
      {editing && (
        <ul className="absolute top-full left-0 mt-1 w-full min-w-[250px] bg-slate-800 border border-slate-700 rounded-md shadow-xl z-50 overflow-hidden max-h-48 overflow-y-auto">
          {users.map((user) => (
            <li key={user.login}>
              <button type="button" className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition-colors border-b border-slate-700/50 last:border-none flex flex-col" onClick={() => pick(user.login)}>
                <span className="font-medium text-slate-200">{user.login}</span>
                {user.name && <span className="text-xs text-slate-500">{user.name}</span>}
              </button>
            </li>
          ))}
          {users.length === 0 && <li className="px-4 py-3 text-sm text-slate-500 italic text-center">No matching users found</li>}
        </ul>
      )}
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
