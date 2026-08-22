import { api } from './api';
import type {
  AnalysisRecord,
  AnalysisResult,
  BatchAnalysisResponse,
  ClusterDistributionResponse,
  ClusterProfilesResponse,
  Dashboard,
  FeatureContract,
  FollowUp,
  FollowUpStatus,
  Institution,
  LoginResponse,
  ModelProcessResponse,
  Paginated,
  Priority,
  Role,
  Student,
  StudentFeatures,
  StudentSummary,
  Timeline,
  User,
  UserSummary,
} from '../types/api';

export const authService = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { email, password }, { skipAuthRedirect: true }),

  me: () => api.get<User>('/auth/me'),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<{ changed: boolean }>('/auth/change-password', { currentPassword, newPassword }),

  forgotPassword: (email: string) =>
    api.post<{ requested: boolean; message: string }>(
      '/auth/forgot-password',
      { email },
      { skipAuthRedirect: true },
    ),

  resetPassword: (token: string, newPassword: string) =>
    api.post<{ changed: boolean }>(
      '/auth/reset-password',
      { token, newPassword },
      { skipAuthRedirect: true },
    ),
};

export interface StudentFilters {
  page?: number;
  limit?: number;
  search?: string;
  classification?: string;
  priority?: string;
  institutionId?: string;
  analyzed?: boolean;
  active?: boolean;
  sort?: 'createdAt' | 'name' | 'priority' | 'recentAnalysis';
}

export interface StudentPayload {
  code: string;
  name: string;
  email?: string;
  course?: string;
  enrollmentYear?: number;
  institutionId?: string;
  features?: StudentFeatures;
  active?: boolean;
}

export const studentsService = {
  featureContract: (refresh = false) =>
    api.get<FeatureContract>('/students/feature-contract', { refresh: refresh || undefined }),

  list: (filters: StudentFilters = {}, signal?: AbortSignal) =>
    api.get<Paginated<StudentSummary>>('/students', { ...filters }, signal),

  get: (id: string, signal?: AbortSignal) => api.get<Student>(`/students/${id}`, undefined, signal),

  create: (payload: StudentPayload) => api.post<Student>('/students', payload),

  update: (id: string, payload: Partial<StudentPayload>) =>
    api.patch<Student>(`/students/${id}`, payload),

  deactivate: (id: string) => api.delete<StudentSummary>(`/students/${id}`),
};

export interface AnalysisFilters {
  page?: number;
  limit?: number;
  studentId?: string;
  classification?: string;
  priority?: string;
  modelVersion?: string;
  institutionId?: string;
  from?: string;
  to?: string;
}

export const analysesService = {
  list: (filters: AnalysisFilters = {}, signal?: AbortSignal) =>
    api.get<Paginated<AnalysisRecord>>('/analyses', { ...filters }, signal),

  get: (id: string) => api.get<AnalysisResult>(`/analyses/${id}`),

  runForStudent: (studentId: string, includeClustering = true) =>
    api.post<AnalysisResult>(`/analyses/student/${studentId}`, { includeClustering }),

  runBatch: (studentIds: string[], includeClustering = true) =>
    api.post<BatchAnalysisResponse>('/analyses/batch', { studentIds, includeClustering }),

  simulate: (features: StudentFeatures, includeClustering = true) =>
    api.post<AnalysisResult>('/analyses/simulate', { features, includeClustering }),
};

export interface FollowUpFilters {
  page?: number;
  limit?: number;
  studentId?: string;
  status?: string;
  priority?: string;
  assignedToId?: string;
  mine?: boolean;
  overdue?: boolean;
}

export interface FollowUpPayload {
  studentId: string;
  analysisId?: string;
  title: string;
  notes?: string;
  priority?: Priority;
  status?: FollowUpStatus;
  assignedToId?: string;
  dueDate?: string;
}

export const followUpsService = {
  list: (filters: FollowUpFilters = {}, signal?: AbortSignal) =>
    api.get<Paginated<FollowUp>>('/follow-ups', { ...filters }, signal),

  get: (id: string) => api.get<FollowUp>(`/follow-ups/${id}`),

  create: (payload: FollowUpPayload) => api.post<FollowUp>('/follow-ups', payload),

  update: (id: string, payload: Partial<Omit<FollowUpPayload, 'studentId'>>) =>
    api.patch<FollowUp>(`/follow-ups/${id}`, payload),
};

export const dashboardService = {
  get: (params: { institutionId?: string; days?: number } = {}, signal?: AbortSignal) =>
    api.get<Dashboard>('/dashboard', { ...params }, signal),

  timeline: (
    params: { institutionId?: string; days?: number; granularity?: 'day' | 'week' | 'month' } = {},
    signal?: AbortSignal,
  ) => api.get<Timeline>('/dashboard/timeline', { ...params }, signal),

  institutions: (signal?: AbortSignal) =>
    api.get<{ institutions: unknown[] }>('/dashboard/institutions', undefined, signal),
};

export const dataMiningService = {
  profiles: (signal?: AbortSignal) =>
    api.get<ClusterProfilesResponse>('/datamining/profiles', undefined, signal),

  model: (signal?: AbortSignal) =>
    api.get<ModelProcessResponse>('/datamining/model', undefined, signal),

  clusterDistribution: (institutionId?: string, signal?: AbortSignal) =>
    api.get<ClusterDistributionResponse>(
      '/datamining/cluster-distribution',
      { institutionId },
      signal,
    ),
};

export interface UserPayload {
  name: string;
  email: string;
  password?: string;
  role: Role;
  institutionId?: string;
  active?: boolean;
}

export const usersService = {
  list: (
    filters: {
      page?: number;
      limit?: number;
      role?: string;
      institutionId?: string;
      active?: boolean;
      search?: string;
    } = {},
    signal?: AbortSignal,
  ) => api.get<Paginated<User>>('/users', { ...filters }, signal),

  get: (id: string) => api.get<User>(`/users/${id}`),

  create: (payload: UserPayload) => api.post<UserSummary>('/users', payload),

  update: (id: string, payload: Partial<UserPayload>) => api.patch<User>(`/users/${id}`, payload),

  resetPassword: (id: string, newPassword: string) =>
    api.post<{ reset: boolean }>(`/users/${id}/password`, { newPassword }),

  deactivate: (id: string) => api.delete<User>(`/users/${id}`),
};

export interface InstitutionPayload {
  name: string;
  city?: string;
  state?: string;
  type?: string;
  email?: string;
  phone?: string;
  active?: boolean;
}

export const institutionsService = {
  list: (
    filters: { page?: number; limit?: number; search?: string; active?: boolean } = {},
    signal?: AbortSignal,
  ) => api.get<Paginated<Institution>>('/institutions', { ...filters }, signal),

  get: (id: string) => api.get<Institution>(`/institutions/${id}`),

  create: (payload: InstitutionPayload) => api.post<Institution>('/institutions', payload),

  update: (id: string, payload: Partial<InstitutionPayload>) =>
    api.patch<Institution>(`/institutions/${id}`, payload),

  deactivate: (id: string) => api.delete<Institution>(`/institutions/${id}`),
};
