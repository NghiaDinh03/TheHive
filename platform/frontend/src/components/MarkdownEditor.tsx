'use client';

/**
 * MarkdownEditor component — mirrors legacy TheHive 4 `updatable-text` directive.
 * Provides a textarea for editing markdown with live preview toggle.
 * Legacy reference: frontend/app/views/directives/updatable-text.html
 */

import { useState } from 'react';
import { Edit2, Eye } from '@/components/FaIcon';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  readOnly?: boolean;
  className?: string;
}

export function MarkdownEditor({ value, onChange, placeholder = 'Enter markdown text...', rows = 6, readOnly = false, className = '' }: MarkdownEditorProps) {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');

  return (
    <div className={`markdown-editor ${className}`}>
      {!readOnly && (
        <div className="markdown-editor-toolbar">
          <button
            type="button"
            className={`btn btn-xs ${mode === 'edit' ? 'btn-primary' : 'btn-default'}`}
            onClick={() => setMode('edit')}
          >
            <Edit2 size={11} /> Edit
          </button>
          <button
            type="button"
            className={`btn btn-xs ${mode === 'preview' ? 'btn-primary' : 'btn-default'}`}
            onClick={() => setMode('preview')}
          >
            <Eye size={11} /> Preview
          </button>
        </div>
      )}
      {mode === 'edit' && !readOnly ? (
        <textarea
          className="form-control"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          style={{ resize: 'vertical', fontFamily: "'Roboto Mono', monospace", fontSize: '0.85rem' }}
        />
      ) : (
        <div className="markdown" style={{ padding: '8px 12px', minHeight: `${rows * 1.5}rem`, border: '1px solid #d2d6de', borderRadius: '3px', background: '#fff' }}>
          {value ? (
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0, background: 'none', border: 'none', padding: 0 }}>{value}</pre>
          ) : (
            <span className="text-muted">{placeholder}</span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * MarkdownViewer — read-only markdown display.
 * Mirrors legacy `<div marked="value" class="markdown"></div>`.
 */
export function MarkdownViewer({ value, className = '' }: { value?: string; className?: string }) {
  if (!value) return <span className="text-muted">No content.</span>;
  return (
    <div className={`markdown ${className}`}>
      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0, background: 'none', border: 'none', padding: 0 }}>{value}</pre>
    </div>
  );
}
