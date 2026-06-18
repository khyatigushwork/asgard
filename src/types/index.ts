export type Platform =
  | "REDDIT"
  | "QUORA"
  | "TWITTER"
  | "LINKEDIN"
  | "INDUSTRY_FORUMS"
  | "THOMASNET"
  | "ENGINEERING_STACK"
  | "OTHER";

export type Urgency =
  | "IMMEDIATE"
  | "SHORT_TERM"
  | "MEDIUM_TERM"
  | "LONG_TERM"
  | "UNKNOWN";

export type ProjectSize =
  | "SMALL"
  | "MEDIUM"
  | "LARGE"
  | "ENTERPRISE"
  | "UNKNOWN";

export type CrawlStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface RawPostData {
  externalId: string;
  platform: Platform;
  url: string;
  title?: string;
  content: string;
  author?: string;
  authorUrl?: string;
  subreddit?: string;
  upvotes?: number;
  comments?: number;
  views?: number;
  shares?: number;
  postedAt?: Date;
  rawData?: Record<string, unknown>;
}

export interface AiAnalysisResult {
  lead_id: string;
  platform: Platform;
  url: string;
  author?: string;
  buyer_intent_score: number;
  delfin_fit_score: number;
  confidence: number;
  industry?: string;
  company_type?: string;
  likely_role?: string;
  problem_statement?: string;
  required_solution?: string;
  product_category?: string;
  machine_category?: string;
  service_category?: string;
  project_size: ProjectSize;
  urgency: Urgency;
  customization_level?: string;
  custom_solution_needed: boolean;
  qualified_lead: boolean;
  reasoning: string;
  score_breakdown: {
    b2b_relevance: number;
    customization_requirement: number;
    manufacturing_requirement: number;
    engineering_requirement: number;
    industrial_relevance: number;
    supplier_discovery_need: number;
    potential_project_value: number;
  };
}

export interface LeadWithDetails {
  id: string;
  platform: Platform;
  url: string;
  author?: string | null;
  title?: string | null;
  buyerIntentScore: number;
  delfinFitScore: number;
  confidenceScore: number;
  industry?: string | null;
  companyType?: string | null;
  likelyRole?: string | null;
  problemStatement?: string | null;
  requiredSolution?: string | null;
  productCategory?: string | null;
  machineCategory?: string | null;
  serviceCategory?: string | null;
  urgency: Urgency;
  projectSize: ProjectSize;
  customizationLevel?: string | null;
  customSolutionNeeded: boolean;
  isQualified: boolean;
  isArchived: boolean;
  notes?: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  rawPost?: {
    content: string;
    postedAt?: Date | null;
    upvotes: number;
    comments: number;
  };
  aiAnalysis?: {
    reasoning?: string | null;
    b2bRelevance: number;
    manufacturingReq: number;
    engineeringReq: number;
    industrialRelevance: number;
  };
}

export interface CrawlConfig {
  platform: Platform;
  searchTerms: string[];
  maxResults?: number;
  subreddits?: string[];
  dateFrom?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface LeadFilters {
  platform?: Platform;
  industry?: string;
  minBuyerIntent?: number;
  maxBuyerIntent?: number;
  minDelfinFit?: number;
  maxDelfinFit?: number;
  urgency?: Urgency;
  projectSize?: ProjectSize;
  customSolutionNeeded?: boolean;
  isQualified?: boolean;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface AnalyticsData {
  totalLeads: number;
  qualifiedLeads: number;
  avgBuyerIntent: number;
  avgDelfinFit: number;
  byPlatform: Record<string, number>;
  byIndustry: Record<string, number>;
  byUrgency: Record<string, number>;
  recentTrend: Array<{ date: string; count: number; qualified: number }>;
}
