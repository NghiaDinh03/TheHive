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
