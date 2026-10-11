import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ApiService } from '../../services/api.service';
import {
  MultiSearchResult,
  MultiSearchRequest,
  PlatformType,
  SearchMode,
  UnifiedPost,
  OmnichannelAuditReport,
} from '../../models/multi-platform.model';

interface PlatformOption {
  id: PlatformType;
  name: string;
  icon: string;
  color: string;
  selected: boolean;
}

@Component({
  selector: 'app-multi-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="multi-search-wrapper">
      <!-- Search Control Card -->
      <div class="search-hero-card">
        <div class="hero-header">
          <div class="hero-title-group">
            <span class="hero-badge">🌐 Social Listening & Multi-Platform Intelligence</span>
            <h2 class="hero-title">Pesquisa Transmídia & Auditoria Cross-Platform</h2>
            <p class="hero-subtitle">
              Colete, monitore e compare métricas em tempo real no <strong>YouTube, Reddit, TikTok, Twitter/X, Threads e Instagram</strong> com inteligência artificial integrada.
            </p>
          </div>

          <div class="hero-actions">
            <button class="btn btn-sm btn-outline history-btn" (click)="openHistoryModal()">
              <span>🕒 Histórico no Banco</span>
              <span class="badge badge-sm" *ngIf="historyList.length > 0">{{ historyList.length }}</span>
            </button>
          </div>
        </div>

        <!-- Search Mode Toggle -->
        <div class="mode-toggle-group">
          <button 
            type="button" 
            class="mode-btn" 
            [class.active]="searchMode === 'topic'"
            (click)="setSearchMode('topic')">
            <span class="mode-icon">🔍</span>
            <div class="mode-text">
              <strong>Social Listening / Palavra-Chave</strong>
              <small>Buscar posts, discussões, vídeos e menções em alta</small>
            </div>
          </button>

          <button 
            type="button" 
            class="mode-btn" 
            [class.active]="searchMode === 'profile'"
            (click)="setSearchMode('profile')">
            <span class="mode-icon">👤</span>
            <div class="mode-text">
              <strong>Análise de Perfil / Criador</strong>
              <small>Investigar contas e canais em múltiplas redes simultaneamente</small>
            </div>
          </button>
        </div>

        <!-- Platform Checkboxes / Pills -->
        <div class="platform-selector-section">
          <div class="selector-header">
            <span class="selector-label">Selecione as Redes para Monitoramento:</span>
            <div class="selector-quick-actions">
              <button type="button" class="btn-link" (click)="selectAllPlatforms(true)">Marcar Todas</button>
              <span class="divider">•</span>
              <button type="button" class="btn-link" (click)="selectAllPlatforms(false)">Desmarcar Todas</button>
            </div>
          </div>

          <div class="platform-chips-grid">
            <label 
              *ngFor="let p of platforms" 
              class="platform-chip" 
              [class.active]="p.selected"
              [style.--chip-accent]="p.color">
              <input 
                type="checkbox" 
                [(ngModel)]="p.selected" 
                class="chip-checkbox">
              <span class="chip-icon">{{ p.icon }}</span>
              <span class="chip-name">{{ p.name }}</span>
            </label>
          </div>
        </div>

        <!-- Search Input Bar -->
        <div class="search-bar-row">
          <div class="search-input-wrap">
            <span class="search-icon-prefix">{{ searchMode === 'profile' ? '👤' : '🔍' }}</span>
            <input 
              type="text" 
              class="search-main-input" 
              [(ngModel)]="searchQuery" 
              [placeholder]="searchMode === 'profile' ? 'Digite o nome do canal ou @usuario (ex: mrbeast, techbr)...' : 'Digite o termo, marca ou hashtag (ex: inteligência artificial, #chatgpt)...'"
              (keyup.enter)="startSearch()">
            <button class="clear-btn" *ngIf="searchQuery" (click)="searchQuery = ''">✕</button>
          </div>

          <div class="limit-input-wrap">
            <label class="limit-label" title="Quantidade máxima de conteúdos por rede">Limite:</label>
            <select [(ngModel)]="maxLimit" class="limit-select">
              <option [value]="15">15 posts / rede</option>
              <option [value]="25">25 posts / rede</option>
              <option [value]="50">50 posts / rede</option>
            </select>
          </div>

          <button 
            type="button" 
            class="btn btn-primary search-submit-btn" 
            [disabled]="isSearching || !searchQuery.trim() || getSelectedPlatforms().length === 0"
            (click)="startSearch()">
            <span class="spinner-sm" *ngIf="isSearching"></span>
            <span>{{ isSearching ? 'Coletando...' : '🚀 Disparar Busca Transmídia' }}</span>
          </button>
        </div>

        <!-- Optional Token Override Expander -->
        <details class="credentials-expander">
          <summary>⚙️ Configurações Avançadas de Tokens (Opcional se configurado no servidor)</summary>
          <div class="expander-content">
            <div class="form-group-token">
              <label>Token Apify Personalizado (fallback para TikTok, Reddit, Twitter, Threads):</label>
              <input type="password" [(ngModel)]="tokenOverride" placeholder="apify_api_... (se vazio, usa o token do backend)">
            </div>
          </div>
        </details>
      </div>

      <!-- Live Job Progress Banner -->
      <div class="live-progress-card" *ngIf="isSearching">
        <div class="progress-header">
          <div class="spinner-pulse"></div>
          <div class="progress-text-block">
            <strong>Coleta Multiplataforma em Andamento</strong>
            <p>{{ currentProgressMessage || 'Consultando canais e feeds em paralelo...' }}</p>
          </div>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar-indeterminate"></div>
        </div>
      </div>

      <!-- Error Banner -->
      <div class="alert alert-danger" *ngIf="errorMessage">
        <div class="alert-icon">⚠️</div>
        <div class="alert-content">
          <strong>Erro na busca:</strong>
          <p>{{ errorMessage }}</p>
        </div>
        <button class="alert-close" (click)="errorMessage = null">✕</button>
      </div>

      <!-- Search Results Workspace -->
      <div class="results-workspace" *ngIf="searchResult">
        <!-- Global KPIs Header Cards -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-icon-wrap kpi-blue">🌐</div>
            <div class="kpi-data">
              <span class="kpi-label">Total de Conteúdos</span>
              <strong class="kpi-value">{{ searchResult.total_items | number }}</strong>
              <small class="kpi-sub">de {{ searchResult.platforms_requested.length }} redes consultadas</small>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-icon-wrap kpi-purple">👁️</div>
            <div class="kpi-data">
              <span class="kpi-label">Visualizações Agregadas</span>
              <strong class="kpi-value">{{ searchResult.total_views | number }}</strong>
              <small class="kpi-sub">alcance potencial estimado</small>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-icon-wrap kpi-green">💬</div>
            <div class="kpi-data">
              <span class="kpi-label">Total de Interações</span>
              <strong class="kpi-value">{{ searchResult.total_interactions | number }}</strong>
              <small class="kpi-sub">curtidas, comentários e shares</small>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-icon-wrap kpi-amber">📈</div>
            <div class="kpi-data">
              <span class="kpi-label">Taxa Média de Engajamento</span>
              <strong class="kpi-value">{{ searchResult.avg_engagement_rate | number:'1.2-2' }}%</strong>
              <small class="kpi-sub">ressonância transmídia ponderada</small>
            </div>
          </div>
        </div>

        <!-- Platform Breakdown Cards -->
        <div class="platform-breakdown-section">
          <h3 class="section-title">📊 Desempenho por Plataforma</h3>
          <div class="platform-summary-grid">
            <div 
              *ngFor="let entry of getPlatformSummaryEntries()" 
              class="platform-summary-card"
              [style.--card-accent]="getPlatformColor(entry.key)">
              <div class="card-top">
                <div class="platform-badge">
                  <span>{{ getPlatformIcon(entry.key) }}</span>
                  <strong>{{ getPlatformName(entry.key) }}</strong>
                </div>
                <span class="status-indicator" [class.status-success]="entry.value.status === 'success'" [class.status-error]="entry.value.status === 'error'">
                  {{ entry.value.status === 'success' ? 'OK' : (entry.value.status === 'partial' ? 'Parcial' : 'Falha') }}
                </span>
              </div>

              <div class="card-metrics">
                <div class="metric-col">
                  <span class="metric-sub">Itens</span>
                  <strong>{{ entry.value.total_items }}</strong>
                </div>
                <div class="metric-col">
                  <span class="metric-sub">Views</span>
                  <strong>{{ entry.value.total_views | number }}</strong>
                </div>
                <div class="metric-col">
                  <span class="metric-sub">Interações</span>
                  <strong>{{ entry.value.total_interactions | number }}</strong>
                </div>
                <div class="metric-col">
                  <span class="metric-sub">Engaj.</span>
                  <strong class="text-accent">{{ entry.value.avg_engagement_rate }}%</strong>
                </div>
              </div>

              <div class="card-footer" *ngIf="entry.value.error_message">
                <small class="text-error" [title]="entry.value.error_message">⚠️ {{ entry.value.error_message }}</small>
              </div>
            </div>
          </div>
        </div>

        <!-- Navigation Tabs: Posts vs Omnichannel AI -->
        <div class="view-tabs-header">
          <div class="tabs-left">
            <button 
              class="tab-btn" 
              [class.active]="activeViewTab === 'posts'" 
              (click)="activeViewTab = 'posts'">
              <span>📰 Feed de Conteúdos ({{ filteredPosts.length }})</span>
            </button>
            <button 
              class="tab-btn ai-tab-btn" 
              [class.active]="activeViewTab === 'ai'" 
              (click)="activeViewTab = 'ai'">
              <span>🧠 Auditoria IA Omnichannel 360°</span>
              <span class="badge badge-ai-pulse" *ngIf="aiReport">Pronto</span>
            </button>
          </div>

          <div class="tabs-right">
            <button class="btn btn-sm btn-outline" (click)="exportCsv()">
              <span>📥 Exportar CSV Multi-Rede</span>
            </button>
            <button class="btn btn-sm btn-outline" (click)="exportJson()">
              <span>💾 JSON</span>
            </button>
          </div>
        </div>

        <!-- TAB 1: FEED DE CONTEÚDOS -->
        <div class="tab-pane" *ngIf="activeViewTab === 'posts'">
          <!-- Filter and Sort Bar -->
          <div class="posts-toolbar">
            <!-- Platform Filter Pills -->
            <div class="filter-pills-row">
              <button 
                class="filter-pill" 
                [class.active]="activePlatformFilter === 'all'" 
                (click)="activePlatformFilter = 'all'">
                Todas as Redes ({{ searchResult.posts.length }})
              </button>
              <button 
                *ngFor="let p of getAvailablePlatformsInResults()" 
                class="filter-pill" 
                [class.active]="activePlatformFilter === p"
                (click)="activePlatformFilter = p">
                {{ getPlatformIcon(p) }} {{ getPlatformName(p) }} ({{ getPostsCountForPlatform(p) }})
              </button>
            </div>

            <!-- Sort By -->
            <div class="sort-select-wrap">
              <label>Ordenar:</label>
              <select [(ngModel)]="sortBy" class="sort-select">
                <option value="interactions">Mais Interações</option>
                <option value="views">Mais Visualizações</option>
                <option value="engagement">Maior Engajamento (%)</option>
              </select>
            </div>
          </div>

          <!-- Posts Grid -->
          <div class="posts-grid" *ngIf="filteredPosts.length > 0">
            <div 
              *ngFor="let post of filteredPosts" 
              class="post-card"
              [style.--post-accent]="getPlatformColor(post.platform)">
              <!-- Post Card Header -->
              <div class="post-card-header">
                <div class="author-info">
                  <div class="author-avatar" *ngIf="post.author_avatar">
                    <img [src]="getAvatarUrl(post.author_avatar)" 
                         [alt]="post.author_username" 
                         loading="lazy" 
                         referrerpolicy="no-referrer" 
                         (error)="onAvatarError($event)">
                  </div>
                  <div class="author-avatar placeholder" *ngIf="!post.author_avatar">
                    {{ post.author_username.charAt(0).toUpperCase() }}
                  </div>
                  <div class="author-names">
                    <span class="author-user">&#64;{{ post.author_username }}</span>
                    <small class="author-full" *ngIf="post.author_name">{{ post.author_name }}</small>
                  </div>
                </div>

                <div class="platform-tag" [style.background]="getPlatformColor(post.platform)">
                  <span>{{ getPlatformIcon(post.platform) }}</span>
                  <span>{{ getPlatformName(post.platform) }}</span>
                </div>
              </div>

              <!-- Media Preview / Thumbnail -->
              <div class="post-media-wrap" *ngIf="post.thumbnail_url">
                <img [src]="post.thumbnail_url" [alt]="post.title || 'Conteúdo'" loading="lazy">
                <span class="media-type-badge" *ngIf="post.media_type">
                  {{ post.media_type === 'short_video' ? '⚡ Short/Reel' : (post.media_type === 'video' ? '🎬 Vídeo' : '📷 Foto') }}
                </span>
              </div>

              <!-- Post Content Body -->
              <div class="post-body">
                <h4 class="post-title" *ngIf="post.title && post.title !== post.content">{{ post.title }}</h4>
                <p class="post-text">{{ post.content }}</p>
                <small class="post-date" *ngIf="post.published_at">Publicado: {{ post.published_at }}</small>
              </div>

              <!-- Post Stats Row -->
              <div class="post-stats-row">
                <div class="stat-item" title="Visualizações">
                  <span class="stat-icon">👁️</span>
                  <span>{{ post.views | number }}</span>
                </div>
                <div class="stat-item" title="Curtidas / Upvotes">
                  <span class="stat-icon">❤️</span>
                  <span>{{ post.likes | number }}</span>
                </div>
                <div class="stat-item" title="Comentários / Respostas">
                  <span class="stat-icon">💬</span>
                  <span>{{ post.comments_count | number }}</span>
                </div>
                <div class="stat-item" *ngIf="post.shares_count > 0" title="Compartilhamentos / Retweets">
                  <span class="stat-icon">🔄</span>
                  <span>{{ post.shares_count | number }}</span>
                </div>
                <div class="stat-item engagement-highlight" title="Taxa de Engajamento">
                  <span class="stat-icon">⭐</span>
                  <strong>{{ post.engagement_rate }}%</strong>
                </div>
              </div>

              <!-- Post Footer -->
              <div class="post-card-footer">
                <a [href]="post.url" target="_blank" rel="noopener noreferrer" class="open-link-btn">
                  <span>Abrir no {{ getPlatformName(post.platform) }}</span>
                  <span>↗</span>
                </a>
              </div>
            </div>
          </div>

          <div class="empty-feed" *ngIf="filteredPosts.length === 0">
            <span class="empty-icon">🔍</span>
            <p>Nenhum conteúdo encontrado para os filtros selecionados.</p>
          </div>
        </div>

        <!-- TAB 2: AUDITORIA IA OMNICHANNEL 360° -->
        <div class="tab-pane" *ngIf="activeViewTab === 'ai'">
          <!-- Trigger Button when not generated -->
          <div class="ai-hero-box" *ngIf="!aiReport && !isGeneratingAi">
            <div class="ai-hero-icon">✨</div>
            <h3>Diagnóstico Estratégico & Auditoria Omnichannel 360°</h3>
            <p>
              Nossa inteligência artificial analisa os dados cruzados de todas as redes pesquisadas para entregar:
              ressonância entre canais, análise transmídia de sentimento, notas de autoridade e <strong>ideias concretas de repropósito de formato</strong> (ex: transformar post de texto do Reddit/Twitter em roteiro de vídeo curto do TikTok/Shorts).
            </p>
            <button class="btn btn-primary btn-lg" (click)="generateAiAudit()">
              <span>⚡ Gerar Diagnóstico Omnichannel com IA</span>
            </button>
          </div>

          <!-- Loading AI State -->
          <div class="ai-loading-box" *ngIf="isGeneratingAi">
            <div class="loading-spinner-lg"></div>
            <h4>Cruzando Métricas Transmídia com a IA...</h4>
            <p>Avaliando ressonância entre YouTube, Reddit, TikTok e redes da Meta...</p>
          </div>

          <!-- Rendered AI Report -->
          <div class="ai-report-container" *ngIf="aiReport">
            <!-- Score & Executive Summary Card -->
            <div class="ai-score-card">
              <div class="score-circle-wrap">
                <div class="score-circle" [style.--score-val]="aiReport.omnichannel_score">
                  <span class="score-number">{{ aiReport.omnichannel_score }}</span>
                  <span class="score-max">/100</span>
                </div>
                <span class="score-label">Omnichannel Score</span>
              </div>

              <div class="score-content">
                <div class="score-badge">Diagnóstico Executivo Transmídia</div>
                <p class="score-rationale">{{ aiReport.score_rationale }}</p>
                <div class="executive-summary-text">
                  <p>{{ aiReport.executive_summary }}</p>
                </div>
              </div>
            </div>

            <!-- Cross-Platform Resonance Matrix -->
            <div class="ai-section-box">
              <h4 class="section-heading">🌐 Matriz Comparativa entre Plataformas</h4>
              <div class="comparison-grid">
                <div *ngFor="let item of aiReport.cross_platform_comparison" class="comparison-card">
                  <div class="comp-header">
                    <strong>{{ item.platform }}</strong>
                    <span class="badge" [class.badge-success]="item.resonance === 'Alta'" [class.badge-warning]="item.resonance === 'Média'">
                      Ressonância {{ item.resonance }}
                    </span>
                  </div>
                  <div class="comp-body">
                    <p><strong>Sentimento:</strong> {{ item.audience_sentiment }}</p>
                    <p class="text-success"><strong>Ponto Forte:</strong> {{ item.key_strength }}</p>
                    <p class="text-warning"><strong>Gargalo/Oportunidade:</strong> {{ item.main_bottleneck }}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Content Repurpose Ideas (Omnichannel Hooks & Scripts) -->
            <div class="ai-section-box">
              <h4 class="section-heading">🎬 Roteiros de Adaptação Transmídia (Repurpose Omnichannel)</h4>
              <div class="repurpose-grid">
                <div *ngFor="let idea of aiReport.content_repurpose_ideas; let idx = index" class="repurpose-card">
                  <div class="repurpose-flow-badge">
                    <span>{{ idea.source_platform }}</span>
                    <span>➔</span>
                    <strong class="target-highlight">{{ idea.target_platform }}</strong>
                  </div>
                  <h5 class="concept-title">{{ idea.concept }}</h5>
                  <div class="hook-box">
                    <span class="hook-label">🎣 Gancho de 3s (Hook):</span>
                    <p class="hook-text">"{{ idea.hook_3s }}"</p>
                  </div>
                  <div class="cta-box">
                    <span class="cta-label">📣 Chamada para Ação (CTA):</span>
                    <p class="cta-text">"{{ idea.cta }}"</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Strategic Recommendations -->
            <div class="ai-section-box" *ngIf="aiReport.strategic_recommendations?.length">
              <h4 class="section-heading">🎯 Recomendações Estratégicas Prioritárias</h4>
              <ul class="recommendations-list">
                <li *ngFor="let rec of aiReport.strategic_recommendations">
                  <span class="rec-bullet">✔</span>
                  <span>{{ rec }}</span>
                </li>
              </ul>
            </div>

            <!-- Omnichannel Interactive Chat -->
            <div class="ai-chat-section">
              <div class="chat-header">
                <h4>💬 Chat Consultor Omnichannel ("Pergunte à IA")</h4>
                <small>Faça perguntas específicas sobre concorrência, formatos e táticas transmídia</small>
              </div>

              <div class="chat-messages-container" #chatContainer>
                <div *ngFor="let msg of chatMessages" class="chat-bubble" [class.user]="msg.role === 'user'" [class.assistant]="msg.role === 'assistant'">
                  <div class="bubble-sender">{{ msg.role === 'user' ? 'Você' : 'Consultor IA' }}</div>
                  <div class="bubble-content" [innerHTML]="formatChatText(msg.content)"></div>
                </div>
                <div class="chat-bubble assistant typing" *ngIf="isSendingChat">
                  <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>
                </div>
              </div>

              <div class="chat-input-bar">
                <input 
                  type="text" 
                  class="chat-input" 
                  [(ngModel)]="chatInput" 
                  placeholder="Ex: Como posso viralizar no TikTok usando as dores discutidas no Reddit?"
                  (keyup.enter)="sendChatMessage()">
                <button 
                  class="btn btn-primary" 
                  [disabled]="isSendingChat || !chatInput.trim()"
                  (click)="sendChatMessage()">
                  <span>Enviar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- History Modal -->
      <div class="modal-backdrop" *ngIf="showHistoryModal" (click)="showHistoryModal = false">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>🕒 Histórico de Buscas Salvas no PostgreSQL</h3>
            <button class="modal-close" (click)="showHistoryModal = false">✕</button>
          </div>
          <div class="modal-body">
            <div class="history-list" *ngIf="historyList.length > 0">
              <div *ngFor="let item of historyList" class="history-item">
                <div class="history-info">
                  <div class="history-query">
                    <span class="mode-tag">{{ item.search_mode === 'profile' ? '👤 Perfil' : '🔍 Tópico' }}</span>
                    <strong>{{ item.query }}</strong>
                  </div>
                  <small class="history-meta">
                    {{ item.total_items }} conteúdos • {{ item.total_views | number }} views • {{ item.platforms?.join(', ') }} • {{ item.created_at | date:'short' }}
                  </small>
                </div>
                <div class="history-actions">
                  <button class="btn btn-sm btn-primary" (click)="loadHistoryItem(item.id)">Abrir</button>
                  <button class="btn btn-sm btn-outline btn-danger" (click)="deleteHistoryItem(item.id)">✕</button>
                </div>
              </div>
            </div>
            <div class="empty-history" *ngIf="historyList.length === 0">
              <p>Nenhuma busca salva encontrada no banco de dados.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .multi-search-wrapper {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      padding-bottom: 3rem;
    }

    .search-hero-card {
      background: var(--bg-surface-elevated, #131d2e);
      border: 1px solid var(--border-default, #1e293b);
      border-radius: 12px;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
    }

    .hero-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
    }

    .hero-badge {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 700;
      color: #60a5fa;
      background: rgba(96, 165, 250, 0.12);
      border: 1px solid rgba(96, 165, 250, 0.25);
      padding: 3px 10px;
      border-radius: 20px;
      margin-bottom: 0.5rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .hero-title {
      font-size: 1.4rem;
      font-weight: 700;
      color: #ffffff;
      margin: 0 0 0.4rem 0;
    }

    .hero-subtitle {
      font-size: 0.88rem;
      color: #94a3b8;
      margin: 0;
      line-height: 1.4;
    }

    .mode-toggle-group {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .mode-btn {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      padding: 0.85rem 1.15rem;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      cursor: pointer;
      text-align: left;
      transition: all 0.2s ease;
    }

    .mode-btn:hover {
      background: rgba(30, 41, 59, 0.8);
      border-color: rgba(99, 102, 241, 0.3);
    }

    .mode-btn.active {
      background: rgba(99, 102, 241, 0.15);
      border-color: #6366f1;
      box-shadow: 0 0 12px rgba(99, 102, 241, 0.2);
    }

    .mode-icon {
      font-size: 1.5rem;
    }

    .mode-text strong {
      display: block;
      font-size: 0.92rem;
      color: #ffffff;
      margin-bottom: 2px;
    }

    .mode-text small {
      font-size: 0.75rem;
      color: #94a3b8;
    }

    .platform-selector-section {
      background: rgba(15, 23, 42, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      padding: 1rem;
    }

    .selector-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }

    .selector-label {
      font-size: 0.82rem;
      font-weight: 600;
      color: #cbd5e1;
    }

    .selector-quick-actions {
      display: flex;
      gap: 0.5rem;
      font-size: 0.75rem;
    }

    .btn-link {
      background: none;
      border: none;
      color: #60a5fa;
      cursor: pointer;
      padding: 0;
      font-size: 0.75rem;
    }

    .btn-link:hover {
      text-decoration: underline;
    }

    .divider {
      color: #475569;
    }

    .platform-chips-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 0.65rem;
    }

    .platform-chip {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.45rem 0.85rem;
      background: #0f172a;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      cursor: pointer;
      user-select: none;
      transition: all 0.15s ease;
      font-size: 0.85rem;
      color: #94a3b8;
    }

    .platform-chip:hover {
      border-color: rgba(255, 255, 255, 0.25);
      color: #ffffff;
    }

    .platform-chip.active {
      border-color: var(--chip-accent, #6366f1);
      background: rgba(255, 255, 255, 0.04);
      color: #ffffff;
      box-shadow: 0 0 8px rgba(255, 255, 255, 0.05);
    }

    .chip-checkbox {
      accent-color: var(--chip-accent, #6366f1);
      cursor: pointer;
    }

    .search-bar-row {
      display: flex;
      gap: 0.75rem;
      align-items: center;
    }

    .search-input-wrap {
      flex: 1;
      position: relative;
      display: flex;
      align-items: center;
    }

    .search-icon-prefix {
      position: absolute;
      left: 12px;
      font-size: 1.1rem;
      pointer-events: none;
    }

    .search-main-input {
      width: 100%;
      padding: 0.8rem 2.5rem 0.8rem 2.6rem;
      background: #090e17;
      border: 1px solid #1e293b;
      border-radius: 8px;
      color: #ffffff;
      font-size: 0.95rem;
      outline: none;
      transition: border-color 0.2s;
    }

    .search-main-input:focus {
      border-color: #6366f1;
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
    }

    .clear-btn {
      position: absolute;
      right: 10px;
      background: none;
      border: none;
      color: #64748b;
      cursor: pointer;
      padding: 4px;
    }

    .limit-input-wrap {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .limit-label {
      font-size: 0.8rem;
      color: #94a3b8;
    }

    .limit-select {
      background: #090e17;
      border: 1px solid #1e293b;
      color: #cbd5e1;
      padding: 0.75rem 0.75rem;
      border-radius: 8px;
      font-size: 0.85rem;
      outline: none;
    }

    .search-submit-btn {
      padding: 0.8rem 1.4rem;
      font-weight: 600;
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .credentials-expander {
      font-size: 0.78rem;
      color: #64748b;
    }

    .credentials-expander summary {
      cursor: pointer;
      user-select: none;
    }

    .expander-content {
      padding-top: 0.75rem;
    }

    .form-group-token {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }

    .form-group-token input {
      background: #090e17;
      border: 1px solid #1e293b;
      color: #ffffff;
      padding: 0.5rem 0.75rem;
      border-radius: 6px;
      font-size: 0.82rem;
    }

    /* Live Progress Card */
    .live-progress-card {
      background: rgba(30, 41, 59, 0.7);
      border: 1px solid rgba(99, 102, 241, 0.4);
      border-radius: 8px;
      padding: 1rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .progress-header {
      display: flex;
      align-items: center;
      gap: 0.85rem;
    }

    .spinner-pulse {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #6366f1;
      box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.7);
      animation: pulse 1.4s infinite;
    }

    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.7); }
      70% { box-shadow: 0 0 0 10px rgba(99, 102, 241, 0); }
      100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
    }

    .progress-text-block strong {
      display: block;
      color: #ffffff;
      font-size: 0.9rem;
    }

    .progress-text-block p {
      color: #94a3b8;
      font-size: 0.8rem;
      margin: 0;
    }

    .progress-bar-container {
      width: 100%;
      height: 4px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 2px;
      overflow: hidden;
    }

    .progress-bar-indeterminate {
      width: 40%;
      height: 100%;
      background: #6366f1;
      border-radius: 2px;
      animation: indeterminate 1.5s infinite linear;
    }

    @keyframes indeterminate {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(350%); }
    }

    /* KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .kpi-card {
      background: #131d2e;
      border: 1px solid #1e293b;
      border-radius: 10px;
      padding: 1.15rem;
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .kpi-icon-wrap {
      width: 44px;
      height: 44px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.3rem;
    }

    .kpi-blue { background: rgba(59, 130, 246, 0.15); }
    .kpi-purple { background: rgba(168, 85, 247, 0.15); }
    .kpi-green { background: rgba(34, 197, 94, 0.15); }
    .kpi-amber { background: rgba(245, 158, 11, 0.15); }

    .kpi-data {
      display: flex;
      flex-direction: column;
    }

    .kpi-label {
      font-size: 0.74rem;
      color: #94a3b8;
      text-transform: uppercase;
      font-weight: 600;
    }

    .kpi-value {
      font-size: 1.45rem;
      font-weight: 700;
      color: #ffffff;
      margin: 2px 0;
    }

    .kpi-sub {
      font-size: 0.72rem;
      color: #64748b;
    }

    /* Platform Breakdown */
    .platform-breakdown-section {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 10px;
      padding: 1.25rem;
      margin-bottom: 1.5rem;
    }

    .section-title {
      font-size: 1rem;
      font-weight: 700;
      color: #ffffff;
      margin: 0 0 1rem 0;
    }

    .platform-summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 0.85rem;
    }

    .platform-summary-card {
      background: #131d2e;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-top: 3px solid var(--card-accent, #6366f1);
      border-radius: 8px;
      padding: 0.85rem;
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }

    .card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .platform-badge {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.85rem;
      color: #ffffff;
    }

    .status-indicator {
      font-size: 0.65rem;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.1);
      color: #94a3b8;
    }

    .status-success { background: rgba(34, 197, 94, 0.15); color: #4ade80; }
    .status-error { background: rgba(239, 68, 68, 0.15); color: #f87171; }

    .card-metrics {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      text-align: center;
      gap: 0.25rem;
    }

    .metric-col strong {
      display: block;
      font-size: 0.85rem;
      color: #ffffff;
    }

    .metric-sub {
      font-size: 0.68rem;
      color: #64748b;
    }

    .text-accent { color: #818cf8 !important; }
    .text-error { color: #f87171; font-size: 0.72rem; }

    /* View Tabs */
    .view-tabs-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #1e293b;
      padding-bottom: 0.75rem;
      margin-bottom: 1.25rem;
    }

    .tabs-left, .tabs-right {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }

    .tab-btn {
      background: none;
      border: none;
      color: #94a3b8;
      font-size: 0.92rem;
      font-weight: 600;
      padding: 0.5rem 1rem;
      cursor: pointer;
      border-radius: 6px;
      transition: all 0.2s;
    }

    .tab-btn:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.05);
    }

    .tab-btn.active {
      color: #ffffff;
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid rgba(99, 102, 241, 0.3);
    }

    .badge-ai-pulse {
      background: #10b981;
      color: #000;
      font-size: 0.65rem;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 10px;
      margin-left: 6px;
    }

    /* Feed Toolbar */
    .posts-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .filter-pills-row {
      display: flex;
      gap: 0.45rem;
      flex-wrap: wrap;
    }

    .filter-pill {
      background: #0f172a;
      border: 1px solid #1e293b;
      color: #94a3b8;
      padding: 0.35rem 0.75rem;
      border-radius: 20px;
      font-size: 0.78rem;
      cursor: pointer;
      transition: all 0.15s;
    }

    .filter-pill:hover {
      color: #ffffff;
      border-color: #334155;
    }

    .filter-pill.active {
      background: #334155;
      color: #ffffff;
      border-color: #64748b;
    }

    .sort-select-wrap {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.8rem;
      color: #94a3b8;
    }

    .sort-select {
      background: #0f172a;
      border: 1px solid #1e293b;
      color: #cbd5e1;
      padding: 0.35rem 0.6rem;
      border-radius: 6px;
      font-size: 0.8rem;
    }

    /* Posts Grid */
    .posts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1.15rem;
    }

    .post-card {
      background: #131d2e;
      border: 1px solid #1e293b;
      border-radius: 10px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: transform 0.15s, border-color 0.15s;
    }

    .post-card:hover {
      border-color: var(--post-accent, #6366f1);
      transform: translateY(-2px);
    }

    .post-card-header {
      padding: 0.85rem 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .author-info {
      display: flex;
      align-items: center;
      gap: 0.65rem;
    }

    .author-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      overflow: hidden;
      background: #1e293b;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8rem;
      font-weight: 700;
      color: #cbd5e1;
    }

    .author-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .author-names {
      display: flex;
      flex-direction: column;
    }

    .author-user {
      font-size: 0.82rem;
      font-weight: 600;
      color: #ffffff;
    }

    .author-full {
      font-size: 0.72rem;
      color: #64748b;
    }

    .platform-tag {
      font-size: 0.7rem;
      font-weight: 700;
      color: #ffffff;
      padding: 2px 8px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      gap: 0.3rem;
    }

    .post-media-wrap {
      position: relative;
      width: 100%;
      height: 180px;
      background: #000;
      overflow: hidden;
    }

    .post-media-wrap img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .media-type-badge {
      position: absolute;
      bottom: 8px;
      left: 8px;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);
      color: #fff;
      font-size: 0.7rem;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 4px;
    }

    .post-body {
      padding: 0.85rem 1rem;
      flex: 1;
    }

    .post-title {
      font-size: 0.88rem;
      font-weight: 600;
      color: #ffffff;
      margin: 0 0 0.4rem 0;
      line-height: 1.35;
    }

    .post-text {
      font-size: 0.8rem;
      color: #94a3b8;
      margin: 0;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .post-date {
      display: block;
      margin-top: 0.4rem;
      font-size: 0.7rem;
      color: #64748b;
    }

    .post-stats-row {
      display: flex;
      justify-content: space-between;
      padding: 0.6rem 1rem;
      background: rgba(15, 23, 42, 0.4);
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      font-size: 0.78rem;
      color: #cbd5e1;
    }

    .stat-item {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .engagement-highlight {
      color: #fbbf24;
    }

    .post-card-footer {
      padding: 0.6rem 1rem;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      text-align: right;
    }

    .open-link-btn {
      font-size: 0.75rem;
      color: #60a5fa;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
    }

    .open-link-btn:hover {
      text-decoration: underline;
    }

    /* AI Section */
    .ai-hero-box {
      text-align: center;
      padding: 3rem 2rem;
      background: #131d2e;
      border: 1px dashed rgba(99, 102, 241, 0.4);
      border-radius: 12px;
      max-width: 680px;
      margin: 0 auto;
    }

    .ai-hero-icon { font-size: 3rem; margin-bottom: 0.75rem; }
    .ai-hero-box h3 { color: #ffffff; margin: 0 0 0.5rem 0; font-size: 1.3rem; }
    .ai-hero-box p { color: #94a3b8; font-size: 0.88rem; line-height: 1.5; margin-bottom: 1.5rem; }

    .ai-loading-box {
      text-align: center;
      padding: 3rem;
    }

    .ai-report-container {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .ai-score-card {
      background: #131d2e;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 1.5rem;
      display: flex;
      align-items: center;
      gap: 2rem;
    }

    .score-circle-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.4rem;
    }

    .score-circle {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: rgba(99, 102, 241, 0.15);
      border: 3px solid #6366f1;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
    }

    .score-number { font-size: 1.8rem; font-weight: 800; color: #ffffff; line-height: 1; }
    .score-max { font-size: 0.65rem; color: #94a3b8; }
    .score-label { font-size: 0.72rem; color: #94a3b8; font-weight: 600; text-transform: uppercase; }

    .score-content { flex: 1; }
    .score-badge { font-size: 0.72rem; font-weight: 700; color: #818cf8; text-transform: uppercase; margin-bottom: 0.3rem; }
    .score-rationale { font-size: 0.85rem; color: #cbd5e1; font-style: italic; margin-bottom: 0.6rem; }
    .executive-summary-text p { color: #94a3b8; font-size: 0.88rem; line-height: 1.5; margin: 0; }

    .ai-section-box {
      background: #131d2e;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 1.25rem;
    }

    .section-heading {
      color: #ffffff;
      font-size: 1rem;
      font-weight: 700;
      margin: 0 0 1rem 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      padding-bottom: 0.5rem;
    }

    .comparison-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1rem;
    }

    .comparison-card {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 1rem;
    }

    .comp-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.65rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      padding-bottom: 0.4rem;
    }

    .comp-header strong { color: #ffffff; }

    .comp-body p {
      font-size: 0.78rem;
      margin: 0 0 0.35rem 0;
      line-height: 1.4;
    }

    .repurpose-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1rem;
    }

    .repurpose-card {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 1.15rem;
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }

    .repurpose-flow-badge {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.75rem;
      color: #94a3b8;
    }

    .target-highlight { color: #38bdf8; }
    .concept-title { color: #ffffff; font-size: 0.9rem; margin: 0; }
    
    .hook-box, .cta-box {
      background: rgba(255, 255, 255, 0.02);
      border-left: 2px solid #6366f1;
      padding: 0.5rem 0.65rem;
      border-radius: 0 4px 4px 0;
    }

    .cta-box { border-left-color: #10b981; }

    .hook-label, .cta-label { font-size: 0.68rem; font-weight: 700; color: #94a3b8; display: block; }
    .hook-text, .cta-text { font-size: 0.78rem; color: #e2e8f0; margin: 2px 0 0 0; font-style: italic; }

    .recommendations-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }

    .recommendations-list li {
      display: flex;
      gap: 0.65rem;
      align-items: flex-start;
      font-size: 0.85rem;
      color: #cbd5e1;
      line-height: 1.4;
    }

    .rec-bullet { color: #10b981; font-weight: bold; }

    /* AI Chat */
    .ai-chat-section {
      background: #131d2e;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 1.25rem;
    }

    .chat-header h4 { color: #ffffff; margin: 0; font-size: 0.95rem; }
    .chat-header small { color: #64748b; font-size: 0.75rem; }

    .chat-messages-container {
      margin: 1rem 0;
      max-height: 320px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 0.5rem;
      background: #090e17;
      border-radius: 8px;
    }

    .chat-bubble {
      max-width: 85%;
      padding: 0.65rem 0.9rem;
      border-radius: 8px;
      font-size: 0.82rem;
      line-height: 1.4;
    }

    .chat-bubble.user {
      align-self: flex-end;
      background: #4f46e5;
      color: #ffffff;
    }

    .chat-bubble.assistant {
      align-self: flex-start;
      background: #1e293b;
      color: #e2e8f0;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .bubble-sender { font-size: 0.68rem; font-weight: 700; opacity: 0.7; margin-bottom: 2px; }

    .chat-input-bar {
      display: flex;
      gap: 0.5rem;
    }

    .chat-input {
      flex: 1;
      background: #090e17;
      border: 1px solid #1e293b;
      color: #ffffff;
      padding: 0.65rem 0.9rem;
      border-radius: 6px;
      font-size: 0.85rem;
      outline: none;
    }

    .chat-input:focus { border-color: #6366f1; }

    /* Modal Backdrop */
    .modal-backdrop {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    }

    .modal-card {
      background: #131d2e;
      border: 1px solid #1e293b;
      border-radius: 12px;
      width: 90%;
      max-width: 640px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    }

    .modal-header {
      padding: 1rem 1.25rem;
      border-bottom: 1px solid #1e293b;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .modal-header h3 { margin: 0; color: #fff; font-size: 1.1rem; }
    .modal-close { background: none; border: none; color: #94a3b8; font-size: 1.2rem; cursor: pointer; }

    .modal-body {
      padding: 1rem 1.25rem;
      overflow-y: auto;
    }

    .history-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .history-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1rem;
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 8px;
    }

    .history-query { display: flex; align-items: center; gap: 0.5rem; }
    .history-query strong { color: #ffffff; }
    .mode-tag { font-size: 0.68rem; background: #334155; color: #fff; padding: 1px 6px; border-radius: 4px; }
    .history-meta { color: #64748b; font-size: 0.72rem; }
    .history-actions { display: flex; gap: 0.4rem; }
    .btn-danger { color: #f87171 !important; border-color: rgba(239, 68, 68, 0.3) !important; }

    .empty-feed {
      text-align: center;
      padding: 3rem;
      color: #64748b;
    }
  `]
})
export class MultiSearchComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);

  searchMode: SearchMode = 'topic';
  searchQuery = '';
  maxLimit = 25;
  tokenOverride = '';

  platforms: PlatformOption[] = [
    { id: 'youtube', name: 'YouTube', icon: '▶️', color: '#ff0000', selected: true },
    { id: 'reddit', name: 'Reddit', icon: '👽', color: '#ff4500', selected: true },
    { id: 'tiktok', name: 'TikTok', icon: '🎵', color: '#00f2fe', selected: true },
    { id: 'twitter', name: 'Twitter / X', icon: '🐦', color: '#1da1f2', selected: true },
    { id: 'threads', name: 'Threads', icon: '🧵', color: '#a855f7', selected: true },
    { id: 'instagram', name: 'Instagram', icon: '📸', color: '#e1306c', selected: true },
    { id: 'web', name: 'Web & OSINT', icon: '🌐', color: '#38bdf8', selected: true },
  ];

  isSearching = false;
  currentProgressMessage = '';
  errorMessage: string | null = null;
  searchResult: MultiSearchResult | null = null;

  activeViewTab: 'posts' | 'ai' = 'posts';
  activePlatformFilter: string = 'all';
  sortBy: 'interactions' | 'views' | 'engagement' = 'interactions';

  // AI & Chat
  isGeneratingAi = false;
  aiReport: OmnichannelAuditReport | null = null;
  chatMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  chatInput = '';
  isSendingChat = false;

  // History
  showHistoryModal = false;
  historyList: any[] = [];

  private pollSub?: Subscription;

  ngOnInit(): void {
    this.loadHistoryList();
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
  }

  setSearchMode(mode: SearchMode): void {
    this.searchMode = mode;
  }

  selectAllPlatforms(select: boolean): void {
    this.platforms.forEach(p => p.selected = select);
  }

  getSelectedPlatforms(): string[] {
    return this.platforms.filter(p => p.selected).map(p => p.id);
  }

  startSearch(): void {
    const query = this.searchQuery.trim();
    if (!query) return;

    const selected = this.getSelectedPlatforms();
    if (selected.length === 0) {
      this.errorMessage = 'Por favor, selecione pelo menos uma rede social para a busca.';
      return;
    }

    this.isSearching = true;
    this.errorMessage = null;
    this.currentProgressMessage = 'Iniciando pipeline assíncrono de busca transmídia...';
    this.searchResult = null;
    this.aiReport = null;
    this.chatMessages = [];

    const req: MultiSearchRequest = {
      search_mode: this.searchMode,
      query: query,
      platforms: selected,
      limit: this.maxLimit,
      token: this.tokenOverride.trim(),
    };

    this.api.searchMulti(req).subscribe({
      next: (res) => {
        if (res.job_id) {
          this.pollJob(res.job_id);
        }
      },
      error: (err) => {
        this.isSearching = false;
        this.errorMessage = err.message || 'Falha ao iniciar a busca multiplataforma.';
      }
    });
  }

  private pollJob(jobId: string): void {
    const pollInterval = setInterval(() => {
      this.api.getJob(jobId).subscribe({
        next: (job) => {
          if (job.progress) {
            this.currentProgressMessage = job.progress;
          }

          if (job.status === 'completed' && job.result) {
            clearInterval(pollInterval);
            this.isSearching = false;
            this.searchResult = job.result;
            this.loadHistoryList();
          } else if (job.status === 'failed') {
            clearInterval(pollInterval);
            this.isSearching = false;
            this.errorMessage = job.error || 'O job de busca falhou.';
          }
        },
        error: (err) => {
          clearInterval(pollInterval);
          this.isSearching = false;
          this.errorMessage = err.message || 'Erro ao consultar status da busca.';
        }
      });
    }, 1500);
  }

  getPlatformSummaryEntries(): Array<{ key: string; value: any }> {
    if (!this.searchResult?.platform_summaries) return [];
    return Object.entries(this.searchResult.platform_summaries).map(([k, v]) => ({ key: k, value: v }));
  }

  getAvailablePlatformsInResults(): string[] {
    if (!this.searchResult?.posts) return [];
    const set = new Set<string>();
    this.searchResult.posts.forEach(p => set.add(p.platform));
    return Array.from(set);
  }

  getPostsCountForPlatform(platform: string): number {
    if (!this.searchResult?.posts) return 0;
    return this.searchResult.posts.filter(p => p.platform === platform).length;
  }

  get filteredPosts(): UnifiedPost[] {
    if (!this.searchResult?.posts) return [];
    let list = this.searchResult.posts;

    if (this.activePlatformFilter !== 'all') {
      list = list.filter(p => p.platform === this.activePlatformFilter);
    }

    return [...list].sort((a, b) => {
      if (this.sortBy === 'views') {
        return b.views - a.views;
      }
      if (this.sortBy === 'engagement') {
        return b.engagement_rate - a.engagement_rate;
      }
      const interA = a.likes + a.comments_count + a.shares_count;
      const interB = b.likes + b.comments_count + b.shares_count;
      return interB - interA;
    });
  }

  getPlatformName(id: string): string {
    const found = this.platforms.find(p => p.id === id);
    return found ? found.name : id.toUpperCase();
  }

  getPlatformIcon(id: string): string {
    const found = this.platforms.find(p => p.id === id);
    return found ? found.icon : '🌐';
  }

  getPlatformColor(id: string): string {
    const found = this.platforms.find(p => p.id === id);
    return found ? found.color : '#6366f1';
  }

  getAvatarUrl(url?: string): string {
    return this.api.getImageProxyUrl(url);
  }

  onAvatarError(event: Event): void {
    (event.target as HTMLElement).style.display = 'none';
  }

  generateAiAudit(): void {
    if (!this.searchResult) return;
    this.isGeneratingAi = true;

    this.api.getOmnichannelAiAudit({
      search_data: this.searchResult,
      token: this.tokenOverride.trim(),
    }).subscribe({
      next: (res) => {
        this.isGeneratingAi = false;
        this.aiReport = res.report;
        if (this.chatMessages.length === 0) {
          this.chatMessages.push({
            role: 'assistant',
            content: `Olá! Concluí a auditoria transmídia sobre **${this.searchResult?.query}**. Identifiquei oportunidades de crescimento e ressonância entre as redes. O que você gostaria de explorar em detalhes?`
          });
        }
      },
      error: (err) => {
        this.isGeneratingAi = false;
        this.errorMessage = `Erro ao gerar diagnóstico de IA: ${err.message}`;
      }
    });
  }

  sendChatMessage(): void {
    const query = this.chatInput.trim();
    if (!query || !this.searchResult || this.isSendingChat) return;

    this.chatMessages.push({ role: 'user', content: query });
    this.chatInput = '';
    this.isSendingChat = true;

    this.api.sendOmnichannelAiChat({
      search_data: this.searchResult,
      messages: this.chatMessages,
      token: this.tokenOverride.trim(),
    }).subscribe({
      next: (res) => {
        this.isSendingChat = false;
        this.chatMessages.push({ role: 'assistant', content: res.reply });
      },
      error: (err) => {
        this.isSendingChat = false;
        this.chatMessages.push({
          role: 'assistant',
          content: `⚠️ Não foi possível obter resposta da IA: ${err.message}`
        });
      }
    });
  }

  formatChatText(content: string): string {
    if (!content) return '';
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }

  exportCsv(): void {
    if (!this.searchResult?.posts) return;
    const rows = this.searchResult.posts.map(p => ({
      Plataforma: this.getPlatformName(p.platform),
      Autor: p.author_username,
      Nome: p.author_name || '',
      Titulo: p.title || '',
      Texto: p.content,
      Tipo: p.media_type,
      URL: p.url,
      Views: p.views,
      Curtidas: p.likes,
      Comentarios: p.comments_count,
      Shares: p.shares_count,
      Taxa_Engajamento_Pct: p.engagement_rate,
      Publicado_Em: p.published_at || '',
    }));
    this.api.exportToCsv(rows, `social_listening_${this.searchResult.query}.csv`);
  }

  exportJson(): void {
    if (!this.searchResult) return;
    this.api.exportToJson(this.searchResult, `social_search_${this.searchResult.query}.json`);
  }

  loadHistoryList(): void {
    this.api.getSearchRuns(30).subscribe({
      next: (list) => {
        this.historyList = list || [];
      },
      error: () => {}
    });
  }

  openHistoryModal(): void {
    this.loadHistoryList();
    this.showHistoryModal = true;
  }

  loadHistoryItem(id: string): void {
    this.api.getSearchRunById(id).subscribe({
      next: (run) => {
        this.searchResult = run;
        this.searchQuery = run.query;
        this.searchMode = run.search_mode as SearchMode;
        this.showHistoryModal = false;
      },
      error: (err) => {
        this.errorMessage = `Erro ao abrir histórico: ${err.message}`;
      }
    });
  }

  deleteHistoryItem(id: string): void {
    this.api.deleteSearchRun(id).subscribe({
      next: () => {
        this.historyList = this.historyList.filter(item => item.id !== id);
      },
      error: () => {}
    });
  }
}
