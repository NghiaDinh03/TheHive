export type Permission =
  | 'accessTheHiveFS'
  | 'manageAction'
  | 'manageAlert'
  | 'manageAnalyse'
  | 'manageAnalyzerTemplate'
  | 'manageCase'
  | 'manageCaseTemplate'
  | 'manageConfig'
  | 'manageCustomField'
  | 'manageObservable'
  | 'manageObservableTemplate'
  | 'manageOrganisation'
  | 'managePage'
  | 'managePattern'
  | 'managePlatform'
  | 'manageProcedure'
  | 'manageProfile'
  | 'manageShare'
  | 'manageTag'
  | 'manageTask'
  | 'manageTaxonomy'
  | 'manageUser';

export type PermissionAwareUser = {
  permissions?: string[];
};

export type PermissionMetadata = {
  label: string;
  description: string;
  group: string;
};

export const PERMISSION_METADATA: Record<Permission, PermissionMetadata> = {
  accessTheHiveFS: { label: 'Access Files', description: 'Allows viewing and downloading file attachments.', group: 'System & Configuration' },
  manageAction: { label: 'Manage Actions', description: 'Allows configuring Cortex actions and responders.', group: 'Integration & Extension' },
  manageAlert: { label: 'Manage Alerts', description: 'Allows creating, editing, deleting, importing, and merging alerts.', group: 'Core Operations' },
  manageAnalyse: { label: 'Run Analysis', description: 'Allows triggering analyzers on observables.', group: 'Core Operations' },
  manageAnalyzerTemplate: { label: 'Manage Analyzer Templates', description: 'Allows creating and editing analysis report templates.', group: 'Integration & Extension' },
  manageCase: { label: 'Manage Cases', description: 'Allows creating, editing, closing, and deleting investigation cases.', group: 'Core Operations' },
  manageCaseTemplate: { label: 'Manage Case Templates', description: 'Allows creating and editing case templates.', group: 'Integration & Extension' },
  manageConfig: { label: 'Manage Configuration', description: 'Allows changing system configuration (UI, integration).', group: 'System & Configuration' },
  manageCustomField: { label: 'Manage Custom Fields', description: 'Allows adding and editing custom field definitions.', group: 'Integration & Extension' },
  manageObservable: { label: 'Manage Observables', description: 'Allows adding, editing, and deleting IOCs/observables.', group: 'Core Operations' },
  manageObservableTemplate: { label: 'Manage Observable Templates', description: 'Allows creating templates for bulk importing observables.', group: 'Integration & Extension' },
  manageOrganisation: { label: 'Manage Organizations', description: 'Allows creating and modifying organizations (tenants).', group: 'Administration' },
  managePage: { label: 'Manage Pages & Dashboards', description: 'Allows editing dashboards and knowledge base pages.', group: 'System & Configuration' },
  managePattern: { label: 'Manage Patterns', description: 'Allows creating and editing MITRE ATT&CK patterns.', group: 'Integration & Extension' },
  managePlatform: { label: 'Platform Administration', description: 'Superadmin privilege, allowing all operations regardless of other permissions.', group: 'Administration' },
  manageProcedure: { label: 'Manage Procedures', description: 'Allows modifying incident response procedures.', group: 'Integration & Extension' },
  manageProfile: { label: 'Manage Profiles', description: 'Allows creating and modifying permission profiles.', group: 'Administration' },
  manageShare: { label: 'Manage Sharing', description: 'Allows sharing cases and alerts with other organizations.', group: 'Core Operations' },
  manageTag: { label: 'Manage Tags', description: 'Allows creating and managing the tag classification system.', group: 'Core Operations' },
  manageTask: { label: 'Manage Tasks', description: 'Allows creating, editing, assigning, and closing tasks in a case.', group: 'Core Operations' },
  manageTaxonomy: { label: 'Manage Taxonomy', description: 'Allows defining and importing taxonomy standards (e.g., MISP).', group: 'Integration & Extension' },
  manageUser: { label: 'Manage Users', description: 'Allows creating, disabling, resetting passwords, and assigning permissions to users.', group: 'Administration' },
};


export const LEGACY_PERMISSIONS: readonly Permission[] = [
  'accessTheHiveFS',
  'manageAction',
  'manageAlert',
  'manageAnalyse',
  'manageAnalyzerTemplate',
  'manageCase',
  'manageCaseTemplate',
  'manageConfig',
  'manageCustomField',
  'manageObservable',
  'manageObservableTemplate',
  'manageOrganisation',
  'managePage',
  'managePattern',
  'managePlatform',
  'manageProcedure',
  'manageProfile',
  'manageShare',
  'manageTag',
  'manageTask',
  'manageTaxonomy',
  'manageUser',
];

export const UI_PERMISSION_MATRIX = {
  caseCreate: ['manageCase'],
  caseUpdate: ['manageCase'],
  caseClose: ['manageCase'],
  caseReopen: ['manageCase'],
  caseLogAppend: ['manageCase'],
  taskCreate: ['manageTask'],
  taskUpdate: ['manageTask'],
  taskAssign: ['manageTask'],
  taskClose: ['manageTask'],
  taskBulk: ['manageTask'],
  taskReorder: ['manageTask'],
  alertUpdate: ['manageAlert'],
  alertImport: ['manageAlert'],
  alertMerge: ['manageAlert'],
  observableCreate: ['manageObservable'],
  observableUpdate: ['manageObservable'],
  observableDelete: ['manageObservable'],
  observableAnalyze: ['manageAnalyse'],
  attachmentUpload: ['accessTheHiveFS'],
  attachmentDownload: ['accessTheHiveFS'],
  caseTemplateManage: ['manageCaseTemplate'],
  caseCustomFieldManage: ['manageCustomField'],
  procedureManage: ['manageProcedure'],
  shareManage: ['manageShare'],
  pageManage: ['managePage'],
  tagManage: ['manageTag'],
  taxonomyManage: ['manageTaxonomy'],
  patternManage: ['managePattern'],
  configManage: ['manageConfig'],
  actionManage: ['manageAction'],
  adminUsers: ['manageUser'],
  adminOrganisations: ['manageOrganisation'],
  adminProfiles: ['manageProfile'],
  adminAudit: ['managePlatform'],
  manageAlert: ['manageAlert'],
  manageAnalyse: ['manageAnalyse'],
} as const satisfies Record<string, readonly Permission[]>;

export type UIAction = keyof typeof UI_PERMISSION_MATRIX;

export function canUse(user: PermissionAwareUser | undefined, action: UIAction): boolean {
  return hasAnyPermission(user, UI_PERMISSION_MATRIX[action]);
}

export function hasAnyPermission(user: PermissionAwareUser | undefined, permissions: readonly string[]): boolean {
  const granted = user?.permissions ?? [];
  return permissions.some((permission) => granted.includes(permission) || granted.includes('managePlatform'));
}
