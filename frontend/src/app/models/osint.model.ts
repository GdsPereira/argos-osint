/**
 * Modelos de Dados do Argos OSINT (argos-osint).
 */
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

export interface WebTrackers {
  google_analytics_ua?: string[];
  google_analytics_ga4?: string[];
  google_tag_manager?: string[];
  facebook_pixel?: string[];
  google_adsense?: string[];
  hotjar?: string[];
}

export interface BioResolveResponse {
  original_url: string;
  final_url?: string;
  title?: string;
  total_socials_found?: number;
  socials: DiscoveredSocialLink[];
  other_links: string[];
  trackers?: WebTrackers;
  status: string;
  error?: string;
}

export interface UsernameScanRequest {
  username: string;
  limit_targets?: number;
  categories?: string[];
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

// ==========================================
// Modelos de Domínio, DNS e Subdomínios (crt.sh)
// ==========================================

export interface SslCertSummary {
  valid: boolean;
  subject?: Record<string, string>;
  issuer?: Record<string, string>;
  valid_from?: string;
  valid_until?: string;
  subject_alt_names: string[];
  error?: string;
}

export interface DomainIntelResponse {
  domain: string;
  dns: {
    A?: string[];
    CNAME?: string[];
    MX?: string[];
  };
  ssl_certificate: SslCertSummary;
  status: string;
  error?: string;
}

export interface SubdomainEnumResponse {
  domain: string;
  total_unique: number;
  total_returned: number;
  subdomains: string[];
  status: string;
  error?: string;
}

// ==========================================
// Modelos de E-mail Footprint (Holehe-style)
// ==========================================

export interface EmailFootprintResult {
  service: string;
  category: string;
  exists: boolean;
  url?: string | null;
  indicator: string;
}

export interface EmailFootprintResponse {
  email: string;
  email_hash_md5?: string;
  total_checked: number;
  total_found: number;
  found: EmailFootprintResult[];
  all_results: EmailFootprintResult[];
  error?: string;
}

// ==========================================
// Modelos de Wayback Machine CDX
// ==========================================

export interface ArchiveSnapshotItem {
  timestamp: string;
  formatted_date: string;
  status_code: string;
  archive_url: string;
}

export interface ArchiveLookupResponse {
  url: string;
  total_snapshots: number;
  first_seen?: string | null;
  last_seen?: string | null;
  snapshots: ArchiveSnapshotItem[];
  error?: string;
}

// ==========================================
// Modelos de Grafo de Vínculos (Entity Link Analysis)
// ==========================================

export interface GraphNode {
  id: string;
  label: string;
  type: 'target' | 'social_account' | 'domain' | 'social_link' | 'mention' | 'email' | 'tracker' | 'company' | 'person' | 'breach';
  category: string;
  degree: number;
  bridge?: boolean;
  metadata?: Record<string, any>;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  relationship: string;
  weight: number;
}

export interface EntityGraphData {
  target: string;
  total_nodes: number;
  total_edges: number;
  stats?: {
    total_nodes: number;
    total_edges: number;
    bridge_nodes?: number;
  };
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ==========================================
// Modelos de Dossiê e Avaliação de IA
// ==========================================

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
  entity_graph?: EntityGraphData;
}

export interface ArgosAiAssessmentData {
  executive_summary: string;
  identity_confidence_score: number;
  opsec_risk_level: 'low' | 'medium' | 'high' | 'critical';
  exposed_vectors: string[];
  tlp_classification: 'TLP:CLEAR' | 'TLP:AMBER' | 'TLP:RED';
  pivot_recommendations: string[];
}

export interface ArgosAiAssessmentResponse {
  assessment: ArgosAiAssessmentData;
  meta: Record<string, any>;
}

// ==========================================
// Modelos de Telefone e Omni-Hunter (Maltego)
// ==========================================

export interface PhoneFootprintResponse {
  raw_input: string;
  e164: string;
  formatted: string;
  country: string;
  country_code: string;
  ddd: string;
  region: string;
  line_type: string;
  is_mobile: boolean;
  whatsapp_url: string;
  telegram_url: string;
  channels: EmailFootprintResult[];
  web_mentions: OsintWebResult[];
  total_mentions: number;
  error?: string;
}

export type OmniEntityType = 'email' | 'phone' | 'cnpj' | 'cpf' | 'ip' | 'domain' | 'url' | 'username' | 'entity' | 'unknown';

export interface OmniClassification {
  entity_type: OmniEntityType;
  label: string;
  normalized: string;
  transforms: string[];
  [key: string]: any;
}

export interface QsaPartner {
  nome: string;
  qualificacao: string;
  documento_mascarado?: string;
  faixa_etaria?: string;
  data_entrada?: string;
}

export interface CorporateBrResponse {
  status: string;
  source?: string;
  cnpj: string;
  formatted_cnpj: string;
  razao_social?: string;
  nome_fantasia?: string;
  situacao_cadastral?: string;
  data_inicio_atividade?: string;
  cnae_principal?: string;
  natureza_juridica?: string;
  porte?: string;
  capital_social?: number;
  email?: string | null;
  telefones?: string[];
  endereco?: {
    logradouro?: string;
    numero?: string;
    bairro?: string;
    municipio?: string;
    uf?: string;
    cep?: string;
    full_address?: string;
  };
  qsa: QsaPartner[];
  total_socios?: number;
  error?: string;
}

export interface RdapBrResponse {
  status: string;
  domain: string;
  handle?: string;
  owner_name?: string;
  owner_document?: string;
  owner_cnpj_digits?: string;
  owner_email?: string;
  nameservers?: string[];
  created_at?: string;
  changed_at?: string;
  expires_at?: string;
}

export interface IpThreatHost {
  ip: string;
  ports: number[];
  cpes: string[];
  hostnames: string[];
  tags: string[];
  vulns: string[];
}

export interface IpThreatIntelResponse {
  total_ips_scanned: number;
  hosts: IpThreatHost[];
  total_open_ports: number;
  total_vulns: number;
}

export interface StealerExposure {
  computer_name: string;
  operating_system: string;
  date_compromised: string;
  malware_path: string;
  total_corporate_services: number;
  total_user_services: number;
}

export interface ThreatIntelResponse {
  target: string;
  entity_type: string;
  risk_level: 'CRITICAL' | 'HIGH' | 'LOW';
  stealers_found: number;
  stealers: StealerExposure[];
  breaches_found: number;
  breaches: string[];
}

export interface OsintCaseSummary {
  id: string;
  root_query: string;
  entity_type: string;
  title: string;
  pivots_trail: string[];
  total_nodes: number;
  total_edges: number;
  sha256_hash: string;
  analyst_notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface OmniSearchResponse {
  case_id?: string;
  sha256_hash?: string;
  saved_at?: string;
  analyst_notes?: string | null;
  pivots_trail?: string[];
  query: string;
  target: string;
  entity_type: OmniEntityType;
  entity_label: string;
  classification: OmniClassification;
  transforms_executed: string[];
  email_intelligence?: EmailFootprintResponse | null;
  phone_intelligence?: PhoneFootprintResponse | null;
  corporate_intelligence?: CorporateBrResponse | null;
  rdap_intelligence?: RdapBrResponse | null;
  ip_threat_intelligence?: IpThreatIntelResponse | null;
  threat_intelligence?: ThreatIntelResponse | null;
  digital_footprint?: UsernameScanResponse | null;
  domain_intelligence?: DomainIntelResponse | null;
  subdomains?: SubdomainEnumResponse | null;
  bio_intelligence?: BioResolveResponse | null;
  archive_intelligence?: ArchiveLookupResponse | null;
  web_mentions: OsintWebResult[];
  total_web_mentions: number;
  entity_graph?: EntityGraphData;
}
