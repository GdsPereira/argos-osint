export type DataSource = 'apify' | 'own' | 'discovery' | 'insta';

export interface AnalyzeRequest {
  source: DataSource;
  username: string;
  max_posts: number;
  token?: string;
  my_ig_id?: string;
  with_comments: boolean;
  comments_per_post: number;
  with_insights: boolean;
  login_user?: string;
  password?: string;
  delay: number;
  with_people: boolean;
  people_limit: number;
  with_stories?: boolean;
  with_tagged?: boolean;
  with_highlights?: boolean;
  use_async?: boolean;
}

export interface ConfigResponse {
  env: {
    apify: boolean;
    own: boolean;
    discovery: boolean;
    my_ig_id: boolean;
  };
  apify_config?: {
    actor_main: string;
    actor_comments: string;
    actor_stories: string;
    timeout_secs: number;
  };
  ai_config?: {
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
  };
  database?: {
    status: string;
    dialect: string;
    connected: boolean;
    error?: string;
  };
}

export interface SavedReportSummary {
  id: string;
  job_id?: string | null;
  username: string;
  full_name?: string | null;
  source: string;
  followers: number;
  following: number;
  posts_count: number;
  engagement_rate: number;
  avg_likes: number;
  avg_comments: number;
  total_interactions: number;
  created_at: string;
  updated_at: string;
  has_ai_reports: boolean;
}

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface LogEntry {
  timestamp: string;
  message: string;
  level: 'info' | 'success' | 'warning' | 'error';
}

export interface JobResponse {
  job_id: string;
  status: JobStatus;
  progress: string;
  logs?: LogEntry[];
  created_at: number;
  updated_at: number;
  completed_at?: number | null;
  result?: AnalyzeResponse | any | null;
  error?: string | null;
}

export interface AsyncStartResponse {
  job_id: string;
  status: string;
  progress: string;
  status_url: string;
}

export interface ProfileInfo {
  username: string;
  user_id?: string | number | null;
  nome_completo?: string | null;
  bio?: string;
  link_externo?: string | null;
  seguidores: number;
  seguindo: number;
  posts: number;
  igtv?: number;
  privado: boolean;
  verificado: boolean;
  conta_business: boolean;
  categoria_business?: string | null;
  foto_perfil?: string | null;
  bio_hashtags?: string[];
  bio_mencoes?: string[];
  email?: string | null;
  telefone?: string | null;
  endereco?: any | null;
  perfis_similares?: string[];
  destaques_count?: number;
  links_externos?: string[];
}

export interface AnalysisSummary {
  posts_analisados: number;
  media_curtidas: number | null;
  mediana_curtidas: number | null;
  media_comentarios: number | null;
  taxa_engajamento: number | null;
  posts_por_semana: number | null;
  seguidores_por_seguindo: number;
  total_curtidas: number;
  total_comentarios: number;
  total_interacoes: number;
  curtidas_ocultas: number;
  periodo_dias: number | null;
  melhor_hora: number | null;
  melhor_dia: string | null;
}

export interface PostItem {
  shortcode: string;
  url?: string | null;
  data: string | null;
  tipo?: string | null;
  is_video?: boolean;
  visualizacoes_video?: number | null;
  duracao_video?: number | null;
  curtidas: number;
  comentarios: number;
  interacoes: number;
  taxa_engajamento?: number;
  legenda?: string;
  hashtags?: string[];
  mencoes?: string[];
  marcados?: string[];
  local?: string | null;
  patrocinado?: boolean | null;
  n_midias?: number;
  produto?: string;
  alcance?: number;
  salvos?: number;
  compartilhamentos?: number;
  visualizacoes?: number;
  musica?: string | null;
  artista?: string | null;
  plays_video?: number | null;
  colabs?: string[];
  fixado?: boolean;
  [key: string]: any;
}

export interface TimelinePoint {
  d: string | null;
  curtidas: number;
  comentarios: number;
  interacoes: number;
}

export interface TypeBreakdown {
  tipo: string;
  posts: number;
  curtidas: number;
  comentarios: number;
  interacoes: number;
}

export interface HourBreakdown {
  hora: number;
  posts: number;
  interacoes: number;
}

export interface WeekdayBreakdown {
  dia: string;
  posts: number;
  interacoes: number;
}

export interface CaptionScatterPoint {
  x: number;
  y: number;
}

export interface AnalysisCharts {
  timeline: TimelinePoint[];
  by_type: TypeBreakdown[];
  by_hour: HourBreakdown[];
  by_weekday: WeekdayBreakdown[];
  caption: CaptionScatterPoint[];
}

export interface TagCount {
  item: string;
  usos: number;
}

export interface TagPerformance {
  item: string;
  usos: number;
  media: number;
}

export interface HashtagsData {
  top: TagCount[];
  performance: TagPerformance[];
}

export interface CommentItem {
  shortcode?: string;
  autor?: string;
  texto: string;
  data: string | null;
  curtidas: number;
  sentimento: 'positivo' | 'negativo' | 'neutro';
}

export interface CommentsData {
  total: number;
  items: CommentItem[];
  sentiment: {
    positivo: number;
    neutro: number;
    negativo: number;
  };
  top_authors: TagCount[];
  words: TagCount[];
  emojis: TagCount[];
}

export interface AudienceUser {
  username: string;
  nome?: string;
  full_name?: string;
  privado?: boolean;
  verificado?: boolean;
  is_private?: boolean;
  is_verified?: boolean;
  profile_pic_url?: string;
  [key: string]: any;
}

export interface AudienceData {
  followers: AudienceUser[];
  followees: AudienceUser[];
  not_following_back: string[];
  mutual: string[];
}

export interface StoryItem {
  id?: string;
  shortcode?: string;
  url?: string;
  video_url?: string;
  data?: string;
  tipo?: string;
  is_video?: boolean;
  expira_em?: string;
  visualizacoes?: number;
  mentions?: string[];
  hashtags?: string[];
}

export interface ExtraData {
  ultimos_30_dias?: Record<string, number>;
  erro_insights?: string;
  demografia?: {
    age?: Record<string, number>;
    gender?: Record<string, number>;
    city?: Record<string, number>;
    country?: Record<string, number>;
  };
  stories?: StoryItem[];
  stories_count?: number;
  contato?: {
    email?: string | null;
    telefone?: string | null;
    endereco?: any | null;
    links_externos?: string[];
  };
  perfis_similares?: string[];
  destaques_count?: number;
  tagged_posts?: PostItem[];
  highlights?: HighlightItem[];
  [key: string]: any;
}

export interface HighlightMediaItem {
  id?: string;
  type?: 'video' | 'photo' | string;
  tipo?: string;
  is_video?: boolean;
  media_url?: string;
  video_url?: string;
  thumbnail_url?: string;
  timestamp?: string | number;
  data?: string | number;
  caption?: string;
  legenda?: string;
  link_sticker?: string;
  highlight_id?: string;
  highlight_title?: string;
  [key: string]: any;
}

export interface HighlightItem {
  id?: string;
  title?: string;
  cover?: string;
  coverImageUrl?: string;
  media_count?: number;
  mediaCount?: number;
  url?: string;
  coverFailed?: boolean;
  items?: HighlightMediaItem[];
  [key: string]: any;
}

export interface AnalyzeResponse {
  source: DataSource;
  info: ProfileInfo;
  summary: AnalysisSummary;
  posts: PostItem[];
  top_posts: PostItem[];
  charts: AnalysisCharts;
  hashtags: HashtagsData;
  mentions: TagCount[];
  tagged: TagCount[];
  locations: TagCount[];
  comments: CommentsData;
  audience: AudienceData;
  extra: ExtraData;
}
