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
    <div className="custom-field-editor">
      <h4 className="vpad10 text-primary">Custom Fields</h4>
      <table className="table table-striped case-custom-field-table">
        <thead>
          <tr>
            <th style={{ width: 160 }}>Name</th>
            <th style={{ width: 80 }}>Type</th>
            <th>Value</th>
            <th style={{ width: 120 }}></th>
          </tr>
        </thead>
        <tbody>
          {fields.map((cf) => {
            const fieldType = (cf.field_type ?? 'string') as CustomFieldType;
            const isEditing = editingId === (cf.id ?? cf.name);
            return (
              <tr key={cf.id ?? cf.name}>
                <td>
                  <strong>{cf.name}</strong>
                </td>
                <td>
                  <span className="label label-default">{fieldType}</span>
                </td>
                <td>
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
                <td style={{ whiteSpace: 'nowrap' }}>
                  {canWrite && (
                    <>
                      {isEditing ? (
                        <>
                          <button
                            className="btn btn-xs btn-success"
                            onClick={() => saveEdit(cf)}
                            title="Save"
                          >
                            <i className="glyphicon glyphicon-ok" />
                          </button>
                          <button
                            className="btn btn-xs btn-default ml-xxxs"
                            onClick={() => setEditingId(null)}
                            title="Cancel"
                          >
                            <i className="glyphicon glyphicon-remove" />
                          </button>
                        </>
                      ) : (
                        <>
                          {onUpdate && cf.id && (
                            <button
                              className="btn btn-xs btn-default"
                              onClick={() => startEdit(cf)}
                              title="Edit value"
                            >
                              <i className="glyphicon glyphicon-pencil" />
                            </button>
                          )}
                          {cf.id && (
                            <button
                              className="btn btn-xs btn-danger ml-xxxs"
                              onClick={() => onDelete(cf.id!)}
                              title="Delete"
                            >
                              <i className="glyphicon glyphicon-trash" />
                            </button>
                          )}
                        </>
                      )}
                    </>
                  )}
                </td>
              </tr>
            );
          })}
          {!fields.length && (
            <tr>
              <td colSpan={4} className="empty-message">
                No custom fields defined for this case.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {canWrite && (
        <div className="filter-panel" style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={{ flex: '1 1 150px' }}>
            Name
            <input
              className="form-control input-sm"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="Field name"
            />
          </label>
          <label style={{ flex: '0 0 120px' }}>
            Type
            <select
              className="form-control input-sm"
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
          <label style={{ flex: '1 1 200px' }}>
            Value
            <TypedFieldInput type={addType} value={addValue} onChange={setAddValue} />
          </label>
          {addType === 'enum' && (
            <label style={{ flex: '1 1 200px' }}>
              Options (comma-separated)
              <input
                className="form-control input-sm"
                value={addOptions}
                onChange={(e) => setAddOptions(e.target.value)}
                placeholder="opt1, opt2, opt3"
              />
            </label>
          )}
          <button
            className="btn btn-sm btn-primary"
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
        <select className="form-control input-sm" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      );
    case 'number':
      return (
        <input
          type="number"
          className="form-control input-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
        />
      );
    case 'date':
      return (
        <input
          type="date"
          className="form-control input-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'enum':
      if (options && options.length > 0) {
        return (
          <select className="form-control input-sm" value={value} onChange={(e) => onChange(e.target.value)}>
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
          className="form-control input-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Value"
        />
      );
    default:
      return (
        <input
          className="form-control input-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Value"
        />
      );
  }
}

/** Renders the display value for a custom field type */
function TypedFieldValue({ type, value }: { type: CustomFieldType; value: string }) {
  if (!value && value !== '0') return <em className="text-warning">Not Specified</em>;

  switch (type) {
    case 'boolean':
      return value === 'true' ? (
        <span className="text-success">
          <i className="glyphicon glyphicon-ok" /> Yes
        </span>
      ) : (
        <span className="text-muted">
          <i className="glyphicon glyphicon-remove" /> No
        </span>
      );
    case 'number':
      return <span className="mono">{value}</span>;
    case 'date':
      try {
        return <span>{new Date(value).toLocaleDateString()}</span>;
      } catch {
        return <span>{value}</span>;
      }
    case 'enum':
      return <span className="label label-info">{value}</span>;
    default:
      return <span>{value}</span>;
  }
}
