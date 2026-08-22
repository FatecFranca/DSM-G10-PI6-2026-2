export type Role = 'ADMIN' | 'ANALYST' | 'VIEWER';
export type Classification = 'Dropout' | 'Enrolled' | 'Graduate';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
export type FollowUpStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
export type AttentionLevel = 'baixa' | 'média' | 'alta';

export interface ApiErrorBody {
  error: string;
  message: string;
  details?: unknown;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface Paginated<T> {
  data: T[];
  pagination: Pagination;
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: Role;
  institutionId: string | null;
}

export interface User extends UserSummary {
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  institution?: { id: string; name: string; city?: string | null } | null;
}

export interface LoginResponse {
  token: string;
  expiresIn: string;
  user: UserSummary;
}

export interface Institution {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  type: string | null;
  email: string | null;
  phone: string | null;
  active: boolean;
  studentCount?: number;
  userCount?: number;
  analysisCount?: number;
}

export interface FeatureSpec {
  name: string;
  label: string;
  kind: 'numeric' | 'binary' | 'categorical';
  dtype: 'int' | 'float';
  min: number;
  max: number;
  hardMin: number;
  hardMax: number;
  mean: number;
  required: boolean;
}

export interface FeatureContract {
  featureCount: number;
  featureOrder: string[];
  features: FeatureSpec[];
  classes: Classification[];
  modelVersion: string | null;
}

export type StudentFeatures = Record<string, number>;

export interface FeaturesStatus {
  complete: boolean;
  filled: number;
  total: number;
  missing: string[];
}

export interface StudentSummary {
  id: string;
  code: string;
  name: string;
  email: string | null;
  course: string | null;
  enrollmentYear: number | null;
  institutionId: string;
  lastClassification: Classification | null;
  lastConfidence: number | null;
  lastAnalysisAt: string | null;
  lastPriority: Priority | null;
  active: boolean;
  createdAt?: string;
  institution?: { id: string; name: string };
}

export interface Student extends StudentSummary {
  features: StudentFeatures | null;
  featuresStatus: FeaturesStatus | null;
  analyses?: AnalysisRecord[];
  followUps?: FollowUp[];
  createdBy?: { id: string; name: string } | null;
  warnings?: OutOfRangeWarning[];
}

export interface OutOfRangeWarning {
  feature: string;
  label?: string;
  value: number;
  trainedRange: [number, number];
}

export interface Recommendation {
  priority: Priority;
  label: string;
  description: string;
  factors: {
    classification: Classification;
    confidence: number | null;
    confidenceThreshold: number;
    confidentSignal: boolean;
    clusterAttentionLevel: AttentionLevel | null;
    escalatedByCluster: boolean;
  };
}

export interface ClusterProfileSummary {
  size?: number;
  ratio?: number;
  dropoutRatio?: number;
  classDistribution?: Record<string, { count: number; ratio: number }>;
  featureMeans?: Record<string, number>;
}

export interface AnalysisResult {
  id?: string;
  studentId?: string;
  persisted?: boolean;
  analysis: {
    classification: Classification;
    classId: number;
    confidence: number | null;
    probabilities: Record<string, number> | null;
  };
  recommendation: Recommendation;
  cluster:
    | ({
        clusterId: number;
        clusterVersion: string;
        attentionLevel: AttentionLevel | null;
        distance?: number;
        profile?: ClusterProfileSummary;
      })
    | null;
  model: { version: string; algorithm: string };
  student?: { id: string; name: string };
  warnings?: OutOfRangeWarning[];
  disclaimer: string;
  createdAt?: string;
  featuresSnapshot?: StudentFeatures;
}

export interface AnalysisRecord {
  id: string;
  studentId: string;
  classification: Classification;
  confidence: number | null;
  priority: Priority;
  modelVersion: string;
  algorithm: string;
  clusterId: number | null;
  attentionLevel: AttentionLevel | null;
  createdAt: string;
  student?: { id: string; code: string; name: string };
  requestedBy?: { id: string; name: string } | null;
}

export interface BatchAnalysisResponse {
  analyzed: number;
  skipped: { studentId: string; reason: string; details?: unknown }[];
  model: { version: string; algorithm: string };
  results: AnalysisResult[];
  disclaimer: string;
}

export interface FollowUp {
  id: string;
  studentId: string;
  analysisId: string | null;
  title: string;
  notes: string | null;
  status: FollowUpStatus;
  priority: Priority;
  dueDate: string | null;
  resolvedAt: string | null;
  createdAt: string;
  student?: { id: string; code: string; name: string; lastClassification?: Classification | null };
  assignedTo?: { id: string; name: string } | null;
  createdBy?: { id: string; name: string } | null;
  analysis?: {
    id: string;
    classification: Classification;
    confidence: number | null;
    priority: Priority;
    createdAt: string;
  } | null;
}

export interface DistributionItem {
  value: string;
  count: number;
  ratio: number;
}

export interface Distribution {
  total: number;
  items: DistributionItem[];
}

export interface Dashboard {
  scope: { institutionId: string | null; allInstitutions: boolean; periodDays: number };
  overview: {
    totalStudents: number;
    activeStudents: number;
    analyzedStudents: number;
    analysisCoverage: number;
    pendingAnalysis: number;
    totalAnalyses: number;
    analysesInPeriod: number;
  };
  classificationDistribution: Distribution;
  priorityDistribution: Distribution;
  followUps: { byStatus: Distribution; open: number; overdue: number };
  attentionQueue: StudentSummary[];
  recentAnalyses: AnalysisRecord[];
  lastModelUsed: { version: string; algorithm: string; at: string } | null;
  disclaimer: string;
}

export interface TimelinePoint {
  period: string;
  total: number;
  Dropout: number;
  Enrolled: number;
  Graduate: number;
  highPriority: number;
}

export interface Timeline {
  scope: { institutionId: string | null; periodDays: number; granularity: string };
  totalAnalyses: number;
  series: TimelinePoint[];
}

export interface ClusterProfile {
  clusterId: number;
  size: number;
  ratio: number;
  dropoutRatio: number;
  attentionLevel: AttentionLevel;
  classDistribution: Record<string, { count: number; ratio: number }>;
  featureMeans: Record<string, number>;
}

export interface ClusterProfilesResponse {
  clustering: {
    version: string;
    algorithm: string;
    k: number;
    silhouette: number;
    trainedAt: string;
  };
  selectionRationale: string;
  metrics: Record<string, unknown>;
  profileFeatures: string[];
  profiles: ClusterProfile[];
  disclaimer: string;
}

export interface ClusterDistributionResponse {
  clustering: ClusterProfilesResponse['clustering'];
  totalAnalysesWithCluster: number;
  distribution: {
    clusterId: number;
    attentionLevel: AttentionLevel;
    dropoutRatio: number;
    trainingSize: number;
    trainingRatio: number;
    localCount: number;
    localRatio: number;
    featureMeans: Record<string, number>;
  }[];
  disclaimer: string;
}

export interface FeatureImportanceItem {
  feature: string;
  importance: number;
}

export interface ModelProcessResponse {
  model: {
    version: string;
    algorithm: string;
    task: string;
    classes: Classification[];
    trainedAt: string;
    supportsProbability: boolean;
  };
  process: {
    dataUnderstanding: Record<string, unknown>;
    preparation: Record<string, unknown>;
    featureSelection: {
      count: number;
      order: string[];
      importance: FeatureImportanceItem[] | null;
      importanceMethod: string | null;
    };
    modelSelection: {
      candidates: Record<string, unknown>[];
      criteria: Record<string, unknown> | null;
      rationale: string;
    };
    evaluation: {
      test_accuracy: number;
      test_f1_macro: number;
      train_accuracy: number;
      overfit_gap: number;
      cv_folds: number;
      cv_accuracy_mean: number;
      confusion_matrix: { labels: string[]; matrix: number[][] };
      classification_report: Record<string, unknown>;
    };
  };
  environment: Record<string, string>;
  disclaimer: string;
}
