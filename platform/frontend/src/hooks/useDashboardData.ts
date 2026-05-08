import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface Widget {
  id: string;
  title: string;
  type: string;
  size: number;
  data?: unknown;
  isLoading?: boolean;
  error?: string;
}

export interface Dashboard {
  id: string;
  title: string;
  description: string;
  status: string;
  owner: string;
  organisation: string;
  organisationId: string;
  createdAt: string;
  updatedAt: string;
  widgets: Widget[];
  // E1: Feature flag fields
  featureFlagEnabled: boolean;
  featureFlagName: string;
  featureFlagScope: string;
  featureFlagScopeId: string;
}

export interface DashboardListParams {
  page?: number;
  perPage?: number;
  search?: string;
  status?: string;
  owner?: string;
}

export interface DashboardListResponse {
  data: Dashboard[];
  total: number;
  page: number;
  perPage: number;
}

export function useDashboards(params?: DashboardListParams) {
  return useQuery<DashboardListResponse>({
    queryKey: ['dashboards', params],
    queryFn: () => apiFetch('/api/v1/dashboards'),
  });
}

export function useDashboard(id: string) {
  return useQuery<Dashboard>({
    queryKey: ['dashboard', id],
    queryFn: () => apiFetch(`/api/v1/dashboards/${id}`),
    enabled: !!id,
  });
}

export function useCreateDashboard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Dashboard>) => apiFetch('/api/v1/dashboards', { method: 'POST', json: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboards'] });
    },
  });
}

export function useUpdateDashboard(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Dashboard>) => apiFetch(`/api/v1/dashboards/${id}`, { method: 'PATCH', json: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboards'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', id] });
    },
  });
}

export function useDeleteDashboard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/dashboards/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboards'] });
    },
  });
}

export function useDuplicateDashboard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/dashboards/${id}/duplicate`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboards'] });
    },
  });
}

// E1: Feature flag hooks
export function useFeatureFlags() {
  return useQuery({
    queryKey: ['feature-flags'],
    queryFn: () => apiFetch('/api/v1/feature-flags'),
  });
}

export function useFeatureFlag(name: string) {
  return useQuery({
    queryKey: ['feature-flag', name],
    queryFn: () => apiFetch(`/api/v1/feature-flags/${name}`),
    enabled: !!name,
  });
}

export function useCreateFeatureFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string; enabled: boolean; scope: string; scope_id?: string }) =>
      apiFetch('/api/v1/feature-flags', { method: 'POST', json: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
    },
  });
}

export function useUpdateFeatureFlag(name: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { enabled: boolean }) => apiFetch(`/api/v1/feature-flags/${name}`, { method: 'PATCH', json: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
      queryClient.invalidateQueries({ queryKey: ['feature-flag', name] });
    },
  });
}

export function useDeleteFeatureFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => apiFetch(`/api/v1/feature-flags/${name}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
    },
  });
}
