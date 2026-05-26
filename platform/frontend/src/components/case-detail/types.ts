export type User = { login: string; name: string; permissions?: string[] };

export type CaseCore = {
  id: string;
  number: number;
  title: string;
  description: string;
  severity: number;
  tlp: number;
  pap: number;
  status: string;
  owner: string;
  assignee: string;
  tags: string[];
  flag?: boolean;
  summary?: string;
  impact_status?: string;
  resolution_status?: string;
  case_template?: string;
  owning_organisation?: string;
  organisation_ids?: string[];
  start_date?: string | null;
  end_date?: string | null;
  created_at: string;
  updated_at: string;
  ai_assessment?: string; // JSON String stored AI report
};

export type Task = {
  id: string;
  title: string;
  description?: string;
  status: string;
  assignee: string;
  group_name: string;
  order_index: number;
  flag?: boolean;
  start_date?: string | null;
  end_date?: string | null;
  due_date?: string | null;
  organisation_ids?: string[];
  created_at: string;
  updated_at: string;
  playbook_name?: string;
  playbook_webhook?: string;
};

export type CaseLog = {
  id: string;
  message: string;
  attachment_id?: string;
  created_by: string;
  created_at: string;
};

export type History = {
  action: string;
  actor_id: string;
  entity_type: string;
  created_at: string;
  before_json?: string;
  after_json?: string;
};

export type Observable = {
  id: string;
  data_type: string;
  data: string;
  full_data?: string;
  data_hash?: string;
  message: string;
  tlp: number;
  ioc: boolean;
  sighted: boolean;
  ignore_similarity?: boolean;
  attachment_id?: string;
  tags: string[];
  malicious_score?: number;
  misp_tags?: string;
  created_by: string;
  created_at: string;
};

export type CaseProcedure = {
  id: string;
  case_id: string;
  description: string;
  pattern_id: string;
  pattern_name: string;
  tactic: string;
  occurred_at?: string | null;
  created_by: string;
  created_at: string;
};

export type CaseShare = {
  id: string;
  case_id: string;
  organisation: string;
  profile: string;
  task_rule: string;
  observable_rule: string;
  owner?: boolean;
  task_action_required?: boolean;
  created_by: string;
  created_at: string;
};

export type CustomField = {
  id?: string;
  name: string;
  value: string;
};

export type RelatedCase = {
  id: string;
  number: number;
  title: string;
  severity: number;
  tlp: number;
  status: string;
  resolution_status?: string;
  start_date?: string;
  end_date?: string;
  tags: string[];
  links_count: number;
  merged_from?: string[];
  linked_observables: {
    id: string;
    data_type: string;
    data: string;
    ioc?: boolean;
    sighted?: boolean;
  }[];
};

export type ResponderAction = {
  id: string;
  responder_id: string;
  responder_name: string;
  status: string;
  object_type: string;
  object_id: string;
  start_date?: string;
  end_date?: string;
  operations?: { message?: string }[];
};

export type CaseAlert = {
  id: string;
  title: string;
  type: string;
  source: string;
  source_ref: string;
  severity: number;
  status: string;
  tags: string[];
  created_at: string;
};

export type CaseDetail = {
  case: CaseCore;
  tasks: Task[];
  logs: CaseLog[];
  attachments: { id: string; file_name: string; size_bytes: number; content_type: string; created_by: string; created_at: string }[];
  custom_fields: CustomField[];
  observables: Observable[];
  procedures: CaseProcedure[];
  shares: CaseShare[];
  history: History[];
  related_cases?: RelatedCase[];
  responder_actions?: ResponderAction[];
  alerts?: CaseAlert[];
};
