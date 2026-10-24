import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { IconComponent, IconName } from '../ui/icon/icon.component';
import { EntityGraphComponent } from '../ui/entity-graph/entity-graph.component';
import {
  DiscoveredPlatformAccount,
  EntityGraphData,
  GraphEdge,
  GraphNode,
  ArgosAiAssessmentResponse,
  OmniSearchResponse,
  OmniEntityType,
  OsintCaseSummary,
} from '../../models/osint.model';

type EvidenceFilterTab = 'all' | 'corporate' | 'threat' | 'identity' | 'footprint' | 'infra' | 'mentions';

interface LiveClassificationPreview {
  type: OmniEntityType;
  badgeText: string;
  icon: IconName;
  accentColor: string;
  transforms: string[];
}

@Component({
  selector: 'app-osint-explorer',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, EntityGraphComponent],
  template: `
    <div class="osint-container">
      <!-- HERO & CAMPO ÚNICO ESTILO MALTEGO -->
      <header class="omni-hero-card">
        <div class="hero-top-row">
          <div class="osint-badge">
            <app-icon name="shield" [size]="14" customClass="icon-gradient"></app-icon>
            <span>Argos OSINT Suite 100% Open Source • Link Analysis, BrasilAPI/RDAP & Threat Intel</span>
          </div>

          <div class="hero-right-controls">
            <button
              type="button"
              class="btn-cases-drawer"
              (click)="toggleCasesDrawer()">
              <app-icon name="database" [size]="13"></app-icon>
              <span>Casos Salvos ({{ savedCases.length }})</span>
            </button>

            <div class="trail-pills" *ngIf="investigationTrail.length > 0" aria-label="Trilha de investigação">
              <span class="trail-label">Trilha de Pivôs:</span>
              <ng-container *ngFor="let step of investigationTrail; let idx = index; let last = last">
                <button
                  type="button"
                  class="trail-chip"
                  [class.active]="last"
                  (click)="pivotToTarget(step, false)">
                  {{ step }}
                </button>
                <span class="trail-arrow" *ngIf="!last">➔</span>
              </ng-container>
            </div>
          </div>
        </div>

        <!-- GAVETA DE CASOS OSINT PERSISTIDOS NO POSTGRESQL -->
        <div class="cases-drawer" *ngIf="showCasesDrawer">
          <div class="cases-drawer-header">
            <h4><app-icon name="database" [size]="15"></app-icon> Casos de Investigação OSINT (PostgreSQL + Hash Forense SHA-256)</h4>
            <button type="button" class="btn-close-drawer" (click)="showCasesDrawer = false" aria-label="Fechar gaveta de casos">✕</button>
          </div>
          <div class="cases-empty" *ngIf="savedCases.length === 0">
            Nenhum caso OSINT salvo ainda. Toda busca ou expansão de grafo é persistida automaticamente no PostgreSQL.
          </div>
          <div class="cases-grid" *ngIf="savedCases.length > 0">
            <div class="case-card" *ngFor="let c of savedCases">
              <div class="case-card-top">
                <strong>{{ c.root_query }}</strong>
                <span class="case-type-pill">{{ c.entity_type | uppercase }}</span>
              </div>
              <div class="case-card-meta">
                <span>{{ c.total_nodes }} nós • {{ c.total_edges }} conexões</span>
                <span *ngIf="c.pivots_trail?.length">• {{ c.pivots_trail.length }} pivô(s)</span>
              </div>
              <div class="case-card-hash" title="Hash SHA-256 de Cadeia de Custódia Forense">
                SHA-256: <code>{{ c.sha256_hash | slice:0:16 }}...</code>
              </div>
              <div class="case-card-actions">
                <button type="button" class="btn-case-load" (click)="loadSavedCase(c.id)">Abrir Caso</button>
                <button type="button" class="btn-case-del" (click)="deleteSavedCase(c.id, $event)" aria-label="Excluir caso">✕</button>
              </div>
            </div>
          </div>
        </div>

        <h2 class="osint-title">Motor Único de Investigação OSINT & Transformações</h2>
        <p class="osint-subtitle">
          Insira <strong>qualquer dado</strong> em um único campo — <strong>e-mail, número de telefone/WhatsApp, &#64;username, domínio, URL ou nome/CPF/CNPJ</strong>.
          O motor detecta automaticamente a entidade, dispara todas as <em>Transforms</em> em paralelo e monta o grafo interativo de vínculos.
        </p>

        <!-- FORMULÁRIO DE CAMPO ÚNICO (OMNIBOX) -->
        <form class="omni-search-form" (ngSubmit)="runOmniSearch()" novalidate>
          <label for="argosOmniInput" class="sr-only">
            Inserir e-mail, telefone, username, domínio, URL ou nome para investigação OSINT
          </label>

          <div class="omni-input-shell" [style.--omni-accent]="liveClassification.accentColor">
            <!-- Ícone Dinâmico da Entidade Detectada -->
            <div class="omni-detected-pill" [style.borderColor]="liveClassification.accentColor">
              <app-icon [name]="liveClassification.icon" [size]="15"></app-icon>
              <span>{{ liveClassification.badgeText }}</span>
            </div>

            <input
              id="argosOmniInput"
              name="omniQuery"
              type="text"
              class="omni-input"
              [(ngModel)]="omniQuery"
              (keydown)="onOmniKeydown($event)"
              placeholder="Digite e-mail, telefone (+55 11 99999-8888), @username, domínio, URL ou nome..."
              autocomplete="off"
              spellcheck="false"
              required
            />

            <button
              *ngIf="omniQuery"
              type="button"
              class="omni-clear-btn"
              (click)="clearSearch()"
              title="Limpar campo"
              aria-label="Limpar campo de busca">
              <app-icon name="x" [size]="15"></app-icon>
            </button>

            <button
              type="submit"
              class="omni-submit-btn"
              [disabled]="isLoadingOmni || !omniQuery.trim()">
              <app-icon *ngIf="!isLoadingOmni" name="zap" [size]="16"></app-icon>
              <app-icon *ngIf="isLoadingOmni" name="refresh-cw" [size]="16" class="spin"></app-icon>
              <span>{{ isLoadingOmni ? 'Executando Transforms...' : 'Investigar & Gerar Grafo' }}</span>
            </button>
          </div>

          <!-- Barra de Transforms Automáticas Previstas -->
          <div class="transforms-preview-bar">
            <span class="transforms-label">
              <app-icon name="terminal" [size]="13"></app-icon>
              <span>Transforms Automáticas:</span>
            </span>
            <div class="transforms-chips">
              <span class="transform-chip" *ngFor="let tr of liveClassification.transforms">
                ⚡ {{ tr }}
              </span>
            </div>
          </div>

          <!-- Exemplos Rápidos de Entidades em 1 Clique -->
          <div class="presets-bar">
            <span class="presets-title">Testar Entidade:</span>
            <button type="button" class="preset-entity-btn" (click)="tryPreset('00.000.000/0001-91')">
              <app-icon name="briefcase" [size]="12"></app-icon>
              <span>CNPJ (QSA): 00.000.000/0001-91</span>
            </button>
            <button type="button" class="preset-entity-btn" (click)="tryPreset('petrobras.com.br')">
              <app-icon name="globe" [size]="12"></app-icon>
              <span>Domínio .br (RDAP): petrobras.com.br</span>
            </button>
            <button type="button" class="preset-entity-btn" (click)="tryPreset('torvalds@linux-foundation.org')">
              <app-icon name="mail" [size]="12"></app-icon>
              <span>E-mail: torvalds&#64;linux-foundation.org</span>
            </button>
            <button type="button" class="preset-entity-btn" (click)="tryPreset('+55 11 99999-8888')">
              <app-icon name="phone" [size]="12"></app-icon>
              <span>Telefone: +55 11 99999-8888</span>
            </button>
            <button type="button" class="preset-entity-btn" (click)="tryPreset('8.8.8.8')">
              <app-icon name="cpu" [size]="12"></app-icon>
              <span>IP (Shodan DB): 8.8.8.8</span>
            </button>
            <button type="button" class="preset-entity-btn" (click)="tryPreset('@torvalds')">
              <app-icon name="user" [size]="12"></app-icon>
              <span>Username: &#64;torvalds</span>
            </button>
          </div>
        </form>
      </header>

      <!-- PIPELINE DE EXECUÇÃO EM TEMPO REAL -->
      <section class="transform-progress-card" *ngIf="isLoadingOmni" aria-live="polite">
        <div class="progress-top">
          <div class="spinner-ring"></div>
          <div class="progress-info">
            <h3>Executando Motor Maltego para "{{ omniQuery }}"...</h3>
            <p>Disparando coletores assíncronos de pegada digital, infraestrutura DNS/SSL, telefonemas/e-mail e dorking forense.</p>
          </div>
        </div>
        <div class="progress-steps">
          <span class="step-pill active" *ngFor="let tr of liveClassification.transforms">
            <app-icon name="refresh-cw" [size]="12" class="spin"></app-icon>
            <span>{{ tr }}</span>
          </span>
        </div>
      </section>

      <!-- BANNER DE ERRO -->
      <div class="error-banner" *ngIf="errorMessage" role="alert">
        <app-icon name="alert-triangle" [size]="18"></app-icon>
        <div class="error-text">
          <strong>Falha na execução da Transform:</strong>
          <span>{{ errorMessage }}</span>
        </div>
        <button type="button" class="error-close" (click)="errorMessage = null" aria-label="Fechar alerta de erro">✕</button>
      </div>

      <!-- WORKSPACE DE RESULTADOS (GRAFO MALTEGO + PAINÉIS DE EVIDÊNCIA) -->
      <ng-container *ngIf="omniResult && !isLoadingOmni">
        <!-- BARRA DE KPIs E AÇÕES GLOBAIS DO DOSSIÊ -->
        <section class="omni-summary-bar">
          <div class="summary-kpis">
            <div class="summary-kpi-item">
              <span class="kpi-eyebrow">Entidade Alvo</span>
              <strong class="kpi-main">{{ omniResult.target }}</strong>
              <span class="kpi-badge-type">{{ omniResult.entity_label }}</span>
            </div>

            <div class="summary-kpi-item">
              <span class="kpi-eyebrow">Grafo Maltego</span>
              <strong class="kpi-main text-cyan">{{ currentGraphData?.total_nodes || 0 }} nós</strong>
              <small class="kpi-sub">{{ currentGraphData?.total_edges || 0 }} vínculos mapeados</small>
            </div>

            <div class="summary-kpi-item">
              <span class="kpi-eyebrow">Contas / Canais</span>
              <strong class="kpi-main text-emerald">{{ getTotalConfirmedAccounts() }}</strong>
              <small class="kpi-sub">perfis e endpoints ativos</small>
            </div>

            <div class="summary-kpi-item">
              <span class="kpi-eyebrow">Infra & Subdomínios</span>
              <strong class="kpi-main text-indigo">{{ getTotalInfraItems() }}</strong>
              <small class="kpi-sub">DNS, SANs, crt.sh & trackers</small>
            </div>

            <div class="summary-kpi-item">
              <span class="kpi-eyebrow">Menções & Arquivo</span>
              <strong class="kpi-main text-amber">{{ omniResult.total_web_mentions + (omniResult.archive_intelligence?.total_snapshots || 0) }}</strong>
              <small class="kpi-sub">dorks web & Wayback CDX</small>
            </div>
          </div>

          <div class="summary-actions">
            <button
              type="button"
              class="btn-auto-pivot"
              [disabled]="isPivotingNode"
              (click)="runAutoPivotSecondDegree()"
              title="Expande automaticamente os nós mais estratégicos descobertos (2º Grau) e destaca Nós Pontes">
              <app-icon *ngIf="!isPivotingNode" name="network" [size]="15"></app-icon>
              <app-icon *ngIf="isPivotingNode" name="refresh-cw" [size]="15" class="spin"></app-icon>
              <span>{{ isPivotingNode ? 'Auto-Pivotando...' : 'Auto-Pivot 2º Grau (Deep Hunt)' }}</span>
            </button>

            <button
              type="button"
              class="btn-ai-assess"
              [disabled]="isLoadingAiAssessment"
              (click)="runAiAssessment()">
              <app-icon *ngIf="!isLoadingAiAssessment" name="sparkles" [size]="15"></app-icon>
              <app-icon *ngIf="isLoadingAiAssessment" name="refresh-cw" [size]="15" class="spin"></app-icon>
              <span>{{ isLoadingAiAssessment ? 'Analisando OPSEC...' : 'Briefing IA & Risco OPSEC' }}</span>
            </button>

            <button type="button" class="btn-secondary" (click)="persistCurrentCase()">
              <app-icon name="database" [size]="14"></app-icon>
              <span>{{ caseSavedFeedback ? 'Salvo no Postgres ✓' : 'Salvar Caso (SHA-256)' }}</span>
            </button>

            <button type="button" class="btn-secondary" (click)="exportOmniJson()">
              <app-icon name="download" [size]="14"></app-icon>
              <span>JSON</span>
            </button>
          </div>
        </section>

        <!-- BARRA DE CADEIA DE CUSTÓDIA FORENSE (HASH SHA-256 + NOTAS DO ANALISTA) -->
        <section class="custody-bar" *ngIf="omniResult.sha256_hash">
          <div class="custody-left">
            <span class="custody-badge">🔒 CUSTÓDIA FORENSE SHA-256</span>
            <code class="custody-hash">{{ omniResult.sha256_hash }}</code>
          </div>
          <div class="custody-right">
            <input
              type="text"
              class="custody-notes-input"
              [(ngModel)]="analystNotes"
              placeholder="Adicionar nota forense / observação do analista ao Caso no PostgreSQL..."
              aria-label="Nota forense do analista"
            />
            <button type="button" class="btn-save-note" (click)="persistCurrentCase()">Salvar Nota</button>
          </div>
        </section>

        <!-- AVALIAÇÃO EXECUTIVA DE IA (SE SOLICITADA) -->
        <section *ngIf="aiAssessment" class="ai-assessment-card">
          <div class="ai-header">
            <div class="ai-title">
              <app-icon name="shield" [size]="18" customClass="icon-gradient"></app-icon>
              <span>Avaliação de Ameaças, Identidade & OPSEC (IA)</span>
            </div>
            <div class="tlp-badge" [class.amber]="aiAssessment.assessment.tlp_classification === 'TLP:AMBER'" [class.red]="aiAssessment.assessment.tlp_classification === 'TLP:RED'">
              {{ aiAssessment.assessment.tlp_classification }}
            </div>
          </div>

          <div class="ai-kpis">
            <div class="kpi-box">
              <span class="kpi-label">Score de Confiança de Identidade</span>
              <span class="kpi-value">{{ aiAssessment.assessment.identity_confidence_score }}%</span>
            </div>
            <div class="kpi-box">
              <span class="kpi-label">Nível de Risco OPSEC</span>
              <span class="kpi-value risk" [class.high]="aiAssessment.assessment.opsec_risk_level === 'high' || aiAssessment.assessment.opsec_risk_level === 'critical'">
                {{ aiAssessment.assessment.opsec_risk_level | uppercase }}
              </span>
            </div>
          </div>

          <div class="ai-summary">
            <h4>
              <app-icon name="file-text" [size]="14" customClass="icon-cyan"></app-icon>
              <span>Briefing Executivo Estruturado</span>
            </h4>
            <div class="ai-paragraphs-list">
              <div class="ai-paragraph-block" *ngFor="let block of formatAiNarrative(aiAssessment.assessment.executive_summary); let i = index">
                <div class="ai-paragraph-header" *ngIf="block.badge || block.title">
                  <span class="ai-paragraph-badge" *ngIf="block.badge">{{ block.badge }}</span>
                  <strong class="ai-paragraph-title" *ngIf="block.title">{{ block.title }}</strong>
                </div>
                <p class="ai-paragraph-body" [innerHTML]="block.html"></p>
              </div>
            </div>
          </div>

          <div class="ai-columns">
            <div class="ai-vectors" *ngIf="aiAssessment.assessment.exposed_vectors?.length">
              <h4>
                <app-icon name="alert-triangle" [size]="14" customClass="icon-rose"></app-icon>
                <span>Vetores de Exposição Detectados</span>
              </h4>
              <ul class="ai-structured-list">
                <li *ngFor="let vec of aiAssessment.assessment.exposed_vectors">
                  <span class="list-dot danger">!</span>
                  <span [innerHTML]="formatInlineAiText(vec)"></span>
                </li>
              </ul>
            </div>

            <div class="ai-pivots" *ngIf="aiAssessment.assessment.pivot_recommendations?.length">
              <h4>
                <app-icon name="compass" [size]="14" customClass="icon-cyan"></app-icon>
                <span>Recomendações de Pivot Investigativo</span>
              </h4>
              <ul class="ai-structured-list">
                <li *ngFor="let piv of aiAssessment.assessment.pivot_recommendations; let idx = index">
                  <span class="list-dot pivot">{{ idx + 1 }}</span>
                  <span [innerHTML]="formatInlineAiText(piv)"></span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <!-- GRAFO DE VÍNCULOS INTERATIVO (SEMPRE EM DESTAQUE COMO NO MALTEGO) -->
        <section class="graph-stage-section">
          <div class="pivot-loading-banner" *ngIf="isPivotingNode">
            <app-icon name="refresh-cw" [size]="14" class="spin"></app-icon>
            <span>Expandindo Transform no nó <strong>{{ pivotingNodeLabel }}</strong> e mesclando conexões ao grafo...</span>
          </div>

          <app-entity-graph
            *ngIf="currentGraphData"
            [graphData]="currentGraphData"
            (nodePivot)="onGraphNodePivot($event)"
            (graphModified)="onGraphModified($event)">
          </app-entity-graph>
        </section>

        <!-- FILTROS DE CAMADAS DE EVIDÊNCIA (SEM CAMPOS DE BUSCA REPETIDOS) -->
        <nav class="evidence-tabs" role="tablist" aria-label="Camadas de evidência coletadas">
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="activeEvidenceTab === 'all'"
            class="ev-tab-btn"
            [class.active]="activeEvidenceTab === 'all'"
            (click)="activeEvidenceTab = 'all'">
            <app-icon name="sparkles" [size]="15"></app-icon>
            <span>Visão Completa 360°</span>
          </button>

          <button
            type="button"
            role="tab"
            [attr.aria-selected]="activeEvidenceTab === 'corporate'"
            class="ev-tab-btn"
            [class.active]="activeEvidenceTab === 'corporate'"
            (click)="activeEvidenceTab = 'corporate'"
            *ngIf="omniResult.corporate_intelligence?.status === 'success' || omniResult.rdap_intelligence?.status === 'success'">
            <app-icon name="briefcase" [size]="15"></app-icon>
            <span>CNPJ, Sócios (QSA) & RDAP .br ({{ omniResult.corporate_intelligence?.qsa?.length || 0 }})</span>
          </button>

          <button
            type="button"
            role="tab"
            [attr.aria-selected]="activeEvidenceTab === 'threat'"
            class="ev-tab-btn"
            [class.active]="activeEvidenceTab === 'threat'"
            (click)="activeEvidenceTab = 'threat'"
            *ngIf="omniResult.ip_threat_intelligence?.hosts?.length || omniResult.threat_intelligence?.stealers_found || omniResult.threat_intelligence?.breaches_found">
            <app-icon name="shield" [size]="15"></app-icon>
            <span>Threat Intel, Portas & Breaches</span>
          </button>

          <button
            type="button"
            role="tab"
            [attr.aria-selected]="activeEvidenceTab === 'identity'"
            class="ev-tab-btn"
            [class.active]="activeEvidenceTab === 'identity'"
            (click)="activeEvidenceTab = 'identity'"
            *ngIf="omniResult.email_intelligence || omniResult.phone_intelligence || omniResult.bio_intelligence">
            <app-icon name="mail" [size]="15"></app-icon>
            <span>E-mail, Telefone & Bio Links</span>
          </button>

          <button
            type="button"
            role="tab"
            [attr.aria-selected]="activeEvidenceTab === 'footprint'"
            class="ev-tab-btn"
            [class.active]="activeEvidenceTab === 'footprint'"
            (click)="activeEvidenceTab = 'footprint'"
            *ngIf="omniResult.digital_footprint?.all_results?.length">
            <app-icon name="users" [size]="15"></app-icon>
            <span>Pegada Digital ({{ omniResult.digital_footprint?.total_found || 0 }})</span>
          </button>

          <button
            type="button"
            role="tab"
            [attr.aria-selected]="activeEvidenceTab === 'infra'"
            class="ev-tab-btn"
            [class.active]="activeEvidenceTab === 'infra'"
            (click)="activeEvidenceTab = 'infra'"
            *ngIf="omniResult.domain_intelligence || omniResult.subdomains?.subdomains?.length">
            <app-icon name="globe" [size]="15"></app-icon>
            <span>Domínio, SSL & Subdomínios ({{ omniResult.subdomains?.total_unique || 0 }})</span>
          </button>

          <button
            type="button"
            role="tab"
            [attr.aria-selected]="activeEvidenceTab === 'mentions'"
            class="ev-tab-btn"
            [class.active]="activeEvidenceTab === 'mentions'"
            (click)="activeEvidenceTab = 'mentions'">
            <app-icon name="terminal" [size]="15"></app-icon>
            <span>Dorks Web & Wayback ({{ omniResult.total_web_mentions + (omniResult.archive_intelligence?.total_snapshots || 0) }})</span>
          </button>
        </nav>

        <!-- 0A. PAINEL DE INTELIGÊNCIA CORPORATIVA BRASILEIRA (CNPJ, QUADRO SOCIETÁRIO QSA & RDAP .BR) -->
        <section
          class="evidence-section"
          *ngIf="(activeEvidenceTab === 'all' || activeEvidenceTab === 'corporate') && (omniResult.corporate_intelligence?.status === 'success' || omniResult.rdap_intelligence?.status === 'success')">
          <div class="section-header-row">
            <h3>
              <app-icon name="briefcase" [size]="18"></app-icon>
              Inteligência Corporativa Brasileira (Receita Federal / BrasilAPI QSA & RDAP Registro.br)
            </h3>
          </div>

          <!-- RDAP .br Card -->
          <div class="intel-card mb-3" *ngIf="omniResult.rdap_intelligence as rdap">
            <div *ngIf="rdap.status === 'success'">
              <h4><app-icon name="globe" [size]="15"></app-icon> Titularidade Oficial Registro.br (NIC.br RDAP): {{ rdap.domain }}</h4>
              <div class="phone-meta-grid mt-2">
                <div class="meta-box" *ngIf="rdap.owner_name">
                  <span class="meta-label">Entidade / Razão Social Titular</span>
                  <strong>{{ rdap.owner_name }}</strong>
                </div>
                <div class="meta-box" *ngIf="rdap.owner_document">
                  <span class="meta-label">CNPJ / CPF do Titular</span>
                  <strong>{{ rdap.owner_document }}</strong>
                  <button
                    *ngIf="rdap.owner_cnpj_digits"
                    type="button"
                    class="chip-pivot-btn mt-1"
                    (click)="pivotToTarget(rdap.owner_cnpj_digits, true)">
                    ⚡ Expandir CNPJ no Grafo
                  </button>
                </div>
                <div class="meta-box" *ngIf="rdap.owner_email">
                  <span class="meta-label">E-mail Responsável</span>
                  <strong>{{ rdap.owner_email }}</strong>
                </div>
                <div class="meta-box" *ngIf="rdap.created_at">
                  <span class="meta-label">Registro / Expiração</span>
                  <strong>{{ rdap.created_at | slice:0:10 }} → {{ rdap.expires_at | slice:0:10 }}</strong>
                </div>
              </div>
            </div>
          </div>

          <!-- CNPJ & QSA Card -->
          <div *ngIf="omniResult.corporate_intelligence as corp">
            <div *ngIf="corp.status === 'success'">
              <div class="phone-meta-grid">
                <div class="meta-box">
                  <span class="meta-label">Razão Social ({{ corp.formatted_cnpj }})</span>
                  <strong>{{ corp.razao_social }}</strong>
                  <small *ngIf="corp.nome_fantasia" class="text-cyan">Fantasia: {{ corp.nome_fantasia }}</small>
                </div>
                <div class="meta-box">
                  <span class="meta-label">Situação & Abertura</span>
                  <strong class="text-emerald">{{ corp.situacao_cadastral }}</strong>
                  <small class="kpi-sub">Início: {{ corp.data_inicio_atividade || 'N/A' }} • Porte: {{ corp.porte || 'N/A' }}</small>
                </div>
                <div class="meta-box">
                  <span class="meta-label">Capital Social & Natureza</span>
                  <strong>R$ {{ corp.capital_social | number:'1.2-2' }}</strong>
                  <small class="kpi-sub">{{ corp.natureza_juridica }}</small>
                </div>
                <div class="meta-box">
                  <span class="meta-label">Atividade Principal (CNAE)</span>
                  <strong>{{ corp.cnae_principal || 'Não especificada' }}</strong>
                </div>
                <div class="meta-box" *ngIf="corp.endereco?.full_address">
                  <span class="meta-label">Sede / Endereço Fiscal</span>
                  <strong>{{ corp.endereco?.full_address }}</strong>
                </div>
                <div class="meta-box" *ngIf="corp.email || corp.telefones?.length">
                  <span class="meta-label">Contatos Registrados na Receita</span>
                  <strong *ngIf="corp.email">{{ corp.email }}</strong>
                  <small *ngIf="corp.telefones?.length" class="text-cyan">{{ corp.telefones?.join(' • ') }}</small>
                </div>
              </div>

              <!-- Quadro Societário (QSA) -->
              <div class="mt-3" *ngIf="corp.qsa?.length">
                <h4 class="sub-heading">Quadro de Sócios e Administradores — QSA ({{ corp.qsa.length }} integrantes)</h4>
                <div class="footprint-grid">
                  <div class="account-card found" *ngFor="let socio of corp.qsa">
                    <div class="acc-top">
                      <span class="acc-cat">{{ socio.qualificacao }}</span>
                      <span class="acc-status ok">{{ socio.faixa_etaria || 'SÓCIO/ADM' }}</span>
                    </div>
                    <div class="acc-name">{{ socio.nome }}</div>
                    <div class="acc-indicator" *ngIf="socio.documento_mascarado">
                      Doc: {{ socio.documento_mascarado }} <span *ngIf="socio.data_entrada">• Entrada: {{ socio.data_entrada }}</span>
                    </div>
                    <div class="acc-actions">
                      <button
                        type="button"
                        class="acc-pivot-btn"
                        (click)="pivotToTarget(socio.nome, true)"
                        title="Investigar sócio e adicionar conexões ao grafo">
                        ⚡ Pivotar Sócio no Grafo
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 0B. PAINEL DE CYBER THREAT INTEL (SHODAN INTERNETDB PORTAS/CVEs & VAZAMENTOS/INFOSTEALERS) -->
        <section
          class="evidence-section"
          *ngIf="(activeEvidenceTab === 'all' || activeEvidenceTab === 'threat') && (omniResult.ip_threat_intelligence?.hosts?.length || omniResult.threat_intelligence?.stealers_found || omniResult.threat_intelligence?.breaches_found)">
          <div class="section-header-row">
            <h3>
              <app-icon name="shield" [size]="18"></app-icon>
              Cyber Threat Intelligence (Shodan InternetDB, Infostealers HudsonRock & Vazamentos XposedOrNot)
            </h3>
          </div>

          <!-- Shodan InternetDB Hosts (Open Ports & CVEs) -->
          <div class="domain-results-grid" *ngIf="omniResult.ip_threat_intelligence?.hosts?.length">
            <div class="intel-card" *ngFor="let host of omniResult.ip_threat_intelligence?.hosts">
              <h4><app-icon name="cpu" [size]="16"></app-icon> Host IP: {{ host.ip }} ({{ host.ports.length }} portas abertas)</h4>
              <div class="intel-body">
                <div class="sans-tags mb-2" *ngIf="host.ports.length">
                  <span class="san-tag" *ngFor="let p of host.ports">TCP/{{ p }}</span>
                </div>
                <div *ngIf="host.hostnames.length" class="mb-2">
                  <small class="kpi-sub">Hostnames: {{ host.hostnames.join(', ') }}</small>
                </div>
                <div *ngIf="host.cpes.length" class="mb-2">
                  <small class="kpi-sub">Tecnologias (CPE): {{ host.cpes.join(' • ') }}</small>
                </div>
                <div class="sans-box" *ngIf="host.vulns.length">
                  <span class="sans-title text-danger">⚠️ Vulnerabilidades Conhecidas ({{ host.vulns.length }} CVEs):</span>
                  <div class="sans-tags">
                    <a
                      *ngFor="let cve of host.vulns"
                      class="cve-badge"
                      [href]="'https://nvd.nist.gov/vuln/detail/' + cve"
                      target="_blank"
                      rel="noopener noreferrer">
                      {{ cve }} ↗
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Infostealers & Breaches -->
          <div class="mt-3" *ngIf="omniResult.threat_intelligence as ti">
            <div class="intel-card breach-alert-card" *ngIf="ti.stealers_found > 0 || ti.breaches_found > 0">
              <h4>
                🚨 Alerta de Exposição de Credenciais • Risco {{ ti.risk_level }}
                ({{ ti.stealers_found }} Infostealers • {{ ti.breaches_found }} Data Breaches)
              </h4>
              <div class="footprint-grid mt-2" *ngIf="ti.stealers.length">
                <div class="account-card breach-card" *ngFor="let st of ti.stealers">
                  <div class="acc-top">
                    <span class="acc-cat">INFOSTEALER LOG</span>
                    <span class="acc-status danger">{{ st.date_compromised | slice:0:10 }}</span>
                  </div>
                  <div class="acc-name">{{ st.computer_name }} ({{ st.operating_system }})</div>
                  <div class="acc-indicator">Malware: {{ st.malware_path }}</div>
                </div>
              </div>
              <div class="sans-tags mt-2" *ngIf="ti.breaches.length">
                <span class="cve-badge" *ngFor="let br of ti.breaches">🔓 {{ br }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- 1. PAINEL DE TELEFONE / WHATSAPP (SE DETECTADO) -->
        <section
          class="evidence-section"
          *ngIf="(activeEvidenceTab === 'all' || activeEvidenceTab === 'identity') && omniResult.phone_intelligence as phone">
          <div class="section-header-row">
            <h3><app-icon name="phone" [size]="18"></app-icon> Inteligência Telefônica & Mensageria ({{ phone.formatted }})</h3>
            <span class="badge-pill">{{ phone.line_type }}</span>
          </div>

          <div class="domain-results-grid">
            <div class="intel-card">
              <h4>Metadados de Numeração & Geolocalização DDD</h4>
              <div class="intel-kv-list">
                <div class="kv-row"><span>Formato E.164:</span> <code>{{ phone.e164 }}</code></div>
                <div class="kv-row"><span>País / DDI:</span> <strong>{{ phone.country }}</strong></div>
                <div class="kv-row" *ngIf="phone.ddd"><span>DDD / Região:</span> <strong>({{ phone.ddd }}) {{ phone.region }}</strong></div>
                <div class="kv-row"><span>Classificação:</span> <strong>{{ phone.line_type }}</strong></div>
              </div>
            </div>

            <div class="intel-card">
              <h4>Endpoints Diretos de Mensageria</h4>
              <div class="channels-list">
                <div class="channel-row" *ngFor="let ch of phone.channels">
                  <div>
                    <strong>{{ ch.service }}</strong>
                    <p class="channel-ind">{{ ch.indicator }}</p>
                  </div>
                  <a *ngIf="ch.url" [href]="ch.url" target="_blank" rel="noopener noreferrer" class="btn-secondary">
                    Abrir ↗
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 2. PAINEL DE E-MAIL (HOLEHE / GRAVATAR / GITHUB) -->
        <section
          class="evidence-section"
          *ngIf="(activeEvidenceTab === 'all' || activeEvidenceTab === 'identity') && omniResult.email_intelligence as em">
          <div class="section-header-row">
            <h3><app-icon name="mail" [size]="18"></app-icon> Pegada de E-mail Passiva ({{ em.email }})</h3>
            <span class="badge-pill" *ngIf="em.email_hash_md5">MD5 Gravatar: {{ em.email_hash_md5 }}</span>
          </div>

          <div class="accounts-grid">
            <div *ngFor="let item of em.all_results" class="account-card" [class.found]="item.exists">
              <div class="acc-header">
                <span class="acc-platform">{{ item.service }}</span>
                <span class="acc-badge" [class.badge-found]="item.exists">
                  {{ item.exists ? 'CONTA DETECTADA' : 'NÃO REGISTRADO' }}
                </span>
              </div>
              <div class="acc-category">{{ item.indicator }}</div>
              <div class="acc-actions" *ngIf="item.url">
                <a [href]="item.url" target="_blank" rel="noopener noreferrer">Abrir Perfil ↗</a>
              </div>
            </div>
          </div>
        </section>

        <!-- 3. PAINEL DE BIO LINKS & RASTREADORES WEB (GA4 / GTM / PIXEL) -->
        <section
          class="evidence-section"
          *ngIf="(activeEvidenceTab === 'all' || activeEvidenceTab === 'identity' || activeEvidenceTab === 'infra') && omniResult.bio_intelligence as bio">
          <div class="section-header-row" *ngIf="bio.socials?.length || hasAnyTrackers(bio)">
            <h3><app-icon name="external-link" [size]="18"></app-icon> Links Extraídos & Rastreadores de Autoria ({{ bio.final_url || bio.original_url }})</h3>
          </div>

          <div class="domain-results-grid" *ngIf="bio.socials?.length || hasAnyTrackers(bio)">
            <div class="intel-card" *ngIf="bio.socials?.length">
              <h4>Contas Sociais Vinculadas na Página ({{ bio.socials.length }})</h4>
              <div class="subdomains-list">
                <span class="subdomain-chip" *ngFor="let s of bio.socials">
                  <a [href]="s.url" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: none;">
                    {{ s.platform | uppercase }}: {{ s.handle || s.url }} ↗
                  </a>
                  <button
                    type="button"
                    class="inline-pivot-btn"
                    (click)="pivotToTarget(s.handle ? '@' + s.handle : s.url, true)"
                    title="Pivotar e expandir no grafo">
                    ⚡
                  </button>
                </span>
              </div>
            </div>

            <div class="intel-card" *ngIf="hasAnyTrackers(bio)">
              <h4>IDs de Rastreamento e Analytics (Pivô de Autoria)</h4>
              <div class="sans-tags">
                <span class="san-tag" *ngFor="let t of getTrackerPills(bio)">
                  {{ t }}
                </span>
              </div>
            </div>
          </div>
        </section>

        <!-- 4. PAINEL DE PEGADA DIGITAL (100+ PLATAFORMAS) -->
        <section
          class="evidence-section"
          *ngIf="(activeEvidenceTab === 'all' || activeEvidenceTab === 'footprint') && omniResult.digital_footprint as fp">
          <div class="section-header-row">
            <div>
              <h3><app-icon name="users" [size]="18"></app-icon> Pegada Digital de &#64;{{ fp.username }} ({{ fp.total_found }} confirmadas de {{ fp.total_checked }})</h3>
            </div>
            <div class="footprint-toolbar">
              <div class="category-filters">
                <button
                  type="button"
                  class="cat-chip"
                  [class.active]="onlyConfirmedFootprint"
                  (click)="onlyConfirmedFootprint = !onlyConfirmedFootprint">
                  {{ onlyConfirmedFootprint ? '✓ Apenas Confirmadas' : 'Mostrar Todas' }}
                </button>
                <button
                  type="button"
                  class="cat-chip"
                  [class.active]="selectedCategory === 'all'"
                  (click)="selectedCategory = 'all'">
                  Todas
                </button>
                <button
                  type="button"
                  class="cat-chip"
                  [class.active]="selectedCategory === 'tech'"
                  (click)="selectedCategory = 'tech'">
                  Dev & Tech
                </button>
                <button
                  type="button"
                  class="cat-chip"
                  [class.active]="selectedCategory === 'social'"
                  (click)="selectedCategory = 'social'">
                  Social
                </button>
                <button
                  type="button"
                  class="cat-chip"
                  [class.active]="selectedCategory === 'streaming'"
                  (click)="selectedCategory = 'streaming'">
                  Streaming
                </button>
                <button
                  type="button"
                  class="cat-chip"
                  [class.active]="selectedCategory === 'business'"
                  (click)="selectedCategory = 'business'">
                  Negócios
                </button>
              </div>
              <button type="button" class="btn-secondary" (click)="exportFootprintCsv()">
                <app-icon name="download" [size]="14"></app-icon>
                <span>CSV</span>
              </button>
            </div>
          </div>

          <div class="accounts-grid">
            <div
              *ngFor="let acc of getFilteredFootprintAccounts()"
              class="account-card"
              [class.found]="acc.exists">
              <div class="acc-header">
                <span class="acc-platform">{{ acc.name }}</span>
                <span class="acc-badge" [class.badge-found]="acc.exists">
                  {{ acc.exists ? 'CONFIRMADO' : 'NÃO DETECTADO' }}
                </span>
              </div>
              <div class="acc-category">{{ acc.category }}</div>
              <div class="acc-actions" *ngIf="acc.url">
                <a [href]="acc.url" target="_blank" rel="noopener noreferrer">Acessar Perfil ↗</a>
              </div>
            </div>
          </div>
        </section>

        <!-- 5. PAINEL DE DOMÍNIO, DNS, SSL SANs & SUBDOMÍNIOS CRT.SH -->
        <section
          class="evidence-section"
          *ngIf="(activeEvidenceTab === 'all' || activeEvidenceTab === 'infra') && (omniResult.domain_intelligence || omniResult.subdomains)">
          <div class="section-header-row">
            <h3>
              <app-icon name="globe" [size]="18"></app-icon>
              Infraestrutura de Domínio, DNS, SSL & Certificate Transparency ({{ omniResult.domain_intelligence?.domain || omniResult.subdomains?.domain }})
            </h3>
          </div>

          <div *ngIf="omniResult.domain_intelligence as dom" class="domain-results-grid">
            <div class="intel-card">
              <h4><app-icon name="database" [size]="16"></app-icon> Registros DNS Resolvidos (A / MX)</h4>
              <div class="intel-body">
                <div class="record-line" *ngFor="let ip of dom.dns.A">
                  <span class="rec-type">A</span>
                  <code>{{ ip }}</code>
                </div>
                <div class="record-line" *ngFor="let mx of dom.dns.MX">
                  <span class="rec-type">MX</span>
                  <code>{{ mx }}</code>
                </div>
                <div *ngIf="!dom.dns.A?.length && !dom.dns.MX?.length" class="empty-hint">
                  Nenhum registro DNS direto retornado.
                </div>
              </div>
            </div>

            <div class="intel-card">
              <h4><app-icon name="shield" [size]="16"></app-icon> Certificado SSL & Nomes Alternativos (SANs)</h4>
              <div class="intel-body">
                <div class="ssl-status" [class.valid]="dom.ssl_certificate.valid">
                  Status SSL: <strong>{{ dom.ssl_certificate.valid ? 'Válido & Ativo' : 'Inacessível / Sem HTTPS direto' }}</strong>
                </div>
                <div class="sans-box" *ngIf="dom.ssl_certificate.subject_alt_names.length">
                  <span class="sans-title">Domínios Irmãos (SANs):</span>
                  <div class="sans-tags">
                    <span class="san-tag" *ngFor="let san of dom.ssl_certificate.subject_alt_names">
                      {{ san }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div *ngIf="omniResult.subdomains?.subdomains?.length" class="intel-card mt-3">
            <h4>Subdomínios Históricos via crt.sh ({{ omniResult.subdomains?.total_unique }})</h4>
            <div class="subdomains-list">
              <span class="subdomain-chip" *ngFor="let sub of omniResult.subdomains?.subdomains">
                <span>{{ sub }}</span>
                <button
                  type="button"
                  class="inline-pivot-btn"
                  (click)="pivotToTarget(sub, true)"
                  title="Expandir subdomínio no grafo Maltego">
                  ⚡
                </button>
              </span>
            </div>
          </div>
        </section>

        <!-- 6. PAINEL DE DORKS WEB, JUDICIAL, REPUTAÇÃO & WAYBACK MACHINE -->
        <section
          class="evidence-section"
          *ngIf="activeEvidenceTab === 'all' || activeEvidenceTab === 'mentions'">
          <div class="section-header-row" *ngIf="omniResult.web_mentions?.length">
            <h3><app-icon name="terminal" [size]="18"></app-icon> Menções Web, Reputação, Judicial & Documentos ({{ omniResult.total_web_mentions }})</h3>
            <button type="button" class="btn-secondary" (click)="exportMentionsCsv()">
              <app-icon name="download" [size]="14"></app-icon>
              <span>Exportar CSV</span>
            </button>
          </div>

          <div class="cards-list" *ngIf="omniResult.web_mentions?.length">
            <div *ngFor="let item of omniResult.web_mentions" class="result-card">
              <div class="card-meta">
                <span class="preset-tag">{{ item.preset | uppercase }}</span>
                <span class="engine-tag">{{ item.source_engine }}</span>
              </div>
              <h4 class="card-title">
                <a [href]="item.url" target="_blank" rel="noopener noreferrer">
                  {{ item.title || item.url }} ↗
                </a>
              </h4>
              <p class="card-snippet">{{ item.snippet }}</p>
            </div>
          </div>

          <!-- Snapshots da Wayback Machine -->
          <div *ngIf="omniResult.archive_intelligence?.snapshots?.length" class="mt-4">
            <div class="section-header-row">
              <h3><app-icon name="clock" [size]="18"></app-icon> Capturas Forenses na Wayback Machine ({{ omniResult.archive_intelligence?.total_snapshots }})</h3>
              <span class="badge-pill" *ngIf="omniResult.archive_intelligence?.first_seen">
                Primeira captura: {{ omniResult.archive_intelligence?.first_seen }}
              </span>
            </div>
            <div class="timeline-list">
              <div *ngFor="let snap of omniResult.archive_intelligence?.snapshots" class="timeline-item">
                <div class="timeline-date">{{ snap.formatted_date }}</div>
                <div class="timeline-status">HTTP {{ snap.status_code }}</div>
                <a [href]="snap.archive_url" target="_blank" rel="noopener noreferrer" class="btn-secondary">
                  Abrir Versão no Internet Archive ↗
                </a>
              </div>
            </div>
          </div>
        </section>
      </ng-container>
    </div>
  `,
  styles: [`
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .osint-container {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      padding: 0.5rem 0 3rem 0;
      max-width: 1400px;
      margin: 0 auto;
    }

    .omni-hero-card {
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
      background: radial-gradient(circle at 85% 15%, rgba(59, 130, 246, 0.14) 0%, transparent 55%),
                  radial-gradient(circle at 15% 85%, rgba(236, 72, 153, 0.1) 0%, transparent 50%),
                  rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 1.75rem 2rem;
      box-shadow: 0 12px 32px -4px rgba(0, 0, 0, 0.5);
    }

    .hero-top-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .osint-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      background: rgba(59, 130, 246, 0.12);
      border: 1px solid rgba(59, 130, 246, 0.3);
      border-radius: 999px;
      padding: 0.28rem 0.85rem;
      font-size: 0.75rem;
      font-weight: 700;
      color: #60a5fa;
    }

    .trail-pills {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      flex-wrap: wrap;
    }

    .trail-label {
      font-size: 0.72rem;
      color: #94a3b8;
      font-weight: 600;
    }

    .trail-chip {
      background: rgba(30, 41, 59, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #cbd5e1;
      font-size: 0.72rem;
      padding: 0.2rem 0.55rem;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .trail-chip:hover, .trail-chip.active {
      border-color: #38bdf8;
      color: #ffffff;
      background: rgba(56, 189, 248, 0.15);
    }

    .trail-arrow {
      color: #64748b;
      font-size: 0.7rem;
    }

    .osint-title {
      font-size: 1.65rem;
      font-weight: 800;
      color: #ffffff;
      margin: 0;
      letter-spacing: -0.025em;
    }

    .osint-subtitle {
      font-size: 0.92rem;
      color: #94a3b8;
      max-width: 920px;
      margin: 0;
      line-height: 1.5;
    }

    .omni-search-form {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      margin-top: 0.35rem;
    }

    .omni-input-shell {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      background: #070b14;
      border: 2px solid var(--omni-accent, #3b82f6);
      border-radius: 14px;
      padding: 0.45rem 0.55rem 0.45rem 0.85rem;
      box-shadow: 0 0 24px rgba(59, 130, 246, 0.15);
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .omni-input-shell:focus-within {
      box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.22);
    }

    .omni-detected-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.38rem 0.75rem;
      border-radius: 9px;
      background: rgba(30, 41, 59, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #f8fafc;
      font-size: 0.76rem;
      font-weight: 700;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .omni-input {
      flex: 1;
      min-width: 180px;
      background: transparent;
      border: none;
      outline: none;
      color: #ffffff;
      font-size: 1.02rem;
      font-weight: 500;
      padding: 0.45rem 0.25rem;
    }

    .omni-input::placeholder {
      color: #64748b;
      font-weight: 400;
    }

    .omni-clear-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      padding: 0.4rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .omni-clear-btn:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.08);
    }

    .omni-submit-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: linear-gradient(135deg, #4f46e5 0%, #ec4899 100%);
      color: #ffffff;
      border: none;
      border-radius: 10px;
      padding: 0.72rem 1.35rem;
      font-size: 0.9rem;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      transition: transform 0.15s, filter 0.15s;
    }

    .omni-submit-btn:hover:not(:disabled) {
      filter: brightness(1.1);
      transform: translateY(-1px);
    }

    .omni-submit-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .transforms-preview-bar {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      flex-wrap: wrap;
    }

    .transforms-label {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.75rem;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .transforms-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }

    .transform-chip {
      font-size: 0.72rem;
      font-weight: 600;
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.1);
      border: 1px solid rgba(56, 189, 248, 0.25);
      padding: 0.18rem 0.55rem;
      border-radius: 6px;
    }

    .presets-bar {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      flex-wrap: wrap;
      padding-top: 0.25rem;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }

    .presets-title {
      font-size: 0.74rem;
      color: #94a3b8;
      font-weight: 600;
    }

    .preset-entity-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      background: rgba(30, 41, 59, 0.65);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #cbd5e1;
      font-size: 0.73rem;
      padding: 0.28rem 0.65rem;
      border-radius: 999px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .preset-entity-btn:hover {
      background: rgba(59, 130, 246, 0.18);
      border-color: #60a5fa;
      color: #ffffff;
    }

    /* Progress Pipeline */
    .transform-progress-card {
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid rgba(56, 189, 248, 0.35);
      border-radius: 14px;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .progress-top {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .spinner-ring {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 3px solid rgba(56, 189, 248, 0.2);
      border-top-color: #38bdf8;
      animation: spin 0.9s linear infinite;
      flex-shrink: 0;
    }

    .progress-info h3 {
      font-size: 1.05rem;
      color: #ffffff;
      margin: 0 0 0.2rem 0;
    }

    .progress-info p {
      font-size: 0.84rem;
      color: #94a3b8;
      margin: 0;
    }

    .progress-steps {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .step-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.75rem;
      padding: 0.3rem 0.7rem;
      border-radius: 8px;
      background: rgba(56, 189, 248, 0.12);
      border: 1px solid rgba(56, 189, 248, 0.3);
      color: #7dd3fc;
    }

    .error-banner {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background: rgba(244, 63, 94, 0.12);
      border: 1px solid rgba(244, 63, 94, 0.35);
      color: #fda4af;
      padding: 0.9rem 1.2rem;
      border-radius: 12px;
    }

    .error-text {
      flex: 1;
      display: flex;
      gap: 0.4rem;
      flex-wrap: wrap;
      font-size: 0.86rem;
    }

    .error-close {
      background: transparent;
      border: none;
      color: #fda4af;
      cursor: pointer;
    }

    /* Summary Bar */
    .omni-summary-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 1rem;
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.09);
      border-radius: 14px;
      padding: 1.1rem 1.4rem;
    }

    .summary-kpis {
      display: flex;
      align-items: center;
      gap: 1.75rem;
      flex-wrap: wrap;
    }

    .summary-kpi-item {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }

    .kpi-eyebrow {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #94a3b8;
      font-weight: 700;
    }

    .kpi-main {
      font-size: 1.2rem;
      font-weight: 800;
      color: #ffffff;
      font-variant-numeric: tabular-nums;
    }

    .kpi-sub {
      font-size: 0.72rem;
      color: #94a3b8;
    }

    .kpi-badge-type {
      font-size: 0.68rem;
      font-weight: 700;
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.12);
      padding: 0.1rem 0.45rem;
      border-radius: 4px;
      width: fit-content;
    }

    .text-cyan { color: #38bdf8; }
    .text-emerald { color: #34d399; }
    .text-indigo { color: #818cf8; }
    .text-amber { color: #fbbf24; }

    .summary-actions {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      flex-wrap: wrap;
    }

    .btn-ai-assess {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
      color: #ffffff;
      border: none;
      border-radius: 9px;
      padding: 0.58rem 1rem;
      font-size: 0.82rem;
      font-weight: 700;
      cursor: pointer;
    }

    .btn-secondary {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.14);
      color: #e2e8f0;
      border-radius: 8px;
      padding: 0.5rem 0.9rem;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
    }
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.12);
      color: #ffffff;
    }

    .pivot-loading-banner {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(99, 102, 241, 0.16);
      border: 1px solid rgba(99, 102, 241, 0.4);
      color: #c7d2fe;
      padding: 0.6rem 1rem;
      border-radius: 10px;
      font-size: 0.82rem;
      margin-bottom: 0.6rem;
    }

    /* Evidence Filter Tabs */
    .evidence-tabs {
      display: flex;
      gap: 0.45rem;
      flex-wrap: wrap;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding-bottom: 0.65rem;
    }

    .ev-tab-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      background: rgba(30, 41, 59, 0.55);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #94a3b8;
      padding: 0.5rem 0.95rem;
      border-radius: 9px;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }
    .ev-tab-btn:hover {
      color: #ffffff;
      background: rgba(51, 65, 85, 0.75);
    }
    .ev-tab-btn.active {
      background: #3b82f6;
      border-color: #3b82f6;
      color: #ffffff;
    }

    .evidence-section {
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
    }

    .section-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .section-header-row h3 {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 1.05rem;
      font-weight: 700;
      color: #ffffff;
      margin: 0;
    }

    .badge-pill {
      font-size: 0.74rem;
      font-weight: 600;
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.12);
      border: 1px solid rgba(56, 189, 248, 0.25);
      padding: 0.22rem 0.65rem;
      border-radius: 999px;
    }

    .footprint-toolbar {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      flex-wrap: wrap;
    }

    .category-filters {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      flex-wrap: wrap;
    }

    .cat-chip {
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #94a3b8;
      font-size: 0.72rem;
      padding: 0.28rem 0.6rem;
      border-radius: 6px;
      cursor: pointer;
    }
    .cat-chip.active {
      background: #3b82f6;
      border-color: #3b82f6;
      color: #ffffff;
      font-weight: 600;
    }

    .accounts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 0.75rem;
    }

    .account-card {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      background: rgba(30, 41, 59, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 10px;
      padding: 0.85rem;
      opacity: 0.7;
    }

    .account-card.found {
      opacity: 1;
      border-color: rgba(59, 130, 246, 0.45);
      background: rgba(30, 41, 59, 0.85);
    }

    .acc-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .acc-platform {
      font-size: 0.85rem;
      font-weight: 700;
      color: #ffffff;
    }

    .acc-badge {
      font-size: 0.62rem;
      font-weight: 700;
      color: #94a3b8;
      background: rgba(255, 255, 255, 0.06);
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
    }

    .acc-badge.badge-found {
      background: rgba(16, 185, 129, 0.16);
      color: #34d399;
    }

    .acc-category {
      font-size: 0.73rem;
      color: #94a3b8;
    }

    .acc-actions a {
      font-size: 0.74rem;
      color: #60a5fa;
      text-decoration: none;
      font-weight: 600;
    }

    .domain-results-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 1rem;
    }

    .intel-card {
      background: rgba(30, 41, 59, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 1.2rem;
    }

    .intel-card h4 {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.92rem;
      color: #ffffff;
      margin: 0 0 0.75rem 0;
    }

    .intel-kv-list {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
      font-size: 0.83rem;
    }

    .kv-row {
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
      color: #94a3b8;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      padding-bottom: 0.35rem;
    }

    .channels-list {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }

    .channel-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .channel-ind {
      font-size: 0.75rem;
      color: #94a3b8;
      margin: 0.15rem 0 0 0;
    }

    .record-line {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      font-size: 0.82rem;
      margin-bottom: 0.4rem;
    }

    .rec-type {
      background: rgba(59, 130, 246, 0.2);
      color: #60a5fa;
      padding: 0.1rem 0.4rem;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 700;
    }

    .sans-tags, .subdomains-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin-top: 0.4rem;
    }

    .san-tag {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #cbd5e1;
      font-size: 0.73rem;
      padding: 0.22rem 0.55rem;
      border-radius: 5px;
    }

    .subdomain-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.28);
      color: #34d399;
      font-size: 0.75rem;
      padding: 0.22rem 0.55rem;
      border-radius: 6px;
    }

    .inline-pivot-btn {
      background: rgba(255, 255, 255, 0.08);
      border: none;
      color: #fbbf24;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.7rem;
      padding: 0 0.28rem;
    }
    .inline-pivot-btn:hover {
      background: rgba(251, 191, 36, 0.25);
    }

    .cards-list {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
      gap: 0.85rem;
    }

    .result-card {
      background: rgba(30, 41, 59, 0.45);
      border: 1px solid rgba(255, 255, 255, 0.07);
      border-radius: 10px;
      padding: 1rem;
    }

    .card-meta {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.4rem;
    }

    .preset-tag {
      background: rgba(59, 130, 246, 0.2);
      color: #60a5fa;
      font-size: 0.68rem;
      padding: 0.1rem 0.4rem;
      border-radius: 4px;
      font-weight: 700;
    }

    .engine-tag {
      font-size: 0.68rem;
      color: #94a3b8;
    }

    .card-title a {
      color: #ffffff;
      text-decoration: none;
      font-size: 0.92rem;
    }
    .card-title a:hover {
      color: #38bdf8;
    }

    .card-snippet {
      font-size: 0.8rem;
      color: #94a3b8;
      margin: 0.4rem 0 0 0;
      line-height: 1.45;
    }

    .timeline-list {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
    }

    .timeline-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(30, 41, 59, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.07);
      border-radius: 8px;
      padding: 0.6rem 1rem;
      font-size: 0.82rem;
    }

    .ai-assessment-card {
      background: linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%);
      border: 1px solid rgba(99, 102, 241, 0.4);
      border-radius: 14px;
      padding: 1.4rem;
    }

    .ai-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .ai-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 1.05rem;
      font-weight: 700;
      color: #ffffff;
    }

    .tlp-badge {
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.2rem 0.6rem;
      border-radius: 6px;
      background: #3b82f6;
      color: #ffffff;
    }
    .tlp-badge.amber {
      background: #f59e0b;
      color: #000000;
    }
    .tlp-badge.red {
      background: #ef4444;
      color: #ffffff;
    }

    .ai-kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 1.1rem;
    }

    .kpi-box {
      background: rgba(15, 23, 42, 0.65);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 0.8rem 1rem;
    }

    .kpi-label {
      font-size: 0.72rem;
      color: #94a3b8;
      display: block;
      margin-bottom: 0.2rem;
    }

    .kpi-value {
      font-size: 1.35rem;
      font-weight: 700;
      color: #38bdf8;
    }
    .kpi-value.risk.high {
      color: #f43f5e;
    }

    .ai-summary {
      margin-bottom: 1.1rem;
    }

    .ai-summary h4, .ai-vectors h4, .ai-pivots h4 {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      font-size: 0.88rem;
      font-weight: 700;
      color: #f8fafc;
      margin: 0 0 0.65rem 0;
    }

    .ai-paragraphs-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .ai-paragraph-block {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(148, 163, 184, 0.14);
      border-left: 3px solid #6366f1;
      border-radius: 10px;
      padding: 0.85rem 1rem;
    }

    .ai-paragraph-block:nth-child(2) {
      border-left-color: #38bdf8;
    }

    .ai-paragraph-block:nth-child(3) {
      border-left-color: #f59e0b;
    }

    .ai-paragraph-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.4rem;
    }

    .ai-paragraph-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0.68rem;
      font-weight: 800;
      padding: 0.12rem 0.45rem;
      border-radius: 5px;
      background: rgba(99, 102, 241, 0.2);
      color: #a5b4fc;
      border: 1px solid rgba(99, 102, 241, 0.35);
    }

    .ai-paragraph-title {
      font-size: 0.82rem;
      font-weight: 700;
      color: #f1f5f9;
      letter-spacing: 0.01em;
    }

    .ai-paragraph-body {
      font-size: 0.85rem;
      color: #cbd5e1;
      line-height: 1.68;
      margin: 0;
    }

    .ai-columns {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1rem;
      margin-top: 0.85rem;
    }

    .ai-vectors, .ai-pivots {
      background: rgba(15, 23, 42, 0.5);
      border: 1px solid rgba(148, 163, 184, 0.12);
      border-radius: 10px;
      padding: 0.9rem 1rem;
    }

    .ai-structured-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
    }

    .ai-structured-list li {
      display: flex;
      align-items: flex-start;
      gap: 0.55rem;
      font-size: 0.82rem;
      color: #cbd5e1;
      line-height: 1.55;
    }

    .list-dot {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      font-size: 0.68rem;
      font-weight: 800;
      flex-shrink: 0;
      margin-top: 0.1rem;
    }

    .list-dot.danger {
      background: rgba(244, 63, 94, 0.18);
      color: #fb7185;
      border: 1px solid rgba(244, 63, 94, 0.4);
    }

    .list-dot.pivot {
      background: rgba(56, 189, 248, 0.16);
      color: #38bdf8;
      border: 1px solid rgba(56, 189, 248, 0.35);
    }

    .mt-1 { margin-top: 0.35rem; }
    .mt-2 { margin-top: 0.55rem; }
    .mt-3 { margin-top: 0.85rem; }
    .mt-4 { margin-top: 1.25rem; }
    .mb-2 { margin-bottom: 0.55rem; }
    .mb-3 { margin-bottom: 0.85rem; }
    .text-danger { color: #f87171; }

    .hero-right-controls {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      flex-wrap: wrap;
    }

    .btn-cases-drawer {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: rgba(99, 102, 241, 0.16);
      border: 1px solid rgba(99, 102, 241, 0.4);
      color: #c7d2fe;
      border-radius: 999px;
      padding: 0.28rem 0.75rem;
      font-size: 0.75rem;
      font-weight: 700;
      cursor: pointer;
    }
    .btn-cases-drawer:hover {
      background: rgba(99, 102, 241, 0.28);
      color: #fff;
    }

    .cases-drawer {
      background: rgba(15, 23, 42, 0.92);
      border: 1px solid rgba(99, 102, 241, 0.35);
      border-radius: 12px;
      padding: 0.9rem 1.1rem;
      margin-bottom: 1rem;
    }

    .cases-drawer-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.7rem;
    }
    .cases-drawer-header h4 {
      margin: 0;
      font-size: 0.86rem;
      color: #e2e8f0;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .btn-close-drawer {
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      font-size: 0.9rem;
    }

    .cases-empty {
      font-size: 0.8rem;
      color: #94a3b8;
    }

    .cases-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 0.65rem;
    }

    .case-card {
      background: rgba(30, 41, 59, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 9px;
      padding: 0.65rem 0.8rem;
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }

    .case-card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.84rem;
      color: #fff;
    }

    .case-type-pill {
      font-size: 0.64rem;
      font-weight: 800;
      background: rgba(56, 189, 248, 0.15);
      color: #38bdf8;
      padding: 0.08rem 0.4rem;
      border-radius: 4px;
    }

    .case-card-meta, .case-card-hash {
      font-size: 0.72rem;
      color: #94a3b8;
    }

    .case-card-actions {
      display: flex;
      gap: 0.4rem;
      margin-top: 0.25rem;
    }

    .btn-case-load {
      flex: 1;
      background: #4f46e5;
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 0.3rem 0.5rem;
      font-size: 0.74rem;
      font-weight: 700;
      cursor: pointer;
    }

    .btn-case-del {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.35);
      color: #fca5a5;
      border-radius: 6px;
      padding: 0.3rem 0.5rem;
      font-size: 0.74rem;
      cursor: pointer;
    }

    .btn-auto-pivot {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff;
      border: none;
      border-radius: 9px;
      padding: 0.58rem 1rem;
      font-size: 0.82rem;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 3px 12px rgba(16, 185, 129, 0.25);
    }
    .btn-auto-pivot:hover:not(:disabled) {
      filter: brightness(1.08);
    }

    .custody-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.75rem;
      background: rgba(15, 23, 42, 0.88);
      border: 1px solid rgba(16, 185, 129, 0.35);
      border-radius: 10px;
      padding: 0.55rem 1rem;
    }

    .custody-left {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      flex-wrap: wrap;
    }

    .custody-badge {
      font-size: 0.68rem;
      font-weight: 800;
      background: rgba(16, 185, 129, 0.18);
      color: #34d399;
      padding: 0.15rem 0.5rem;
      border-radius: 5px;
    }

    .custody-hash {
      font-size: 0.74rem;
      color: #94a3b8;
      word-break: break-all;
    }

    .custody-right {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      flex: 1;
      min-width: 260px;
      max-width: 480px;
    }

    .custody-notes-input {
      flex: 1;
      background: rgba(30, 41, 59, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.14);
      color: #fff;
      border-radius: 6px;
      padding: 0.35rem 0.65rem;
      font-size: 0.76rem;
    }

    .btn-save-note {
      background: rgba(59, 130, 246, 0.22);
      border: 1px solid rgba(59, 130, 246, 0.45);
      color: #93c5fd;
      border-radius: 6px;
      padding: 0.35rem 0.7rem;
      font-size: 0.75rem;
      font-weight: 700;
      cursor: pointer;
    }

    .cve-badge {
      display: inline-flex;
      align-items: center;
      background: rgba(239, 68, 68, 0.18);
      border: 1px solid rgba(239, 68, 68, 0.45);
      color: #fca5a5;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.18rem 0.5rem;
      border-radius: 5px;
      text-decoration: none;
    }
    .cve-badge:hover {
      background: rgba(239, 68, 68, 0.32);
      color: #fff;
    }

    .breach-alert-card {
      border-color: rgba(239, 68, 68, 0.45) !important;
      background: rgba(127, 29, 29, 0.16) !important;
    }

    .breach-card {
      border-color: rgba(239, 68, 68, 0.4) !important;
    }

    .acc-status.danger {
      background: rgba(239, 68, 68, 0.25);
      color: #fca5a5;
      font-size: 0.68rem;
      padding: 0.1rem 0.4rem;
      border-radius: 4px;
      font-weight: 700;
    }

    .spin {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      100% { transform: rotate(360deg); }
    }

    @media (max-width: 768px) {
      .omni-input-shell {
        flex-wrap: wrap;
      }
      .omni-submit-btn {
        width: 100%;
        justify-content: center;
      }
    }
  `]
})
export class OsintExplorerComponent implements OnInit {
  private readonly api = inject(ApiService);

  omniQuery = '';
  isLoadingOmni = false;
  isPivotingNode = false;
  pivotingNodeLabel = '';
  errorMessage: string | null = null;

  omniResult: OmniSearchResponse | null = null;
  currentGraphData: EntityGraphData | null = null;
  investigationTrail: string[] = [];

  savedCases: OsintCaseSummary[] = [];
  showCasesDrawer = false;
  analystNotes = '';
  caseSavedFeedback = false;

  activeEvidenceTab: EvidenceFilterTab = 'all';
  selectedCategory = 'all';
  onlyConfirmedFootprint = true;

  isLoadingAiAssessment = false;
  aiAssessment: ArgosAiAssessmentResponse | null = null;

  ngOnInit(): void {
    this.fetchSavedCases();
  }

  toggleCasesDrawer(): void {
    this.showCasesDrawer = !this.showCasesDrawer;
    if (this.showCasesDrawer) {
      this.fetchSavedCases();
    }
  }

  fetchSavedCases(): void {
    this.api.listOsintCases(30).subscribe({
      next: (cases) => {
        this.savedCases = cases || [];
      },
      error: () => {
        // Silencia se o banco estiver iniciando
      },
    });
  }

  loadSavedCase(caseId: string): void {
    this.isLoadingOmni = true;
    this.showCasesDrawer = false;
    this.api.getOsintCaseById(caseId).subscribe({
      next: (res) => {
        this.omniResult = res;
        this.omniQuery = res.query || res.target;
        this.currentGraphData = res.entity_graph || null;
        this.investigationTrail = res.pivots_trail || [res.target];
        this.analystNotes = res.analyst_notes || '';
        this.isLoadingOmni = false;
      },
      error: (err: Error) => {
        this.errorMessage = err.message || 'Não foi possível carregar o Caso OSINT.';
        this.isLoadingOmni = false;
      },
    });
  }

  deleteSavedCase(caseId: string, event: Event): void {
    event.stopPropagation();
    this.api.deleteOsintCase(caseId).subscribe({
      next: () => {
        this.savedCases = this.savedCases.filter(c => c.id !== caseId);
      },
    });
  }

  persistCurrentCase(): void {
    if (!this.omniResult) return;
    if (this.currentGraphData) {
      this.omniResult.entity_graph = this.currentGraphData;
    }
    this.api.saveOsintCase({
      case_id: this.omniResult.case_id,
      pivots_trail: this.investigationTrail,
      analyst_notes: this.analystNotes,
      case_data: this.omniResult,
    }).subscribe({
      next: (summary) => {
        if (this.omniResult) {
          this.omniResult.case_id = summary.id;
          this.omniResult.sha256_hash = summary.sha256_hash;
        }
        this.caseSavedFeedback = true;
        this.fetchSavedCases();
        setTimeout(() => (this.caseSavedFeedback = false), 2500);
      },
    });
  }

  onGraphModified(updatedGraph: EntityGraphData): void {
    this.currentGraphData = updatedGraph;
    this.persistCurrentCase();
  }

  /**
   * Auto-Pivot de 2º Grau (Deep Hunt): seleciona até 2 nós de alto valor
   * descobertos no grafo (ex: Sócio QSA, CNPJ de RDAP .br, domínio corporativo ou conta social)
   * e expande automaticamente suas conexões mesclando no grafo!
   */
  runAutoPivotSecondDegree(): void {
    if (!this.currentGraphData || this.isPivotingNode) return;

    const alreadyVisited = new Set(this.investigationTrail.map(s => s.toLowerCase()));
    const candidates = this.currentGraphData.nodes.filter(n => {
      if (n.type === 'target' || n.type === 'mention') return false;
      const pq = String(n.metadata?.['pivot_query'] || '').trim();
      return pq.length >= 3 && !alreadyVisited.has(pq.toLowerCase());
    });

    // Prioriza Sócios QSA / Empresas CNPJ -> Domínios -> E-mails -> Contas Sociais
    const priorityOrder: Record<string, number> = {
      person: 1,
      company: 2,
      domain: 3,
      email: 4,
      social_account: 5,
      social_link: 6,
      tracker: 7,
    };
    candidates.sort((a, b) => (priorityOrder[a.type] || 9) - (priorityOrder[b.type] || 9));

    const topPivots = candidates.slice(0, 2);
    if (topPivots.length === 0) return;

    this.isPivotingNode = true;
    const pivotLabels = topPivots.map(n => String(n.metadata?.['pivot_query'])).join(' + ');
    this.pivotingNodeLabel = pivotLabels;

    let completed = 0;
    for (const node of topPivots) {
      const pq = String(node.metadata?.['pivot_query']).trim();
      if (!this.investigationTrail.includes(pq)) {
        this.investigationTrail = [...this.investigationTrail.slice(-6), pq];
      }
      this.api.omniSearch(pq, this.omniResult?.case_id, false).subscribe({
        next: (res) => {
          if (this.currentGraphData && res.entity_graph) {
            this.currentGraphData = this.mergeGraphs(this.currentGraphData, res.entity_graph);
          }
          completed++;
          if (completed >= topPivots.length) {
            this.isPivotingNode = false;
            this.persistCurrentCase();
          }
        },
        error: () => {
          completed++;
          if (completed >= topPivots.length) {
            this.isPivotingNode = false;
          }
        },
      });
    }
  }

  /**
   * Classifica o texto digitado em tempo real para exibir qual tipo de entidade
   * e quais Transforms Open-Source serão acionadas.
   */
  get liveClassification(): LiveClassificationPreview {
    const q = (this.omniQuery || '').trim();
    if (!q) {
      return {
        type: 'unknown',
        badgeText: 'Auto-Detecção',
        icon: 'sparkles',
        accentColor: '#3b82f6',
        transforms: [
          'CNPJ & Sócios QSA (BrasilAPI)',
          'RDAP Registro.br',
          'Shodan InternetDB (Portas & CVEs)',
          'HudsonRock & XposedOrNot Breaches',
          'Holehe E-mail & DDD WhatsApp',
          'Grafo Open-Source & GraphML',
        ],
      };
    }

    const digits = q.replace(/\D/g, '');

    // 1. E-mail
    if (/^[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}$/.test(q)) {
      return {
        type: 'email',
        badgeText: 'E-mail',
        icon: 'mail',
        accentColor: '#f59e0b',
        transforms: [
          'Holehe Account Check',
          'HudsonRock Infostealers & XposedOrNot',
          'Gravatar MD5 & GitHub',
          'Pivô de @Username & Domínio',
          'Dorks de Vazamento',
        ],
      };
    }

    // 2. IPv4
    if (/^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/.test(q)) {
      return {
        type: 'ip',
        badgeText: 'Endereço IP',
        icon: 'cpu',
        accentColor: '#ef4444',
        transforms: [
          'Shodan InternetDB (Portas TCP)',
          'Tecnologias (CPEs) & Hostnames',
          'Vulnerabilidades (CVEs NVD)',
          'Threat & Exposure Dorks',
        ],
      };
    }

    // 3. CNPJ Brasileiro
    const isFormattedCnpj = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(q);
    const isRawCnpj = digits.length === 14 && !q.startsWith('+') && (q.includes('/') || digits.slice(8, 11) === '000');
    if (isFormattedCnpj || isRawCnpj) {
      return {
        type: 'cnpj',
        badgeText: 'CNPJ / Empresa (QSA)',
        icon: 'briefcase',
        accentColor: '#a855f7',
        transforms: [
          'BrasilAPI / ReceitaWS (Razão & Capital)',
          'Quadro de Sócios (QSA Pivotável)',
          'Sede Fiscal / CEP & Telefones',
          'Diário Oficial & Jusbrasil Dorks',
        ],
      };
    }

    // 4. CPF Formatado
    if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(q)) {
      return {
        type: 'cpf',
        badgeText: 'CPF / Pessoa Física',
        icon: 'user',
        accentColor: '#a855f7',
        transforms: [
          'Diários Oficiais (DOU / Estados)',
          'Processos Judiciais (Jusbrasil / Escavador)',
          'Portal da Transparência & Sócios',
        ],
      };
    }

    // 5. URL
    if (/^https?:\/\//i.test(q) || /^(www\.|linktr\.ee\/|beacons\.ai\/|instagram\.com\/|x\.com\/|github\.com\/)/i.test(q)) {
      return {
        type: 'url',
        badgeText: 'URL / Bio',
        icon: 'external-link',
        accentColor: '#ec4899',
        transforms: [
          'Extrator de Redes & Links',
          'Trackers (GA4 / GTM / Pixel)',
          'Wayback Time Machine CDX',
          'Inspeção de Domínio & SSL',
          'Pivô de @Handle',
        ],
      };
    }

    // 6. Telefone / WhatsApp
    if (/^[+\d()\s.-]{8,24}$/.test(q) && digits.length >= 8 && digits.length <= 15) {
      return {
        type: 'phone',
        badgeText: 'Telefone / WhatsApp',
        icon: 'phone',
        accentColor: '#10b981',
        transforms: [
          'Normalização E.164 & DDI',
          'Geolocalização por DDD (Brasil)',
          'Endpoints WhatsApp & Telegram',
          'Dorks de Exposição Telefônica',
        ],
      };
    }

    // 7. Domínio
    if (!q.startsWith('@') && !q.includes(' ') && /^(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(q)) {
      const isBr = q.toLowerCase().endsWith('.br');
      return {
        type: 'domain',
        badgeText: isBr ? 'Domínio .BR (RDAP)' : 'Domínio',
        icon: 'globe',
        accentColor: '#10b981',
        transforms: isBr
          ? [
              'RDAP Registro.br (Titular & CNPJ)',
              'Auto-Pivot QSA Sócios do CNPJ',
              'Shodan InternetDB (Portas & CVEs)',
              'DNS / SSL SANs & Subdomínios crt.sh',
              'HudsonRock Domain Stealers',
            ]
          : [
              'DNS (A / MX) & Certificados SSL',
              'Shodan InternetDB (Portas & CVEs)',
              'Subdomínios crt.sh & SANs',
              'HudsonRock Domain Stealers',
              'Wayback Machine CDX',
            ],
      };
    }

    // 8. Username
    if (q.startsWith('@') || (!q.includes(' ') && /^[a-zA-Z0-9_.-]{2,40}$/.test(q))) {
      return {
        type: 'username',
        badgeText: 'Username',
        icon: 'user',
        accentColor: '#6366f1',
        transforms: [
          'Varredura em 100+ Plataformas',
          'HudsonRock Infostealer Check',
          'Auto-Resolver Linktree / Bio',
          'Dorks de Reputação & Imprensa',
        ],
      };
    }

    // 9. Pessoa / Marca / Documento
    return {
      type: 'entity',
      badgeText: 'Entidade / Nome',
      icon: 'briefcase',
      accentColor: '#8b5cf6',
      transforms: [
        'Dorks de Reputação & Reclame Aqui',
        'Processos & Jusbrasil / DOU',
        'Imprensa & Mídia Kit (PDF)',
        'Pegada Digital de Handle',
      ],
    };
  }

  /**
   * Previne submissão prematura durante composição de caracteres via IME (WebKit/Safari keyCode 229).
   */
  onOmniKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      if (event.isComposing || event.keyCode === 229) {
        event.preventDefault();
        return;
      }
    }
  }

  tryPreset(value: string): void {
    this.omniQuery = value;
    this.runOmniSearch();
  }

  clearSearch(): void {
    this.omniQuery = '';
    this.errorMessage = null;
  }

  runOmniSearch(expandGraph = false): void {
    const q = this.omniQuery.trim();
    if (!q) return;

    this.errorMessage = null;
    this.aiAssessment = null;

    if (!this.investigationTrail.includes(q)) {
      this.investigationTrail = [...this.investigationTrail.slice(-5), q];
    }

    if (expandGraph && this.currentGraphData) {
      this.isPivotingNode = true;
      this.pivotingNodeLabel = q;
    } else {
      this.isLoadingOmni = true;
      this.activeEvidenceTab = 'all';
    }

    this.api.omniSearch(q, expandGraph ? this.omniResult?.case_id : undefined).subscribe({
      next: (res) => {
        if (expandGraph && this.currentGraphData && res.entity_graph) {
          this.currentGraphData = this.mergeGraphs(this.currentGraphData, res.entity_graph);
          this.omniResult = {
            ...res,
            case_id: this.omniResult?.case_id || res.case_id,
            entity_graph: this.currentGraphData,
          };
          this.persistCurrentCase();
        } else {
          this.omniResult = res;
          this.currentGraphData = res.entity_graph || null;
          this.analystNotes = res.analyst_notes || '';
          this.fetchSavedCases();
        }
        this.isLoadingOmni = false;
        this.isPivotingNode = false;
      },
      error: (err: Error) => {
        this.errorMessage = err.message || 'Falha ao executar Transforms para o alvo informado.';
        this.isLoadingOmni = false;
        this.isPivotingNode = false;
      }
    });
  }

  pivotToTarget(targetQuery: string, expand: boolean): void {
    if (!targetQuery) return;
    this.omniQuery = targetQuery;
    this.runOmniSearch(expand);
  }

  onGraphNodePivot(event: { query: string; expand: boolean; node: GraphNode }): void {
    this.pivotToTarget(event.query, event.expand);
  }

  private mergeGraphs(base: EntityGraphData, incoming: EntityGraphData): EntityGraphData {
    const nodeMap = new Map<string, GraphNode>();
    for (const n of base.nodes) {
      nodeMap.set(n.id, { ...n });
    }
    for (const n of incoming.nodes) {
      if (!nodeMap.has(n.id)) {
        const mergedType = n.type === 'target' && n.id !== `target_${base.target.toLowerCase()}` ? 'social_account' : n.type;
        nodeMap.set(n.id, { ...n, type: mergedType });
      } else {
        // Nó já existia no grafo anterior -> é um Nó Ponte entre dois alvos!
        const existing = nodeMap.get(n.id)!;
        if (existing.type !== 'target') {
          existing.bridge = true;
        }
      }
    }

    const edgeKeys = new Set<string>();
    const mergedEdges: GraphEdge[] = [];
    for (const e of [...base.edges, ...incoming.edges]) {
      const key = `${e.source}->${e.target}:${e.relationship}`;
      if (!edgeKeys.has(key)) {
        edgeKeys.add(key);
        mergedEdges.push({ ...e });
      }
    }

    const baseRootId = base.nodes.find(n => n.type === 'target')?.id;
    const incomingRootId = incoming.nodes.find(n => n.type === 'target')?.id;
    if (baseRootId && incomingRootId && baseRootId !== incomingRootId) {
      const pivotEdgeKey = `${baseRootId}->${incomingRootId}:pivoted_to`;
      if (!edgeKeys.has(pivotEdgeKey)) {
        mergedEdges.push({
          source: baseRootId,
          target: incomingRootId,
          relationship: 'pivoted_to',
          weight: 1.5,
        });
      }
    }

    const nodes = Array.from(nodeMap.values());
    const degreeMap = new Map<string, number>();
    for (const e of mergedEdges) {
      degreeMap.set(e.source, (degreeMap.get(e.source) || 0) + 1);
      degreeMap.set(e.target, (degreeMap.get(e.target) || 0) + 1);
    }
    for (const n of nodes) {
      n.degree = degreeMap.get(n.id) || 1;
      if (n.degree >= 2 && n.type !== 'target') {
        n.bridge = true;
      }
    }

    return {
      target: base.target,
      total_nodes: nodes.length,
      total_edges: mergedEdges.length,
      nodes,
      edges: mergedEdges,
    };
  }

  getTotalConfirmedAccounts(): number {
    if (!this.omniResult) return 0;
    const fpCount = this.omniResult.digital_footprint?.total_found || 0;
    const emCount = this.omniResult.email_intelligence?.total_found || 0;
    const phCount = this.omniResult.phone_intelligence?.channels?.length || 0;
    const bioCount = this.omniResult.bio_intelligence?.socials?.length || 0;
    const qsaCount = this.omniResult.corporate_intelligence?.qsa?.length || 0;
    return fpCount + emCount + phCount + bioCount + qsaCount;
  }

  getTotalInfraItems(): number {
    if (!this.omniResult) return 0;
    const subs = this.omniResult.subdomains?.total_unique || 0;
    const dnsA = this.omniResult.domain_intelligence?.dns?.A?.length || 0;
    const sans = this.omniResult.domain_intelligence?.ssl_certificate?.subject_alt_names?.length || 0;
    const trackers = this.getTrackerPills(this.omniResult.bio_intelligence).length;
    const shodanPorts = this.omniResult.ip_threat_intelligence?.total_open_ports || 0;
    return subs + dnsA + sans + trackers + shodanPorts;
  }

  hasAnyTrackers(bio: any): boolean {
    return this.getTrackerPills(bio).length > 0;
  }

  getTrackerPills(bio: any): string[] {
    if (!bio?.trackers) return [];
    const pills: string[] = [];
    for (const [k, list] of Object.entries(bio.trackers)) {
      if (Array.isArray(list)) {
        for (const id of list) {
          pills.push(`${k.toUpperCase()}: ${id}`);
        }
      }
    }
    return pills;
  }

  getFilteredFootprintAccounts(): DiscoveredPlatformAccount[] {
    const all = this.omniResult?.digital_footprint?.all_results || [];
    return all.filter(acc => {
      if (this.onlyConfirmedFootprint && !acc.exists) return false;
      if (this.selectedCategory !== 'all' && acc.category !== this.selectedCategory) return false;
      return true;
    });
  }

  runAiAssessment(): void {
    if (!this.omniResult) return;
    this.isLoadingAiAssessment = true;

    this.api.getArgosAiAssessment({ dossier: this.omniResult }).subscribe({
      next: (res) => {
        this.aiAssessment = res;
        this.isLoadingAiAssessment = false;
      },
      error: (err: Error) => {
        this.errorMessage = err.message || 'Falha ao gerar avaliação de IA.';
        this.isLoadingAiAssessment = false;
      }
    });
  }

  formatInlineAiText(raw: string | undefined | null): string {
    if (!raw) return '';
    const escaped = raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return escaped
      .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#f8fafc">$1</strong>')
      .replace(/`([^`]+)`/g, '<code style="background:rgba(56,189,248,0.12);color:#38bdf8;padding:1px 5px;border-radius:4px;font-size:0.78rem">$1</code>');
  }

  formatAiNarrative(rawText: string | undefined | null): Array<{ badge?: string; title?: string; html: string }> {
    if (!rawText || !rawText.trim()) return [];
    const normalized = rawText.replace(/\\n/g, '\n').trim();

    // 1. Split by newlines OR numbered markers like (1), (2), (3)
    let segments = normalized
      .split(/\n+|\s+(?=\(\d+\)\s*)/)
      .map(s => s.trim())
      .filter(Boolean);

    // 2. If it's still a single dense paragraph > 220 chars, split into 3 balanced blocks
    if (segments.length === 1 && segments[0].length > 220) {
      const sentences = segments[0].match(/[^.!?]+[.!?]+(?:\s+|$)/g);
      if (sentences && sentences.length >= 3) {
        segments = [];
        const chunkSize = Math.ceil(sentences.length / 3);
        for (let i = 0; i < sentences.length; i += chunkSize) {
          segments.push(sentences.slice(i, i + chunkSize).join(' ').trim());
        }
      }
    }

    const defaultTitles: Record<string, string> = {
      '1': 'Identidade & Pegada Digital',
      '2': 'Infraestrutura, Vínculos & Corporativo',
      '3': 'Superfície de Exposição & Risco OPSEC',
      '4': 'Síntese Complementar de Inteligência',
    };

    return segments.map((seg, idx) => {
      const fallbackIdx = String(idx + 1);
      const numberedMatch = seg.match(/^(?:\((\d+)\)|(\d+)[\.\)])\s*(?:([^:–—-]{3,60})\s*[:–—-]\s*)?(.*)$/);
      if (numberedMatch) {
        const num = numberedMatch[1] || numberedMatch[2];
        const explicitTitle = numberedMatch[3]?.trim().replace(/^\*\*|\*\*$/g, '');
        const body = (numberedMatch[4] || '').trim();
        return {
          badge: `0${num}`,
          title: explicitTitle || defaultTitles[num] || `Eixo Analítico ${num}`,
          html: this.formatInlineAiText(body || seg),
        };
      }

      const titleMatch = seg.match(/^(?:\*\*([^*]{3,55})\*\*|([A-ZÀ-Ú][A-Za-zÀ-ÿ0-9\s&/]{3,45}))\s*[:–—-]\s*(.*)$/);
      if (titleMatch) {
        const title = (titleMatch[1] || titleMatch[2]).trim();
        const body = (titleMatch[3] || '').trim();
        return {
          badge: `0${fallbackIdx}`,
          title,
          html: this.formatInlineAiText(body),
        };
      }

      return {
        badge: segments.length > 1 ? `0${fallbackIdx}` : undefined,
        title: segments.length > 1 ? (defaultTitles[fallbackIdx] || `Eixo Analítico ${fallbackIdx}`) : undefined,
        html: this.formatInlineAiText(seg),
      };
    });
  }

  exportFootprintCsv(): void {
    const rows = this.omniResult?.digital_footprint?.all_results || [];
    if (!rows.length) return;
    this.api.exportToCsv(rows, `argos_footprint_${this.omniResult?.target || 'alvo'}`);
  }

  exportMentionsCsv(): void {
    const rows = this.omniResult?.web_mentions || [];
    if (!rows.length) return;
    this.api.exportToCsv(rows, `argos_mentions_${this.omniResult?.target || 'alvo'}`);
  }

  exportOmniJson(): void {
    if (!this.omniResult) return;
    this.api.exportToJson(this.omniResult, `argos_maltego_dossier_${this.omniResult.target}`);
  }
}
