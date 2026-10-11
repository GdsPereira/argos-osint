import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { ApiService } from './services/api.service';
import { AnalyzeRequest, AnalyzeResponse, ConfigResponse, LogEntry, SavedReportSummary } from './models/instagram.model';

import { IconComponent } from './components/ui/icon/icon.component';
import { ConfigSidebarComponent } from './components/config-sidebar/config-sidebar.component';
import { ProfileHeaderComponent } from './components/profile-header/profile-header.component';
import { KpiSummaryComponent } from './components/kpi-summary/kpi-summary.component';
import { TabEngagementComponent } from './components/tab-engagement/tab-engagement.component';
import { TabContentComponent } from './components/tab-content/tab-content.component';
import { TabHashtagsComponent } from './components/tab-hashtags/tab-hashtags.component';
import { TabTimingComponent } from './components/tab-timing/tab-timing.component';
import { TabCommentsComponent } from './components/tab-comments/tab-comments.component';
import { TabAudienceComponent } from './components/tab-audience/tab-audience.component';
import { TabExportComponent } from './components/tab-export/tab-export.component';
import { TabAiComponent } from './components/tab-ai/tab-ai.component';
import { MultiSearchComponent } from './components/multi-search/multi-search.component';
import { OsintExplorerComponent } from './components/osint-explorer/osint-explorer.component';

type ActiveTab = 'ai' | 'engagement' | 'content' | 'hashtags' | 'timing' | 'comments' | 'audience' | 'export';
type MainAppMode = 'multi' | 'instagram' | 'osint';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IconComponent,
    ConfigSidebarComponent,
    ProfileHeaderComponent,
    KpiSummaryComponent,
    TabAiComponent,
    TabEngagementComponent,
    TabContentComponent,
    TabHashtagsComponent,
    TabTimingComponent,
    TabCommentsComponent,
    TabAudienceComponent,
    TabExportComponent,
    MultiSearchComponent,
    OsintExplorerComponent
  ],
  template: `
    <div class="app-container" [class.full-width-layout]="mainAppMode === 'multi' || mainAppMode === 'osint'">
      <!-- Sidebar Configuration Form (apenas no modo Instagram) -->
      <app-config-sidebar 
        *ngIf="mainAppMode === 'instagram'"
        [isLoading]="isLoading" 
        [envConfig]="envConfig"
        (analyzeRequested)="onAnalyze($event)">
      </app-config-sidebar>

      <!-- Main Workspace -->
      <main class="main-content">
        <!-- Top App Bar -->
        <header class="app-header">
          <div class="header-left">
            <div class="header-brand-pill">
              <app-icon name="sparkles" [size]="14" customClass="icon-ig-gradient"></app-icon>
              <span>Social Intelligence & OSINT Suite</span>
            </div>
            <h1 class="header-title">{{ mainAppMode === 'multi' ? 'Social Listening Transmídia' : (mainAppMode === 'osint' ? 'Investigação Digital & OSINT' : 'Instagram Profile Intelligence') }}</h1>
          </div>

          <!-- Mode Switcher Tabs -->
          <div class="header-center">
            <div class="main-mode-switcher">
              <button 
                class="mode-switch-btn" 
                [class.active]="mainAppMode === 'multi'" 
                (click)="switchMode('multi')">
                <app-icon name="globe" [size]="15"></app-icon>
                <span>Social Listening Multi-Rede</span>
                <span class="badge-mode-new">NOVO</span>
              </button>
              <button 
                class="mode-switch-btn" 
                [class.active]="mainAppMode === 'instagram'" 
                (click)="switchMode('instagram')">
                <app-icon name="instagram" [size]="15"></app-icon>
                <span>Instagram Profile Pro</span>
              </button>
              <button 
                class="mode-switch-btn" 
                [class.active]="mainAppMode === 'osint'" 
                (click)="switchMode('osint')">
                <app-icon name="shield" [size]="15"></app-icon>
                <span>OSINT & Dorks</span>
                <span class="badge-mode-new">OPEN SOURCE</span>
              </button>
            </div>
          </div>

          <div class="header-right">

            <!-- Database Status Indicator -->
            <div class="db-status-pill" 
                 [class.db-connected]="envConfig?.database?.connected" 
                 [title]="envConfig?.database?.connected ? 'PostgreSQL Conectado (Persistência Ativa)' : 'Banco em Modo Local'">
              <span class="db-dot"></span>
              <span>{{ envConfig?.database?.connected ? 'PostgreSQL Ativo' : 'Banco Local' }}</span>
            </div>

            <!-- Saved Reports Modal Trigger -->
            <button class="btn btn-sm btn-secondary reports-toggle-btn" (click)="openReportsModal()">
              <app-icon name="database" [size]="14"></app-icon>
              <span>Histórico</span>
              <span class="badge badge-sm badge-db-count" *ngIf="savedReports.length > 0">{{ savedReports.length }}</span>
            </button>

            <!-- Console / Logs Button -->
            <button class="btn btn-sm btn-outline logs-toggle-btn" *ngIf="jobLogs.length > 0" (click)="showLogsModal = true">
              <app-icon name="terminal" [size]="14"></app-icon>
              <span>Console ({{ jobLogs.length }})</span>
            </button>

            <!-- Target Profile Live Pill -->
            <div class="current-target-badge" *ngIf="analysis">
              <span class="dot-online"></span>
              <span>Analisando <strong>&#64;{{ analysis.info.username }}</strong></span>
            </div>
          </div>
        </header>

        <!-- Multi-Platform Social Listening View -->
        <div class="multi-search-container" *ngIf="mainAppMode === 'multi'">
          <app-multi-search></app-multi-search>
        </div>

        <!-- OSINT & Google Dorks View -->
        <div class="osint-view-container" *ngIf="mainAppMode === 'osint'">
          <app-osint-explorer></app-osint-explorer>
        </div>

        <!-- Instagram Analysis Views -->
        <ng-container *ngIf="mainAppMode === 'instagram'">
        <!-- Error Notification Banner -->
        <div class="alert alert-danger" *ngIf="errorMessage">
          <div class="alert-icon">
            <app-icon name="alert-triangle" [size]="20"></app-icon>
          </div>
          <div class="alert-content">
            <strong>Falha na coleta de dados:</strong>
            <p>{{ errorMessage }}</p>
            <div class="alert-actions">
              <button class="btn btn-sm btn-outline" *ngIf="jobLogs.length > 0" (click)="showLogsModal = true">
                <app-icon name="terminal" [size]="14"></app-icon>
                <span>Inspecionar Logs ({{ jobLogs.length }})</span>
              </button>
              <button class="btn btn-sm btn-primary" *ngIf="lastRequest && !lastRequest.use_async" (click)="retryWithAsync()">
                <app-icon name="zap" [size]="14"></app-icon>
                <span>Tentar em Segundo Plano (Job Assíncrono)</span>
              </button>
            </div>
          </div>
          <button class="alert-close" (click)="errorMessage = null">
            <app-icon name="x" [size]="14"></app-icon>
          </button>
        </div>

        <!-- Loading State -->
        <div class="loading-hero" *ngIf="isLoading">
          <div class="loading-spinner-ring">
            <div class="ring-pulse"></div>
            <div class="spinner-center">
              <app-icon name="zap" [size]="24" customClass="icon-rose"></app-icon>
            </div>
          </div>
          <h3 class="loading-title">Coletando e Analisando Perfil...</h3>
          <p class="loading-text">
            {{ loadingStatusText || 'Extraindo publicações, calculando métricas de engajamento e preparando o grafo analítico.' }}
          </p>

          <!-- Live Verbose Terminal Viewer -->
          <div class="terminal-card" *ngIf="jobLogs.length > 0">
            <div class="terminal-header">
              <div class="terminal-dots">
                <span class="dot dot-red"></span>
                <span class="dot dot-yellow"></span>
                <span class="dot dot-green"></span>
              </div>
              <div class="terminal-title">
                <app-icon name="terminal" [size]="13"></app-icon>
                <span>Console de Execução em Tempo Real</span>
                <span class="terminal-job" *ngIf="activeJobId">[{{ activeJobId }}]</span>
              </div>
              <div class="terminal-actions">
                <button class="terminal-action-btn" (click)="copyLogs()" [title]="copiedLogs ? 'Copiado!' : 'Copiar Logs'">
                  <app-icon [name]="copiedLogs ? 'check' : 'copy'" [size]="12"></app-icon>
                  <span>{{ copiedLogs ? 'Copiado' : 'Copiar' }}</span>
                </button>
                <button class="terminal-action-btn" (click)="logsExpanded = !logsExpanded">
                  <app-icon [name]="logsExpanded ? 'chevron-down' : 'chevron-right'" [size]="12"></app-icon>
                  <span>{{ logsExpanded ? 'Recolher' : 'Expandir' }}</span>
                </button>
              </div>
            </div>
            <div class="terminal-body" [class.collapsed]="!logsExpanded">
              <div *ngFor="let log of jobLogs" class="terminal-row" [ngClass]="'log-' + log.level">
                <span class="log-timestamp">[{{ log.timestamp }}]</span>
                <span class="log-badge" [ngClass]="'badge-' + log.level">{{ log.level | uppercase }}</span>
                <span class="log-message">{{ log.message }}</span>
              </div>
              <div class="terminal-cursor-row" *ngIf="isLoading">
                <span class="terminal-prompt">&gt;</span>
                <span class="terminal-cursor">_</span>
              </div>
            </div>
          </div>

          <div *ngIf="activeJobId" style="margin-top: 1.5rem;">
            <button class="btn btn-outline btn-sm btn-cancel-job" (click)="cancelCurrentJob()">
              <app-icon name="x" [size]="14"></app-icon>
              <span>Cancelar Análise</span>
            </button>
          </div>
        </div>

        <!-- Initial Blank / Welcome State -->
        <div class="welcome-hero card" *ngIf="!analysis && !isLoading && !errorMessage">
          <div class="welcome-badge">
            <app-icon name="sparkles" [size]="14"></app-icon>
            <span>Instagram OSINT & Analytics Suite</span>
          </div>

          <h2 class="welcome-heading">Auditoria Completa & Inteligência de Fontes Abertas</h2>
          <p class="welcome-desc">
            Selecione o método de coleta na barra lateral à esquerda, insira o <strong>&#64;usuário</strong> alvo ou escolha um dos relatórios salvos no banco para explorar métricas completas e dossiê de inteligência.
          </p>

          <div class="features-preview-grid">
            <div class="feature-item feature-item-ai">
              <div class="f-icon-box f-ai">
                <app-icon name="shield" [size]="20"></app-icon>
              </div>
              <h4>Dossiê OSINT com IA</h4>
              <p>Perfilamento analítico do alvo, exposição de dados OPSEC, mapeamento de conexões e riscos.</p>
            </div>

            <div class="feature-item">
              <div class="f-icon-box f-eng">
                <app-icon name="trend-up" [size]="20"></app-icon>
              </div>
              <h4>Engajamento & Timeline</h4>
              <p>Curva histórica de curtidas, comentários e interações por postagem ao longo do tempo.</p>
            </div>

            <div class="feature-item">
              <div class="f-icon-box f-content">
                <app-icon name="bar-chart" [size]="20"></app-icon>
              </div>
              <h4>Formatos de Conteúdo</h4>
              <p>Desempenho comparativo entre fotos estáticas, reels de vídeo e álbuns em carrossel.</p>
            </div>

            <div class="feature-item">
              <div class="f-icon-box f-hash">
                <app-icon name="hash" [size]="20"></app-icon>
              </div>
              <h4>Hashtags & Menções</h4>
              <p>Média de alcance e engajamento obtido por hashtag utilizada no histórico de legendas.</p>
            </div>

            <div class="feature-item">
              <div class="f-icon-box f-timing">
                <app-icon name="clock" [size]="20"></app-icon>
              </div>
              <h4>Janelas de Oportunidade</h4>
              <p>Picos de engajamento mapeados por hora do dia e dia da semana para otimizar alcance.</p>
            </div>

            <div class="feature-item">
              <div class="f-icon-box f-comments">
                <app-icon name="message-square" [size]="20"></app-icon>
              </div>
              <h4>Análise de Sentimento</h4>
              <p>Sentimento léxico dos comentários, nuvem de palavras e seguidores mais frequentes.</p>
            </div>
          </div>
        </div>

        <!-- Analysis Dashboard (When Data Available) -->
        <div class="dashboard-area" *ngIf="analysis && !isLoading">
          <!-- Profile Header Summary -->
          <app-profile-header 
            [info]="analysis.info" 
            [summary]="analysis.summary" 
            [source]="analysis.source">
          </app-profile-header>

          <!-- Top KPI Metric Cards -->
          <app-kpi-summary 
            [summary]="analysis.summary">
          </app-kpi-summary>

          <!-- Navigation Tabs -->
          <div class="tabs-header">
            <button class="tab-button tab-ai-highlight" 
                    [class.active]="activeTab === 'ai'" 
                    (click)="setActiveTab('ai')">
              <app-icon name="shield" [size]="16"></app-icon>
              <span>Dossiê OSINT</span>
              <span class="badge badge-sm badge-ai-pill">IA</span>
            </button>

            <button class="tab-button" 
                    [class.active]="activeTab === 'engagement'" 
                    (click)="setActiveTab('engagement')">
              <app-icon name="trend-up" [size]="16"></app-icon>
              <span>Engajamento</span>
            </button>

            <button class="tab-button" 
                    [class.active]="activeTab === 'content'" 
                    (click)="setActiveTab('content')">
              <app-icon name="bar-chart" [size]="16"></app-icon>
              <span>Conteúdo & Formatos</span>
            </button>

            <button class="tab-button" 
                    [class.active]="activeTab === 'hashtags'" 
                    (click)="setActiveTab('hashtags')">
              <app-icon name="hash" [size]="16"></app-icon>
              <span>Hashtags & Menções</span>
            </button>

            <button class="tab-button" 
                    [class.active]="activeTab === 'timing'" 
                    (click)="setActiveTab('timing')">
              <app-icon name="clock" [size]="16"></app-icon>
              <span>Melhores Horários</span>
            </button>

            <button class="tab-button" 
                    [class.active]="activeTab === 'comments'" 
                    (click)="setActiveTab('comments')">
              <app-icon name="message-square" [size]="16"></app-icon>
              <span>Comentários</span>
              <span class="badge badge-sm badge-count" *ngIf="analysis.comments.total > 0">
                {{ analysis.comments.total }}
              </span>
            </button>

            <button class="tab-button" 
                    [class.active]="activeTab === 'audience'" 
                    (click)="setActiveTab('audience')">
              <app-icon name="users" [size]="16"></app-icon>
              <span>Audiência / Insights</span>
            </button>

            <button class="tab-button" 
                    [class.active]="activeTab === 'export'" 
                    (click)="setActiveTab('export')">
              <app-icon name="download" [size]="16"></app-icon>
              <span>Exportação</span>
            </button>
          </div>

          <!-- Active Tab Content -->
          <div class="tab-viewport">
            <!-- 0. Diagnóstico IA -->
            <app-tab-ai 
              *ngIf="activeTab === 'ai'"
              [analysis]="analysis"
              [envConfig]="envConfig || undefined">
            </app-tab-ai>

            <!-- 1. Engajamento -->
            <app-tab-engagement 
              *ngIf="activeTab === 'engagement'"
              [charts]="analysis.charts"
              [topPosts]="analysis.top_posts">
            </app-tab-engagement>

            <!-- 2. Conteúdo -->
            <app-tab-content 
              *ngIf="activeTab === 'content'"
              [charts]="analysis.charts"
              [posts]="analysis.posts"
              [extra]="analysis.extra"
              [username]="analysis.info.username">
            </app-tab-content>

            <!-- 3. Hashtags & Menções -->
            <app-tab-hashtags 
              *ngIf="activeTab === 'hashtags'"
              [hashtags]="analysis.hashtags"
              [mentions]="analysis.mentions"
              [tagged]="analysis.tagged"
              [locations]="analysis.locations">
            </app-tab-hashtags>

            <!-- 4. Melhores Horários -->
            <app-tab-timing 
              *ngIf="activeTab === 'timing'"
              [byHour]="analysis.charts.by_hour"
              [byWeekday]="analysis.charts.by_weekday"
              [summary]="analysis.summary">
            </app-tab-timing>

            <!-- 5. Comentários -->
            <app-tab-comments 
              *ngIf="activeTab === 'comments'"
              [comments]="analysis.comments">
            </app-tab-comments>

            <!-- 6. Audiência -->
            <app-tab-audience 
              *ngIf="activeTab === 'audience'"
              [audience]="analysis.audience"
              [extra]="analysis.extra"
              [source]="analysis.source">
            </app-tab-audience>

            <!-- 7. Exportação -->
            <app-tab-export 
              *ngIf="activeTab === 'export'"
              [analysis]="analysis">
            </app-tab-export>
          </div>
        </div>
        </ng-container>

        <!-- Verbose Logs Modal -->
        <div class="modal-backdrop" *ngIf="showLogsModal" (click)="showLogsModal = false">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div class="modal-header-left">
                <app-icon name="terminal" [size]="18" customClass="icon-cyan"></app-icon>
                <h3>Console de Execução / Verbose Logs</h3>
                <span class="badge badge-sm badge-neutral">{{ jobLogs.length }} eventos</span>
              </div>
              <div class="modal-header-right">
                <button class="btn btn-sm btn-outline" (click)="copyLogs()">
                  <app-icon [name]="copiedLogs ? 'check' : 'copy'" [size]="14"></app-icon>
                  <span>{{ copiedLogs ? 'Copiado!' : 'Copiar Logs' }}</span>
                </button>
                <button class="modal-close-btn" (click)="showLogsModal = false">
                  <app-icon name="x" [size]="16"></app-icon>
                </button>
              </div>
            </div>
            <div class="modal-body">
              <div class="terminal-body modal-terminal">
                <div *ngFor="let log of jobLogs" class="terminal-row" [ngClass]="'log-' + log.level">
                  <span class="log-timestamp">[{{ log.timestamp }}]</span>
                  <span class="log-badge" [ngClass]="'badge-' + log.level">{{ log.level | uppercase }}</span>
                  <span class="log-message">{{ log.message }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Saved Reports Modal (PostgreSQL History) -->
        <div class="modal-backdrop" *ngIf="showReportsModal" (click)="showReportsModal = false">
          <div class="modal-card reports-modal-card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div class="modal-header-left">
                <app-icon name="database" [size]="18" customClass="icon-indigo"></app-icon>
                <h3>Histórico de Relatórios & Análises (PostgreSQL)</h3>
                <span class="badge badge-sm badge-primary">{{ filteredReports.length }} salvos</span>
              </div>
              <div class="modal-header-right">
                <button class="btn btn-sm btn-outline" (click)="fetchSavedReports()">
                  <app-icon name="refresh-cw" [size]="14"></app-icon>
                  <span>Atualizar</span>
                </button>
                <button class="modal-close-btn" (click)="showReportsModal = false">
                  <app-icon name="x" [size]="16"></app-icon>
                </button>
              </div>
            </div>
            <div class="modal-body reports-modal-body">
              <div class="reports-search-box">
                <div class="input-with-search">
                  <app-icon name="search" [size]="14" customClass="search-icon-pos"></app-icon>
                  <input 
                    type="text" 
                    class="form-input search-input" 
                    placeholder="Buscar por @usuário..." 
                    [(ngModel)]="reportsSearchTerm" />
                </div>
              </div>

              <div class="loading-inline" *ngIf="isLoadingReports">
                <div class="spinner-sm"></div>
                <span>Consultando relatórios no banco de dados...</span>
              </div>

              <div class="empty-reports" *ngIf="!isLoadingReports && filteredReports.length === 0">
                <div class="empty-icon-wrap">
                  <app-icon name="file-text" [size]="28"></app-icon>
                </div>
                <p>Nenhum relatório persistido encontrado no banco de dados.</p>
                <small>Toda análise realizada é automaticamente salva no PostgreSQL para resiliência.</small>
              </div>

              <div class="reports-list" *ngIf="!isLoadingReports && filteredReports.length > 0">
                <div class="report-item-card" *ngFor="let rep of filteredReports">
                  <div class="report-item-info">
                    <div class="report-item-title">
                      <strong>&#64;{{ rep.username }}</strong>
                      <span class="report-tag" [ngClass]="'tag-' + rep.source">{{ rep.source | uppercase }}</span>
                      <span class="report-ai-badge" *ngIf="rep.has_ai_reports" title="Possui Dossiê OSINT / IA">
                        <app-icon name="sparkles" [size]="11"></app-icon>
                        <span>IA</span>
                      </span>
                    </div>
                    <div class="report-item-meta">
                      <span><app-icon name="users" [size]="12"></app-icon> {{ rep.followers | number }}</span>
                      <span><app-icon name="bar-chart" [size]="12"></app-icon> {{ rep.posts_count }} posts</span>
                      <span><app-icon name="trend-up" [size]="12"></app-icon> {{ rep.engagement_rate }}% engaj.</span>
                      <span class="report-date"><app-icon name="calendar" [size]="12"></app-icon> {{ rep.created_at | date:'dd/MM/yyyy HH:mm' }}</span>
                    </div>
                  </div>
                  <div class="report-item-actions">
                    <button class="btn btn-sm btn-primary" (click)="loadSavedReport(rep.id)">
                      <app-icon name="play" [size]="12"></app-icon>
                      <span>Carregar</span>
                    </button>
                    <button class="btn btn-sm btn-outline btn-delete-rep" (click)="deleteSavedReport(rep.id, $event)" title="Excluir do banco">
                      <app-icon name="x" [size]="14"></app-icon>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .app-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.75rem;
      border-bottom: 1px solid var(--border-subtle);
      padding-bottom: 1.25rem;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .header-left {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .header-brand-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--accent-cyan);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .header-title {
      font-size: 1.45rem;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.03em;
    }

    .main-mode-switcher {
      display: flex;
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 28px;
      padding: 3px;
      gap: 4px;
    }

    .mode-switch-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: none;
      border: none;
      color: #94a3b8;
      font-size: 0.84rem;
      font-weight: 600;
      padding: 0.45rem 1.1rem;
      border-radius: 24px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .mode-switch-btn:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.06);
    }

    .mode-switch-btn.active {
      color: #ffffff;
      background: #4f46e5;
      box-shadow: 0 2px 10px rgba(79, 70, 229, 0.4);
    }

    .badge-mode-new {
      font-size: 0.65rem;
      font-weight: 800;
      background: #10b981;
      color: #000;
      padding: 1px 6px;
      border-radius: 10px;
    }

    .full-width-layout .main-content {
      width: 100%;
      max-width: 1400px;
      margin: 0 auto;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      flex-wrap: wrap;
    }

    .db-status-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      background: rgba(148, 163, 184, 0.06);
      border: 1px solid var(--border-default);
      padding: 0.35rem 0.75rem;
      border-radius: var(--radius-full);
      font-size: 0.75rem;
      color: var(--text-muted);
      font-weight: 600;
    }

    .db-status-pill.db-connected {
      background: rgba(16, 185, 129, 0.1);
      border-color: rgba(16, 185, 129, 0.3);
      color: #34d399;
    }

    .db-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #475569;
    }

    .db-connected .db-dot {
      background: #10b981;
      box-shadow: 0 0 8px rgba(16, 185, 129, 0.7);
    }

    .reports-toggle-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      font-size: 0.775rem;
    }

    .badge-db-count {
      background: #3b82f6;
      color: #ffffff;
      font-weight: 700;
      border-radius: var(--radius-full);
      padding: 0.1rem 0.45rem;
    }

    .logs-toggle-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      font-size: 0.775rem;
    }

    .current-target-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border-default);
      padding: 0.35rem 0.85rem;
      border-radius: var(--radius-full);
      font-size: 0.825rem;
      color: var(--text-primary);
    }

    .dot-online {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 8px rgba(16, 185, 129, 0.8);
    }

    /* Alerts */
    .alert {
      display: flex;
      align-items: flex-start;
      gap: 0.85rem;
      padding: 1rem 1.25rem;
      border-radius: var(--radius-md);
      margin-bottom: 1.5rem;
      position: relative;
    }

    .alert-danger {
      background: rgba(244, 63, 94, 0.12);
      border: 1px solid rgba(244, 63, 94, 0.35);
      color: #fda4af;
    }

    .alert-icon {
      color: #fb7185;
      flex-shrink: 0;
      padding-top: 2px;
    }

    .alert-content p {
      font-size: 0.875rem;
      margin-top: 0.2rem;
      color: #fecdd3;
    }

    .alert-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.75rem;
      flex-wrap: wrap;
    }

    .alert-close {
      position: absolute;
      top: 0.75rem;
      right: 0.75rem;
      background: transparent;
      border: none;
      color: #fda4af;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.25rem;
    }

    /* Loading Hero */
    .loading-hero {
      text-align: center;
      padding: 3.5rem 2rem;
      background: var(--bg-card);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
    }

    .loading-spinner-ring {
      position: relative;
      width: 64px;
      height: 64px;
      margin: 0 auto 1.5rem auto;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .ring-pulse {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 3px solid transparent;
      border-top-color: var(--ig-pink);
      border-right-color: var(--ig-purple);
      animation: spin 1s linear infinite;
    }

    .spinner-center {
      position: relative;
      z-index: 2;
    }

    .loading-title {
      font-size: 1.35rem;
      color: #ffffff;
      margin-bottom: 0.4rem;
    }

    .loading-text {
      color: var(--text-secondary);
      font-size: 0.9rem;
      max-width: 580px;
      margin: 0 auto;
    }

    .btn-cancel-job {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      color: #fda4af;
      border-color: rgba(244, 63, 94, 0.35);
    }
    .btn-cancel-job:hover {
      background: rgba(244, 63, 94, 0.15);
      border-color: #f43f5e;
    }

    /* Welcome Hero */
    .welcome-hero {
      text-align: center;
      padding: 3.5rem 2.5rem;
      background: radial-gradient(circle at 50% 10%, rgba(225, 48, 108, 0.08) 0%, transparent 60%),
                  var(--bg-card);
    }

    .welcome-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.3rem 0.85rem;
      background: rgba(225, 48, 108, 0.12);
      border: 1px solid rgba(225, 48, 108, 0.3);
      border-radius: var(--radius-full);
      color: #f472b6;
      font-size: 0.775rem;
      font-weight: 700;
      margin-bottom: 1.25rem;
    }

    .welcome-heading {
      font-size: 1.85rem;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.03em;
      margin-bottom: 0.75rem;
    }

    .welcome-desc {
      color: var(--text-secondary);
      max-width: 620px;
      margin: 0 auto 2.75rem auto;
      font-size: 0.95rem;
      line-height: 1.55;
    }

    .features-preview-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
      gap: 1.25rem;
      text-align: left;
    }

    .feature-item {
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      padding: 1.25rem;
      transition: all var(--transition-fast);
    }
    .feature-item:hover {
      border-color: var(--border-hover);
      transform: translateY(-2px);
    }

    .feature-item-ai {
      border-color: rgba(139, 92, 246, 0.4);
      background: linear-gradient(135deg, rgba(24, 32, 51, 0.8) 0%, rgba(139, 92, 246, 0.12) 100%);
    }

    .f-icon-box {
      width: 40px;
      height: 40px;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 0.85rem;
    }

    .f-ai { background: rgba(139, 92, 246, 0.2); color: #c084fc; }
    .f-eng { background: rgba(56, 189, 248, 0.2); color: #38bdf8; }
    .f-content { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
    .f-hash { background: rgba(16, 185, 129, 0.2); color: #34d399; }
    .f-timing { background: rgba(225, 48, 108, 0.2); color: #f472b6; }
    .f-comments { background: rgba(99, 102, 241, 0.2); color: #818cf8; }

    .feature-item h4 {
      font-size: 0.95rem;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 0.35rem;
    }

    .feature-item p {
      font-size: 0.8rem;
      color: var(--text-muted);
      line-height: 1.45;
    }

    /* Badges in Tabs */
    .badge-count {
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
      font-size: 0.68rem;
    }

    .badge-ai-pill {
      background: var(--ig-gradient);
      color: #ffffff;
      font-weight: 700;
    }

    /* Modal Backdrop and Card */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(4, 7, 13, 0.82);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1.5rem;
      animation: fadeIn 0.15s ease-out;
    }

    .modal-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-lg);
      max-width: 800px;
      width: 100%;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      box-shadow: var(--shadow-lg);
      overflow: hidden;
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--border-subtle);
      background: var(--bg-surface-elevated);
    }

    .modal-header-left {
      display: flex;
      align-items: center;
      gap: 0.65rem;
    }

    .modal-header-left h3 {
      font-size: 1.05rem;
      color: #ffffff;
    }

    .modal-header-right {
      display: flex;
      align-items: center;
      gap: 0.65rem;
    }

    .modal-close-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.3rem;
      border-radius: var(--radius-xs);
    }
    .modal-close-btn:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.08);
    }

    .modal-body {
      padding: 1.25rem;
      flex: 1;
      overflow-y: auto;
      background: #060911;
    }

    .modal-terminal {
      max-height: none;
      padding: 0;
    }

    .reports-modal-card {
      max-width: 780px;
    }

    .reports-search-box {
      margin-bottom: 1.25rem;
    }

    .input-with-search {
      position: relative;
      display: flex;
      align-items: center;
    }

    .search-input {
      padding-left: 2.2rem;
    }

    :host ::ng-deep .search-icon-pos {
      position: absolute;
      left: 0.85rem;
      color: var(--text-muted);
      pointer-events: none;
    }

    .loading-inline {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.65rem;
      padding: 2rem;
      color: var(--text-secondary);
      font-size: 0.875rem;
    }

    .spinner-sm {
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255, 255, 255, 0.2);
      border-top-color: var(--ig-pink);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .empty-reports {
      text-align: center;
      padding: 3rem 1.5rem;
      color: var(--text-secondary);
    }

    .empty-icon-wrap {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border-default);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1rem auto;
      color: var(--text-muted);
    }

    .empty-reports small {
      color: var(--text-dim);
      display: block;
      margin-top: 0.35rem;
    }

    .reports-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .report-item-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.95rem 1.2rem;
      background: var(--bg-card);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      transition: all var(--transition-fast);
      gap: 1rem;
    }

    .report-item-card:hover {
      border-color: var(--border-hover);
      background: var(--bg-card-hover);
    }

    .report-item-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.35rem;
    }

    .report-item-title strong {
      font-size: 0.95rem;
      color: #ffffff;
    }

    .report-tag {
      font-size: 0.65rem;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.08);
      color: var(--text-secondary);
    }

    .report-ai-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.68rem;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 4px;
      background: rgba(139, 92, 246, 0.15);
      border: 1px solid rgba(139, 92, 246, 0.35);
      color: #c084fc;
    }

    .report-item-meta {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.85rem;
      font-size: 0.775rem;
      color: var(--text-muted);
    }
    .report-item-meta span {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
    }

    .report-item-actions {
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }

    .btn-delete-rep {
      padding: 0.35rem 0.55rem;
      color: #f43f5e;
      border-color: rgba(244, 63, 94, 0.25);
    }
    .btn-delete-rep:hover {
      background: rgba(244, 63, 94, 0.15);
      border-color: #f43f5e;
    }

    :host ::ng-deep .icon-ig-gradient {
      color: var(--ig-pink);
    }
    :host ::ng-deep .icon-rose {
      color: #f43f5e;
    }
    :host ::ng-deep .icon-cyan {
      color: #38bdf8;
    }
    :host ::ng-deep .icon-indigo {
      color: #818cf8;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly titleService = inject(Title);

  mainAppMode: MainAppMode = 'multi';
  isLoading = false;
  loadingStatusText: string | null = null;
  activeJobId: string | null = null;
  lastRequest: AnalyzeRequest | null = null;
  errorMessage: string | null = null;
  envConfig: ConfigResponse | null = null;
  analysis: AnalyzeResponse | null = null;
  activeTab: ActiveTab = 'engagement';

  savedReports: SavedReportSummary[] = [];
  showReportsModal = false;
  isLoadingReports = false;
  reportsSearchTerm = '';

  jobLogs: LogEntry[] = [];
  showLogsModal = false;
  logsExpanded = true;
  copiedLogs = false;

  private pollTimer: any = null;
  private sub?: Subscription;

  get filteredReports(): SavedReportSummary[] {
    if (!this.reportsSearchTerm.trim()) {
      return this.savedReports;
    }
    const term = this.reportsSearchTerm.toLowerCase().trim();
    return this.savedReports.filter(r =>
      r.username.toLowerCase().includes(term) ||
      (r.full_name && r.full_name.toLowerCase().includes(term))
    );
  }

  ngOnInit(): void {
    this.loadConfig();
    this.fetchSavedReports();
    this.updateDocumentTitle();
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.sub?.unsubscribe();
  }

  switchMode(mode: MainAppMode): void {
    this.mainAppMode = mode;
    this.updateDocumentTitle();
  }

  updateDocumentTitle(): void {
    if (this.mainAppMode === 'instagram' && this.analysis?.info?.username) {
      this.titleService.setTitle(`@${this.analysis.info.username} | argos-osint`);
    } else {
      this.titleService.setTitle('argos-osint');
    }
  }

  openReportsModal(): void {
    this.showReportsModal = true;
    this.fetchSavedReports();
  }

  fetchSavedReports(): void {
    this.isLoadingReports = true;
    this.api.getReports().subscribe({
      next: (data) => {
        this.savedReports = (data || []) as SavedReportSummary[];
        this.isLoadingReports = false;
      },
      error: () => {
        this.isLoadingReports = false;
      }
    });
  }

  loadSavedReport(reportId: string): void {
    this.isLoading = true;
    this.loadingStatusText = 'Carregando análise persistida do PostgreSQL...';
    this.showReportsModal = false;
    this.api.getReportById(reportId).subscribe({
      next: (res) => {
        this.analysis = res;
        this.isLoading = false;
        this.loadingStatusText = null;
        this.errorMessage = null;
        this.updateDocumentTitle();
        this.jobLogs = [
          {
            timestamp: new Date().toLocaleTimeString(),
            message: `Relatório histórico carregado com sucesso do PostgreSQL (@${res.info.username})!`,
            level: 'success'
          }
        ];
      },
      error: () => {
        this.isLoading = false;
        this.loadingStatusText = null;
        this.errorMessage = 'Não foi possível carregar a análise salva do banco de dados.';
      }
    });
  }

  deleteSavedReport(reportId: string, event: Event): void {
    event.stopPropagation();
    if (!confirm('Deseja realmente remover este relatório do banco de dados?')) {
      return;
    }
    this.api.deleteReport(reportId).subscribe({
      next: () => {
        this.savedReports = this.savedReports.filter(r => r.id !== reportId);
      },
      error: (err) => {
        alert('Erro ao excluir: ' + (err.message || 'Falha na requisição'));
      }
    });
  }

  loadConfig(): void {
    this.api.getConfig().subscribe({
      next: (config) => {
        this.envConfig = config;
      },
      error: () => {
        // Silently ignore config error (backend might not have env loaded or just starting)
      }
    });
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  onAnalyze(request: AnalyzeRequest): void {
    this.stopPolling();
    this.sub?.unsubscribe();
    this.isLoading = true;
    this.errorMessage = null;
    this.lastRequest = request;
    this.titleService.setTitle(`@${request.username} | argos-osint`);

    this.jobLogs = [
      {
        timestamp: new Date().toLocaleTimeString(),
        message: `Iniciando análise para @${request.username} (${request.use_async ? 'Job em segundo plano' : 'Requisição direta'})...`,
        level: 'info'
      }
    ];

    if (request.use_async) {
      this.loadingStatusText = 'Iniciando job em segundo plano (evita timeout HTTP 504)...';
      this.startAsyncAnalysis(request);
    } else {
      this.loadingStatusText = 'Disparando coleta direta no backend...';
      this.startSyncAnalysis(request);
    }
  }

  private startSyncAnalysis(request: AnalyzeRequest): void {
    this.sub = this.api.analyze(request).subscribe({
      next: (res) => {
        this.analysis = res;
        this.isLoading = false;
        this.loadingStatusText = null;
        this.updateDocumentTitle();
        this.fetchSavedReports();
        this.jobLogs.push({
          timestamp: new Date().toLocaleTimeString(),
          message: 'Análise concluída com sucesso! Dashboard gerado.',
          level: 'success'
        });
      },
      error: (err: Error) => {
        this.errorMessage = err.message || 'Falha ao processar análise do perfil.';
        this.isLoading = false;
        this.loadingStatusText = null;
        this.jobLogs.push({
          timestamp: new Date().toLocaleTimeString(),
          message: `Falha na requisição direta: ${this.errorMessage}`,
          level: 'error'
        });
      }
    });
  }

  private startAsyncAnalysis(request: AnalyzeRequest): void {
    this.sub = this.api.analyzeAsync(request).subscribe({
      next: (startRes) => {
        this.activeJobId = startRes.job_id;
        this.loadingStatusText = startRes.progress || 'Análise iniciada em background...';
        this.jobLogs.push({
          timestamp: new Date().toLocaleTimeString(),
          message: `Job ${startRes.job_id} registrado no backend. Aguardando processamento...`,
          level: 'info'
        });
        this.pollJobStatus(startRes.job_id);
      },
      error: (err: Error) => {
        this.errorMessage = err.message || 'Falha ao iniciar job assíncrono.';
        this.isLoading = false;
        this.loadingStatusText = null;
        this.activeJobId = null;
        this.jobLogs.push({
          timestamp: new Date().toLocaleTimeString(),
          message: `Erro ao disparar job assíncrono: ${this.errorMessage}`,
          level: 'error'
        });
      }
    });
  }

  private pollJobStatus(jobId: string): void {
    this.pollTimer = setTimeout(() => {
      this.sub = this.api.getJob(jobId).subscribe({
        next: (job) => {
          this.loadingStatusText = job.progress;
          if (job.logs && job.logs.length > 0) {
            this.jobLogs = job.logs;
          }

          if ((job.status === 'completed' || !!job.result) && job.result) {
            this.analysis = job.result;
            this.isLoading = false;
            this.loadingStatusText = null;
            this.activeJobId = null;
            this.updateDocumentTitle();
            this.fetchSavedReports();
            if (!this.jobLogs.some(l => l.level === 'success')) {
              this.jobLogs.push({
                timestamp: new Date().toLocaleTimeString(),
                message: 'Análise finalizada com sucesso! Dashboard carregado.',
                level: 'success'
              });
            }
          } else if (job.status === 'failed') {
            this.errorMessage = job.error || 'Falha na execução do job em segundo plano.';
            this.isLoading = false;
            this.loadingStatusText = null;
            this.activeJobId = null;
            this.updateDocumentTitle();
          } else if (job.status === 'cancelled') {
            this.errorMessage = 'A análise foi cancelada pelo usuário.';
            this.isLoading = false;
            this.loadingStatusText = null;
            this.activeJobId = null;
            this.updateDocumentTitle();
          } else {
            this.pollJobStatus(jobId);
          }
        },
        error: (err: Error) => {
          this.errorMessage = `Erro ao consultar status da análise: ${err.message}`;
          this.isLoading = false;
          this.loadingStatusText = null;
          this.activeJobId = null;
        }
      });
    }, 1200);
  }

  cancelCurrentJob(): void {
    if (!this.activeJobId) {
      this.isLoading = false;
      this.stopPolling();
      return;
    }
    const jobId = this.activeJobId;
    this.stopPolling();
    this.api.cancelJob(jobId).subscribe({
      next: () => {
        this.isLoading = false;
        this.activeJobId = null;
        this.loadingStatusText = null;
        this.errorMessage = 'Análise cancelada com sucesso.';
        this.jobLogs.push({
          timestamp: new Date().toLocaleTimeString(),
          message: 'Análise cancelada com sucesso pelo usuário.',
          level: 'warning'
        });
      },
      error: () => {
        this.isLoading = false;
        this.activeJobId = null;
        this.loadingStatusText = null;
      }
    });
  }

  copyLogs(): void {
    if (!this.jobLogs || this.jobLogs.length === 0) return;
    const text = this.jobLogs
      .map(l => `[${l.timestamp}] [${(l.level || 'info').toUpperCase()}] ${l.message}`)
      .join('\n');
    navigator.clipboard.writeText(text).then(() => {
      this.copiedLogs = true;
      setTimeout(() => (this.copiedLogs = false), 2000);
    });
  }

  retryWithAsync(): void {
    if (!this.lastRequest) return;
    this.onAnalyze({
      ...this.lastRequest,
      use_async: true
    });
  }

  setActiveTab(tab: ActiveTab): void {
    this.activeTab = tab;
  }
}
