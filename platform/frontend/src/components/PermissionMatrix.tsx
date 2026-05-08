'use client';

/**
 * Permission matrix — mirrors TheHive 4 legacy permission/profile views.
 * Shows a matrix of profiles × permissions with check/cross icons.
 * Used in admin profiles page and for visual permission verification.
 */

import { LEGACY_PERMISSIONS, type Permission } from '@/lib/permissions';

type ProfilePermission = {
  profile: string;
  permissions: string[];
};

type PermissionMatrixProps = {
  profiles: ProfilePermission[];
  highlightPermission?: Permission;
  highlightProfile?: string;
};

const PERMISSION_GROUPS: { label: string; permissions: Permission[] }[] = [
  {
    label: 'Case',
    permissions: ['manageCase', 'manageCaseTemplate', 'manageCustomField', 'manageProcedure', 'manageShare'],
  },
  {
    label: 'Alert',
    permissions: ['manageAlert'],
  },
  {
    label: 'Observable',
    permissions: ['manageObservable', 'manageObservableTemplate', 'manageAnalyse'],
  },
  {
    label: 'Task',
    permissions: ['manageTask'],
  },
  {
    label: 'Admin',
    permissions: ['manageUser', 'manageOrganisation', 'manageProfile', 'managePlatform', 'manageConfig'],
  },
  {
    label: 'Integration',
    permissions: ['manageAction', 'manageAnalyzerTemplate', 'manageTag', 'manageTaxonomy', 'managePattern'],
  },
  {
    label: 'Content',
    permissions: ['managePage'],
  },
  {
    label: 'System',
    permissions: ['accessTheHiveFS'],
  },
];

export function PermissionMatrix({ profiles, highlightPermission, highlightProfile }: PermissionMatrixProps) {
  const allPermissions = PERMISSION_GROUPS.flatMap((g) => g.permissions);

  function hasPermission(profile: string, perm: string): boolean {
    const p = profiles.find((pr) => pr.profile === profile);
    return p?.permissions.includes(perm) ?? false;
  }

  return (
    <div className="permission-matrix">
      <table className="table table-condensed table-striped" style={{ fontSize: '0.78rem' }}>
        <thead>
          <tr>
            <th style={{ minWidth: 160 }}>Permission</th>
            {profiles.map((p) => (
              <th
                key={p.profile}
                className="text-center"
                style={{
                  background: highlightProfile === p.profile ? '#e8f4fd' : undefined,
                }}
              >
                {p.profile}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERMISSION_GROUPS.map((group) => (
            <>
              <tr key={`group-${group.label}`}>
                <td
                  colSpan={profiles.length + 1}
                  style={{
                    fontWeight: 700,
                    background: '#f4f4f4',
                    fontSize: '0.82rem',
                    padding: '4px 8px',
                    borderTop: '2px solid #ddd',
                  }}
                >
                  {group.label}
                </td>
              </tr>
              {group.permissions.map((perm) => (
                <tr
                  key={perm}
                  style={{
                    background: highlightPermission === perm ? '#fff3cd' : undefined,
                  }}
                >
                  <td>
                    <code style={{ fontSize: '0.78rem' }}>{perm}</code>
                  </td>
                  {profiles.map((p) => (
                    <td
                      key={`${p.profile}-${perm}`}
                      className="text-center"
                      style={{
                        background: highlightProfile === p.profile ? '#e8f4fd' : undefined,
                      }}
                    >
                      {hasPermission(p.profile, perm) ? (
                        <i className="fa fa-check text-success" title="Granted" />
                      ) : (
                        <i className="fa fa-times text-muted" title="Denied" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Permission checklist — editable version for profile edit forms.
 * Mirrors legacy permission-list.html directive.
 */
export function PermissionChecklist({
  selected,
  onChange,
  disabled = false,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  function toggle(perm: string) {
    if (disabled) return;
    if (selected.includes(perm)) {
      onChange(selected.filter((p) => p !== perm));
    } else {
      onChange([...selected, perm]);
    }
  }

  function selectAll() {
    if (disabled) return;
    onChange([...LEGACY_PERMISSIONS]);
  }

  function clearAll() {
    if (disabled) return;
    onChange([]);
  }

  return (
    <div className="permission-checklist">
      <div style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
        <button type="button" className="btn btn-xs btn-default" onClick={selectAll} disabled={disabled}>
          Select all
        </button>
        <button type="button" className="btn btn-xs btn-default" onClick={clearAll} disabled={disabled}>
          Clear all
        </button>
        <span className="text-muted text-xs" style={{ alignSelf: 'center' }}>
          {selected.length} of {LEGACY_PERMISSIONS.length} selected
        </span>
      </div>
      {PERMISSION_GROUPS.map((group) => (
        <div key={group.label} style={{ marginBottom: 8 }}>
          <strong className="text-sm" style={{ color: '#555' }}>{group.label}</strong>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {group.permissions.map((perm) => (
              <label
                key={perm}
                className="label"
                style={{
                  background: selected.includes(perm) ? '#3c8dbc' : '#e9ecef',
                  color: selected.includes(perm) ? '#fff' : '#333',
                  cursor: disabled ? 'default' : 'pointer',
                  padding: '3px 8px',
                  fontSize: '0.75rem',
                  borderRadius: 3,
                  transition: 'all 0.15s',
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(perm)}
                  onChange={() => toggle(perm)}
                  disabled={disabled}
                  style={{ display: 'none' }}
                />
                {perm}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
