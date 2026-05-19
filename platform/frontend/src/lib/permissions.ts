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
  accessTheHiveFS: { label: 'Truy cập Files', description: 'Cho phép xem và tải xuống các tập tin đính kèm (Attachments).', group: 'Hệ thống & Cấu hình' },
  manageAction: { label: 'Quản lý Hành động', description: 'Cho phép cấu hình các Action/Responder của Cortex.', group: 'Tích hợp & Mở rộng' },
  manageAlert: { label: 'Quản lý Cảnh báo', description: 'Cho phép tạo, sửa, xóa, import và hợp nhất Alerts.', group: 'Nghiệp vụ cốt lõi' },
  manageAnalyse: { label: 'Chạy Phân tích (Analyse)', description: 'Cho phép kích hoạt các bộ phân tích (Analyzer) trên Observables.', group: 'Nghiệp vụ cốt lõi' },
  manageAnalyzerTemplate: { label: 'Quản lý Mẫu Phân tích', description: 'Cho phép tạo và chỉnh sửa các mẫu báo cáo phân tích.', group: 'Tích hợp & Mở rộng' },
  manageCase: { label: 'Quản lý Case', description: 'Cho phép tạo, sửa, đóng, và xóa các Investigation Cases.', group: 'Nghiệp vụ cốt lõi' },
  manageCaseTemplate: { label: 'Quản lý Mẫu Case', description: 'Cho phép tạo và sửa các Case Templates (Mẫu kịch bản).', group: 'Tích hợp & Mở rộng' },
  manageConfig: { label: 'Quản lý Cấu hình', description: 'Cho phép thay đổi cấu hình hệ thống (Giao diện, Tích hợp).', group: 'Hệ thống & Cấu hình' },
  manageCustomField: { label: 'Quản lý Custom Field', description: 'Cho phép thêm và chỉnh sửa định nghĩa Custom Fields.', group: 'Tích hợp & Mở rộng' },
  manageObservable: { label: 'Quản lý Observables', description: 'Cho phép thêm, sửa, xóa các IOCs/Observables.', group: 'Nghiệp vụ cốt lõi' },
  manageObservableTemplate: { label: 'Quản lý Mẫu Observable', description: 'Cho phép tạo các mẫu nhập Observables hàng loạt.', group: 'Tích hợp & Mở rộng' },
  manageOrganisation: { label: 'Quản lý Tổ chức', description: 'Cho phép tạo và sửa đổi các Tổ chức (Tenants).', group: 'Quản trị viên' },
  managePage: { label: 'Quản lý Page/Dashboard', description: 'Cho phép chỉnh sửa các trang Dashboard và Knowledge Base.', group: 'Hệ thống & Cấu hình' },
  managePattern: { label: 'Quản lý Pattern', description: 'Cho phép tạo và sửa MITRE ATT&CK Patterns.', group: 'Tích hợp & Mở rộng' },
  managePlatform: { label: 'Quản trị Nền tảng (Platform)', description: 'Quyền cao nhất, cho phép làm TẤT CẢ mọi việc bất chấp quyền khác (Superadmin).', group: 'Quản trị viên' },
  manageProcedure: { label: 'Quản lý Quy trình', description: 'Cho phép sửa đổi quy trình phản ứng sự cố.', group: 'Tích hợp & Mở rộng' },
  manageProfile: { label: 'Quản lý Profile', description: 'Cho phép tạo và sửa đổi các Phân quyền (Profiles).', group: 'Quản trị viên' },
  manageShare: { label: 'Quản lý Chia sẻ (Share)', description: 'Cho phép chia sẻ Case và Alert với tổ chức khác.', group: 'Nghiệp vụ cốt lõi' },
  manageTag: { label: 'Quản lý Tags', description: 'Cho phép tạo và quản lý hệ thống phân loại Tags.', group: 'Nghiệp vụ cốt lõi' },
  manageTask: { label: 'Quản lý Tasks', description: 'Cho phép tạo, sửa, gán và đóng Tasks trong một Case.', group: 'Nghiệp vụ cốt lõi' },
  manageTaxonomy: { label: 'Quản lý Taxonomy', description: 'Cho phép định nghĩa và nhập các chuẩn Taxonomy (vd: MISP).', group: 'Tích hợp & Mở rộng' },
  manageUser: { label: 'Quản lý Người dùng', description: 'Cho phép tạo, khóa, đổi mật khẩu và phân quyền cho Users.', group: 'Quản trị viên' },
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
