export type PlatformType = 'instagram' | 'youtube' | 'tiktok' | 'reddit' | 'twitter' | 'threads' | 'web';
export type MediaType = 'video' | 'short_video' | 'image' | 'carousel' | 'text' | 'article';
export type SearchMode = 'topic' | 'profile';

export interface UnifiedPost {
  id: string;
  platform: PlatformType;
  url: string;
  author_username: string;
  author_name?: string;
  author_avatar?: string;
  title?: string;
  content: string;
  media_type: MediaType;
  thumbnail_url?: string;
  published_at?: string;
  views: number;
  likes: number;
  comments_count: number;
  shares_count: number;
  saves_count?: number;
  engagement_rate: number;
  sentiment?: 'positive' | 'neutral' | 'negative';
  sentiment_score?: number;
  extra?: Record<string, any>;
}

export interface UnifiedProfile {
  platform: PlatformType;
  username: string;
  full_name?: string;
  bio?: string;
  avatar_url?: string;
  url?: string;
  verified?: boolean;
  followers: number;
  following: number;
  posts_count: number;
  total_views: number;
  avg_engagement_rate: number;
  extra?: Record<string, any>;
}

export interface PlatformSummary {
  platform: PlatformType;
  total_items: number;
  total_views: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  total_interactions: number;
  avg_engagement_rate: number;
  top_post?: UnifiedPost;
  sentiment_distribution: { positive: number; neutral: number; negative: number };
  status: 'success' | 'partial' | 'error';
  error_message?: string;
}

export interface MultiSearchResult {
  id: string;
  db_id?: string;
  search_mode: SearchMode;
  query: string;
  platforms_requested: string[];
  total_items: number;
  total_views: number;
  total_interactions: number;
  avg_engagement_rate: number;
  platform_summaries: Record<string, PlatformSummary>;
  posts: UnifiedPost[];
  profiles: UnifiedProfile[];
  created_at: string;
}

export interface MultiSearchRequest {
  search_mode: SearchMode;
  query: string;
  platforms: string[];
  limit: number;
  token?: string;
}

export interface OmnichannelAuditReport {
  omnichannel_score: number;
  score_rationale: string;
  executive_summary: string;
  cross_platform_comparison: Array<{
    platform: string;
    resonance: string;
    audience_sentiment: string;
    key_strength: string;
    main_bottleneck: string;
  }>;
  content_repurpose_ideas: Array<{
    source_platform: string;
    target_platform: string;
    concept: string;
    hook_3s: string;
    cta: string;
  }>;
  strategic_recommendations: string[];
}
