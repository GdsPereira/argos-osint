export type OsintDorkPreset = 'reputation' | 'media_kit' | 'press' | 'transmedia' | 'judicial' | 'custom';

export interface OsintDorkRequest {
  query: string;
  preset: OsintDorkPreset;
  max_results?: number;
  custom_dork?: string;
}

export interface OsintWebResult {
  title: string;
  url: string;
  snippet: string;
  preset: string;
  source_engine: string;
}

export interface OsintDorkResponse {
  query: string;
  preset: string;
  dork_used: string;
  total_found: number;
  results: OsintWebResult[];
}

export interface BioResolveRequest {
  url: string;
}

export interface DiscoveredSocialLink {
  platform: string;
  url: string;
  handle: string;
  source: string;
}

export interface BioResolveResponse {
  original_url: string;
  final_url?: string;
  title?: string;
  total_socials_found?: number;
  socials: DiscoveredSocialLink[];
  other_links: string[];
  status: string;
  error?: string;
}

export interface UsernameScanRequest {
  username: string;
  limit_targets?: number;
}

export interface DiscoveredPlatformAccount {
  platform: string;
  name: string;
  category: string;
  url: string | null;
  exists: boolean;
  status_code: number;
}

export interface UsernameScanResponse {
  username: string;
  total_checked: number;
  total_found: number;
  found: DiscoveredPlatformAccount[];
  all_results: DiscoveredPlatformAccount[];
  error?: string;
}

export interface OsintDossierRequest {
  target: string;
  bio_url?: string;
  include_reputation?: boolean;
  include_press?: boolean;
  include_media_kit?: boolean;
}

export interface OsintDossierResponse {
  target: string;
  bio_intelligence?: BioResolveResponse;
  digital_footprint?: UsernameScanResponse;
  web_mentions: OsintWebResult[];
  total_web_mentions: number;
}
