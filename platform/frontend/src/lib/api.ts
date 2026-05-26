/**
 * Lightweight HTTP client for the backend.
 * Always sends JSON, attaches X-Request-ID, surfaces problem+json errors.
 */

export type ApiProblem = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  request_id?: string;
};

export class ApiError extends Error {
  status: number;
  problem: ApiProblem;
  constructor(problem: ApiProblem) {
    super(`${problem.title}: ${problem.detail ?? ''}`.trim());
    this.status = problem.status;
    this.problem = problem;
  }
}

export interface RequestOptions extends RequestInit {
  json?: unknown;
}

export type ListResponse<T> = T[] | { values?: T[]; items?: T[]; data?: T[]; total?: number };

export function normalizeList<T>(payload: ListResponse<T> | null | undefined): T[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return payload.values ?? payload.items ?? payload.data ?? [];
}

export function getStoredAuth() {
  if (typeof window === 'undefined') return { token: '', login: '' };
  const token =
    sessionStorage.getItem('thehive.token') ||
    localStorage.getItem('thehive.token') ||
    localStorage.getItem('token') ||
    '';
  const login = sessionStorage.getItem('thehive.login') || localStorage.getItem('thehive.login') || '';
  return { token, login };
}

export async function apiFetch<T = unknown>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const headers = new Headers(opts.headers);
  headers.set('Accept', 'application/json');

  let body = opts.body;
  if (opts.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(opts.json);
  }

  const reqId = crypto.randomUUID();
  headers.set('X-Request-ID', reqId);
  if (!headers.has('Authorization') && typeof window !== 'undefined') {
    const { token } = getStoredAuth();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(path, { credentials: 'same-origin', ...opts, headers, body });
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const problem: ApiProblem =
      data && typeof data === 'object' && 'status' in data
        ? (data as ApiProblem)
        : {
            type: 'about:blank',
            title: res.statusText || 'Request failed',
            status: res.status,
            detail: text,
            request_id: reqId,
          };
    throw new ApiError(problem);
  }
  return data as T;
}
