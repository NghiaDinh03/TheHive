'use client';

/**
 * Custom field typed editor — mirrors TheHive 4 legacy custom-fields.html
 * Supports: string, number, boolean, date, enum field types.
 * Each type renders the appropriate updatable input matching legacy directives:
 *   updatable-simple-text.html, updatable-boolean.html, updatable-date.html,
 *   updatable-select.html.
 */

import { useEffect, useState } from 'react';

export type CustomFieldType = 'string' | 'number' | 'boolean' | 'date' | 'enum';

export type CustomFieldDef = {
  id?: string;
  name: string;
  value: string;
  field_type?: string;
  options?: string[];
};

type CustomFieldEditorProps = {
  fields: CustomFieldDef[];
  canWrite: boolean;
  onAdd: (field: { name: string; value: string; field_type: string }) => void;
  onUpdate?: (id: string, value: string) => void;
  onDelete: (id: string) => void;
  pending?: boolean;
};

const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: 'string', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' },
  { value: 'enum', label: 'Enumeration' },
];

export function CustomFieldEditor({ fields, canWrite, onAdd, onUpdate, onDelete, pending }: CustomFieldEditorProps) {
  const [addName, setAddName] = useState('');
  const [addValue, setAddValue] = useState('');
  const [addType, setAddType] = useState<CustomFieldType>('string');
  const [addOptions, setAddOptions] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  function handleAdd() {
    if (!addName.trim()) return;
    onAdd({ name: addName.trim(), value: addValue, field_type: addType });
    setAddName('');
    setAddValue('');
    setAddType('string');
    setAddOptions('');
  }

  function startEdit(field: CustomFieldDef) {
    setEditingId(field.id ?? field.name);
    setEditValue(field.value);
  }

  function saveEdit(field: CustomFieldDef) {
    if (onUpdate && field.id) {
      onUpdate(field.id, editValue);
    }
    setEditingId(null);
  }

  return (
    <div className="mt-8 bg-slate-900/80 rounded-xl shadow-md overflow-hidden">
      <div className="px-6 py-4 bg-slate-800/40 border-b border-slate-700/30 flex justify-between items-center">
        <h4 className="text-blue-400 font-semibold text-base flex items-center gap-2" title="Custom Fields allow you to add arbitrary key-value metadata specific to this incident that are not part of the standard case schema (e.g., specific IP addresses, custom threat scores).">
          <i className="fa fa-list-ul"></i> Custom Fields
        </h4>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead>
            <tr className="bg-slate-800/20 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-700/50">
              <th className="px-6 py-3 w-1/4">Name</th>
              <th className="px-6 py-3 w-32">Type</th>
              <th className="px-6 py-3">Value</th>
              <th className="px-6 py-3 w-32 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-slate-800/50">
            {fields.map((cf) => {
              const fieldType = (cf.field_type ?? 'string') as CustomFieldType;
              const isEditing = editingId === (cf.id ?? cf.name);
              return (
                <tr key={cf.id ?? cf.name} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 text-slate-200 font-medium">
                    {cf.name}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded-md text-[11px] bg-slate-700/60 text-slate-300 uppercase tracking-wider font-medium">{fieldType}</span>
                  </td>
                  <td className="px-6 py-4">
                    {isEditing ? (
                      <TypedFieldInput
                        type={fieldType}
                        value={editValue}
                        onChange={setEditValue}
                        options={cf.options}
                      />
                    ) : (
                      <TypedFieldValue type={fieldType} value={cf.value} />
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {canWrite && (
                      <div className="flex gap-2 justify-end">
                        {isEditing ? (
                          <>
                            <button
                              className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs transition-colors shadow-sm"
                              onClick={() => saveEdit(cf)}
                              title="Save"
                            >
                              <i className="fa fa-check" />
                            </button>
                            <button
                              className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-xs transition-colors shadow-sm"
                              onClick={() => setEditingId(null)}
                              title="Cancel"
                            >
                              <i className="fa fa-times" />
                            </button>
                          </>
                        ) : (
                          <>
                            {onUpdate && cf.id && (
                              <button
                                className="text-slate-400 hover:text-blue-400 transition-colors"
                                onClick={() => startEdit(cf)}
                                title="Edit value"
                              >
                                <i className="fa fa-pencil" />
                              </button>
                            )}
                            {cf.id && (
                              <button
                                className="text-slate-400 hover:text-red-400 transition-colors"
                                onClick={() => onDelete(cf.id!)}
                                title="Delete"
                              >
                                <i className="fa fa-trash" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {!fields.length && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-slate-500 italic">
                  No custom fields defined for this case.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canWrite && (
        <div className="p-6 bg-slate-800/20 border-t border-slate-700/30 flex flex-wrap gap-4 items-end">
          <label className="flex-1 min-w-[150px] flex flex-col gap-1 text-xs text-slate-400">
            Name
            <input
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="Field name"
            />
          </label>
          <label className="w-32 flex flex-col gap-1 text-xs text-slate-400">
            Type
            <select
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              value={addType}
              onChange={(e) => setAddType(e.target.value as CustomFieldType)}
            >
              {FIELD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex-1 min-w-[200px] flex flex-col gap-1 text-xs text-slate-400">
            Value
            <TypedFieldInput type={addType} value={addValue} onChange={setAddValue} />
          </label>
          {addType === 'enum' && (
            <label className="flex-1 min-w-[150px] flex flex-col gap-1 text-xs text-slate-400">
              Options (comma-separated)
              <input
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                value={addOptions}
                onChange={(e) => setAddOptions(e.target.value)}
                placeholder="opt1, opt2"
              />
            </label>
          )}
          <button
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md text-sm font-medium transition-colors shadow-sm h-[38px] flex items-center gap-2"
            disabled={!addName.trim() || !!pending}
            onClick={handleAdd}
          >
            <i className="fa fa-plus" /> Add field
          </button>
        </div>
      )}
    </div>
  );
}

/** Renders the appropriate input widget for a custom field type */
function TypedFieldInput({
  type,
  value,
  onChange,
  options,
}: {
  type: CustomFieldType;
  value: string;
  onChange: (v: string) => void;
  options?: string[];
}) {
  switch (type) {
    case 'boolean':
      return (
        <select className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      );
    case 'number':
      return (
        <input
          type="number"
          className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
        />
      );
    case 'date':
      return (
        <input
          type="date"
          className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'enum':
      if (options && options.length > 0) {
        return (
          <select className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value={value} onChange={(e) => onChange(e.target.value)}>
            <option value="">— Select —</option>
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );
      }
      return (
        <input
          className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Value"
        />
      );
    default:
      return (
        <input
          className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Value"
        />
      );
  }
}

/** Renders the display value for a custom field type */
function TypedFieldValue({ type, value }: { type: CustomFieldType; value: string }) {
  if (!value && value !== '0') return <em className="text-yellow-500">Not Specified</em>;

  switch (type) {
    case 'boolean':
      return value === 'true' ? (
        <span className="text-green-500 font-medium">
          <i className="fa fa-check mr-1" /> Yes
        </span>
      ) : (
        <span className="text-slate-500">
          <i className="fa fa-times mr-1" /> No
        </span>
      );
    case 'number':
      return <span className="font-mono text-slate-300">{value}</span>;
    case 'date':
      try {
        return <span className="text-slate-300">{new Date(value).toLocaleDateString()}</span>;
      } catch {
        return <span className="text-slate-300">{value}</span>;
      }
    case 'enum':
      return <span className="px-2 py-0.5 rounded text-[11px] bg-blue-900/40 text-blue-300 font-medium">{value}</span>;
    default:
      return <span className="text-slate-300">{value}</span>;
  }
}
