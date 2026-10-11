export interface AiServerConfig {
  configured: boolean;
  provider: string;
  model: string;
  fallback_available?: boolean;
  fallback_provider?: string;
  fallback_model?: string;
  providers_available: {
    gemini: boolean;
    openai: boolean;
    openrouter?: boolean;
    custom: boolean;
  };
}

export interface AiRecommendedPost {
  title: string;
  format: string;
  hook: string;
  concept: string;
  cta: string;
}

export interface AiDiagnosisResponse {
  health_score: number;
  executive_summary: string;
  swot: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  content_strategy: {
    format_verdict: string;
    copywriting_and_hooks: string;
    timing_and_cadence: string;
  };
  audience_insights: {
    sentiment_verdict: string;
    key_interests: string[];
    unmet_needs_or_questions: string[];
  };
  recommended_posts: AiRecommendedPost[];
  quick_wins: string[];
  meta?: {
    provider: string;
    model: string;
    focus: string;
    fallback_triggered?: boolean;
    original_provider?: string;
    original_model?: string;
    fallback_reason?: string;
  };
}

export interface AiDiagnosisRequest {
  analysis: any;
  focus?: string;
  token?: string;
  provider?: string;
  model?: string;
  fallback_token?: string;
}

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

export interface AiChatRequest {
  analysis: any;
  messages: { role: string; content: string }[];
  token?: string;
  provider?: string;
  model?: string;
  fallback_token?: string;
}

export interface AiChatResponse {
  reply: string;
  meta?: {
    provider: string;
    model: string;
    fallback_triggered?: boolean;
    original_provider?: string;
    original_model?: string;
    fallback_reason?: string;
  };
}
