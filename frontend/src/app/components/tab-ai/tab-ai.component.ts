import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AnalyzeResponse, ConfigResponse } from '../../models/instagram.model';
import {
  AiDiagnosisResponse,
  AiDiagnosisRequest,
  AiChatMessage,
  AiChatRequest,
  AiChatResponse,
} from '../../models/ai.model';
import { IconComponent } from '../ui/icon/icon.component';

@Component({
  selector: 'app-tab-ai',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div class="tab-content-wrapper">
      <!-- Top Control & Configuration Bar -->
      <div class="card ai-control-card">
        <div class="control-header">
          <div class="control-title-box">
            <div class="ai-badge-pulse">
              <app-icon name="shield" [size]="14" customClass="icon-violet"></app-icon>
              <span>Inteligência & Dossiê OSINT (Open Source Intelligence)</span>
            </div>
            <h2 class="ai-heading">Dossiê Investigativo & Perfilamento OSINT</h2>
            <p class="ai-subheading">
              Auditoria analítica de fontes abertas: perfilamento do alvo, exposição de dados OPSEC, conexões de rede, padrão de vida e avaliação de riscos.
            </p>
          </div>

          <div class="control-actions">
            <button 
              class="btn btn-outline btn-sm settings-toggle-btn"
              (click)="showSettings = !showSettings"
              title="Configurar Chave de API e Provedor">
              <app-icon name="settings" [size]="14"></app-icon>
              <span>{{ showSettings ? 'Ocultar Opções' : 'Configurar IA' }}</span>
            </button>

            <button 
              class="btn btn-primary generate-btn" 
              [disabled]="isLoadingDiagnosis || !analysis"
              (click)="generateDiagnosis()">
              <app-icon *ngIf="!isLoadingDiagnosis" name="shield" [size]="15"></app-icon>
              <span *ngIf="isLoadingDiagnosis" class="btn-spinner"></span>
              <span>{{ isLoadingDiagnosis ? 'Consolidando Inteligência...' : 'Gerar Dossiê OSINT' }}</span>
            </button>
          </div>
        </div>

        <!-- Optional Settings / Custom Token Drawer -->
        <div class="ai-settings-drawer" *ngIf="showSettings">
          <div class="settings-grid">
            <div class="form-group">
              <label class="form-label">Provedor de IA:</label>
              <select class="form-select" [(ngModel)]="customProvider">
                <option value="gemini">Google Gemini (Gemini 3.8 Flash)</option>
                <option value="openai">OpenAI (GPT-4o-mini / GPT-4o)</option>
                <option value="openrouter">OpenRouter (Multi-Model / Fallback)</option>
                <option value="ollama">Ollama / Provedor Local</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Foco da Análise OSINT:</label>
              <select class="form-select" [(ngModel)]="selectedFocus">
                <option value="general">Geral & 360° (Dossiê Completo de Inteligência)</option>
                <option value="opsec">OPSEC & Vulnerabilidades (Exposição de Contatos e Dados)</option>
                <option value="network">Rede & Conexões (Concorrentes, Afiliados e UGC)</option>
                <option value="life">Pattern of Life (Rotina, Fuso e Geolocalização)</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Chave de API (Opcional se configurado no .env):</label>
              <input 
                type="password" 
                class="form-input" 
                placeholder="Insira GEMINI_API_KEY, OPENAI_API_KEY ou OPENROUTER_API_KEY..." 
                [(ngModel)]="customApiKey"
                (ngModelChange)="onApiKeyChange()" />
              <div class="key-detection-notice" *ngIf="customApiKey.trim()">
                <span class="badge badge-success text-xs" *ngIf="customApiKey.trim().startsWith('AQ.') || customApiKey.trim().startsWith('AIzaSy')">
                  <app-icon name="check" [size]="11"></app-icon> Chave do Google Gemini detectada!
                </span>
                <span class="badge badge-warning text-xs" *ngIf="customApiKey.trim().startsWith('sk-or-')">
                  <app-icon name="shield" [size]="11"></app-icon> Chave do OpenRouter detectada!
                </span>
                <span class="badge badge-primary text-xs" *ngIf="customApiKey.trim().startsWith('sk-') && !customApiKey.trim().startsWith('sk-or-')">
                  <app-icon name="zap" [size]="11"></app-icon> Chave da OpenAI detectada!
                </span>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Modelo Customizado (Opcional):</label>
              <input 
                type="text" 
                class="form-input" 
                placeholder="ex: gemma-4-31b-it, gemini-3.8-flash ou gpt-4o-mini" 
                [(ngModel)]="customModel" />
            </div>
          </div>
          <div class="settings-hint">
            <app-icon name="info" [size]="13"></app-icon>
            <span>Dica: Se preencher <code>GEMINI_API_KEY</code>, <code>OPENAI_API_KEY</code> ou <code>OPENROUTER_API_KEY</code> no arquivo <code>.env</code> do projeto, não precisa digitar a chave aqui.</span>
          </div>
        </div>

        <!-- Provider Status Badge -->
        <div class="status-indicator-bar">
          <div class="status-item">
            <span class="status-dot" [class.active]="isAiReady"></span>
            <span>Status da IA: <strong>{{ isAiReady ? 'Pronto para uso' : 'Aguardando Chave' }}</strong></span>
          </div>
          <div class="status-item" *ngIf="envConfig?.ai_config?.provider">
            <span>Provedor Ativo: <strong>{{ envConfig?.ai_config?.provider | uppercase }}</strong></span>
          </div>
          <div class="status-item" *ngIf="envConfig?.ai_config?.model">
            <span>Modelo: <code>{{ envConfig?.ai_config?.model }}</code></span>
          </div>
          <div class="status-item" *ngIf="envConfig?.ai_config?.fallback_available">
            <span class="status-dot active"></span>
            <span>Fallback de Resiliência: <strong>OPENROUTER</strong></span>
          </div>
        </div>
      </div>

      <!-- Error Alert -->
      <div class="alert alert-danger" *ngIf="diagnosisError">
        <div class="alert-icon">
          <app-icon name="alert-triangle" [size]="20"></app-icon>
        </div>
        <div class="alert-content">
          <strong>Falha na geração do diagnóstico:</strong>
          <p>{{ diagnosisError }}</p>
          <p class="text-sm mt-1">Verifique se sua chave de API do Gemini ou OpenAI está válida.</p>
        </div>
        <button class="alert-close" (click)="diagnosisError = null">
          <app-icon name="x" [size]="14"></app-icon>
        </button>
      </div>

      <!-- Loading State Hero -->
      <div class="card loading-ai-card" *ngIf="isLoadingDiagnosis">
        <div class="loading-spinner-ring">
          <div class="ring-pulse"></div>
          <div class="spinner-center">
            <app-icon name="shield" [size]="24" customClass="icon-violet"></app-icon>
          </div>
        </div>
        <h3>Processando Inteligência Analítica...</h3>
        <p class="loading-step-text">{{ loadingStepText }}</p>
        <div class="ai-loading-progress-bar">
          <div class="progress-bar-fill"></div>
        </div>
      </div>

      <!-- Empty / Initial State (Before running diagnosis) -->
      <div class="card empty-ai-card" *ngIf="!diagnosis && !isLoadingDiagnosis">
        <div class="empty-ai-icon-box">
          <app-icon name="shield" [size]="32" customClass="icon-violet"></app-icon>
        </div>
        <h3>Pronto para Gerar o Dossiê OSINT de &#64;{{ analysis.info.username }}</h3>
        <p class="empty-desc">
          Clique em <strong>"Gerar Dossiê OSINT"</strong> acima para a inteligência artificial consolidar as evidências coletadas,
          mapear vetores de contato, analisar a rede de conexões e avaliar riscos de exposição.
        </p>

        <div class="preview-pillars-grid">
          <div class="pillar-box">
            <div class="pillar-icon-box">
              <app-icon name="shield" [size]="18" customClass="icon-emerald"></app-icon>
            </div>
            <h4>Integridade & OPSEC</h4>
            <p>Score de 0 a 100 avaliando exposição e consistência.</p>
          </div>
          <div class="pillar-box">
            <div class="pillar-icon-box">
              <app-icon name="compass" [size]="18" customClass="icon-cyan"></app-icon>
            </div>
            <h4>Matriz SWOT Investigativa</h4>
            <p>Vulnerabilidades de dados, ativos de influência e ameaças.</p>
          </div>
          <div class="pillar-box">
            <div class="pillar-icon-box">
              <app-icon name="search" [size]="18" customClass="icon-rose"></app-icon>
            </div>
            <h4>5 Vetores de Pivô</h4>
            <p>Trilhas de aprofundamento investigativo recomendadas.</p>
          </div>
          <div class="pillar-box">
            <div class="pillar-icon-box">
              <app-icon name="globe" [size]="18" customClass="icon-amber"></app-icon>
            </div>
            <h4>Rede & Pattern of Life</h4>
            <p>Padrão de horários, locais, colaboradores e clima social.</p>
          </div>
        </div>
      </div>

      <!-- Diagnosis Results (When Available) -->
      <ng-container *ngIf="diagnosis && !isLoadingDiagnosis">
        <!-- 1. Executive Summary & Health Score -->
        <div class="grid-summary-score">
          <!-- Health Score Box -->
          <div class="card score-card">
            <div class="card-title">
              <div class="title-left">
                <app-icon name="shield" [size]="16" customClass="icon-violet"></app-icon>
                <span>Score de Integridade & OPSEC</span>
              </div>
              <span class="badge" [ngClass]="getScoreBadgeClass(diagnosis.health_score)">
                {{ getScoreLabel(diagnosis.health_score) }}
              </span>
            </div>

            <div class="score-circle-wrapper">
              <div class="score-circle" [style.--score-val]="diagnosis.health_score">
                <span class="score-number">{{ diagnosis.health_score }}</span>
                <span class="score-max">/100</span>
              </div>
            </div>

            <p class="score-subtext">
              Avaliação analítica baseada em autenticidade de audiência, consistência de dados, exposição de OPSEC e sentimento.
            </p>
          </div>

          <!-- Executive Summary -->
          <div class="card exec-summary-card">
            <div class="card-title">
              <div class="title-left">
                <app-icon name="file-text" [size]="16" customClass="icon-cyan"></app-icon>
                <span>Dossiê Executivo de Inteligência</span>
              </div>
              <div class="badge-group">
                <span class="badge badge-warning text-xs" *ngIf="diagnosis.meta?.fallback_triggered" title="Acionado automaticamente via Fallback">
                  FALLBACK ATIVADO
                </span>
                <span class="badge badge-primary">{{ diagnosis.meta?.provider | uppercase }}</span>
              </div>
            </div>
            <p class="exec-text">
              {{ diagnosis.executive_summary }}
            </p>

            <div class="quick-wins-section" *ngIf="diagnosis.quick_wins && diagnosis.quick_wins.length > 0">
              <h4 class="quick-wins-title">
                <app-icon name="alert-triangle" [size]="14" customClass="icon-amber"></app-icon>
                <span>Descobertas Críticas & Alertas Imediatos:</span>
              </h4>
              <ul class="quick-wins-list">
                <li *ngFor="let win of diagnosis.quick_wins">
                  <span class="win-check">!</span>
                  <span>{{ win }}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <!-- 2. SWOT Analysis Matrix -->
        <div class="card swot-container-card">
          <div class="card-title">
            <div class="title-left">
              <app-icon name="compass" [size]="16" customClass="icon-indigo"></app-icon>
              <span>Matriz SWOT Investigativa (Análise de Forças & Riscos)</span>
            </div>
            <span class="badge badge-neutral">Dossiê 360°</span>
          </div>

          <div class="swot-grid">
            <!-- Strengths -->
            <div class="swot-quadrant quadrant-strengths">
              <div class="quadrant-header">
                <span class="swot-dot dot-emerald"></span>
                <h4>Ativos & Pontos Fortes de Influência</h4>
              </div>
              <ul>
                <li *ngFor="let item of diagnosis.swot.strengths">{{ item }}</li>
              </ul>
            </div>

            <!-- Weaknesses -->
            <div class="swot-quadrant quadrant-weaknesses">
              <div class="quadrant-header">
                <span class="swot-dot dot-rose"></span>
                <h4>Vulnerabilidades de OPSEC & Dados Expostos</h4>
              </div>
              <ul>
                <li *ngFor="let item of diagnosis.swot.weaknesses">{{ item }}</li>
              </ul>
            </div>

            <!-- Opportunities -->
            <div class="swot-quadrant quadrant-opportunities">
              <div class="quadrant-header">
                <span class="swot-dot dot-cyan"></span>
                <h4>Vetores de Investigação & Pivôs Aprofundados</h4>
              </div>
              <ul>
                <li *ngFor="let item of diagnosis.swot.opportunities">{{ item }}</li>
              </ul>
            </div>

            <!-- Threats -->
            <div class="swot-quadrant quadrant-threats">
              <div class="quadrant-header">
                <span class="swot-dot dot-amber"></span>
                <h4>Riscos, Ameaças & Concorrência Mapeada</h4>
              </div>
              <ul>
                <li *ngFor="let item of diagnosis.swot.threats">{{ item }}</li>
              </ul>
            </div>
          </div>
        </div>

        <!-- 3. Content Strategy & Audience Insights (Grid 2) -->
        <div class="grid-2">
          <!-- Content Strategy Card -->
          <div class="card">
            <div class="card-title">
              <div class="title-left">
                <app-icon name="trend-up" [size]="16" customClass="icon-rose"></app-icon>
                <span>Modus Operandi & Análise de Narrativa</span>
              </div>
              <span class="badge badge-ig">Engenharia Reversa</span>
            </div>

            <div class="strategy-block">
              <h5>
                <app-icon name="bar-chart" [size]="14"></app-icon>
                <span>Modus Operandi de Mídia</span>
              </h5>
              <p>{{ diagnosis.content_strategy.format_verdict }}</p>
            </div>

            <div class="strategy-block">
              <h5>
                <app-icon name="file-text" [size]="14"></app-icon>
                <span>Análise Narrativa, Discurso & Linguagem</span>
              </h5>
              <p>{{ diagnosis.content_strategy.copywriting_and_hooks }}</p>
            </div>

            <div class="strategy-block">
              <h5>
                <app-icon name="clock" [size]="14"></app-icon>
                <span>Pattern of Life (Padrão de Vida, Fuso & Rotina)</span>
              </h5>
              <p>{{ diagnosis.content_strategy.timing_and_cadence }}</p>
            </div>
          </div>

          <!-- Audience Insights Card -->
          <div class="card">
            <div class="card-title">
              <div class="title-left">
                <app-icon name="users" [size]="16" customClass="icon-cyan"></app-icon>
                <span>Inteligência Social & Percepção Pública</span>
              </div>
              <span class="badge badge-primary">Comentários & Clima Social</span>
            </div>

            <div class="strategy-block">
              <h5>
                <app-icon name="message-square" [size]="14"></app-icon>
                <span>Clima Social & Percepção da Audiência</span>
              </h5>
              <p>{{ diagnosis.audience_insights.sentiment_verdict }}</p>
            </div>

            <div class="strategy-block">
              <h5>
                <app-icon name="sparkles" [size]="14"></app-icon>
                <span>Esferas Temáticas & Interesses Dominantes</span>
              </h5>
              <div class="tags-cloud">
                <span class="audience-tag" *ngFor="let interest of diagnosis.audience_insights.key_interests">
                  {{ interest }}
                </span>
              </div>
            </div>

            <div class="strategy-block" *ngIf="diagnosis.audience_insights.unmet_needs_or_questions.length > 0">
              <h5>
                <app-icon name="alert-triangle" [size]="14"></app-icon>
                <span>Dores, Denúncias & Falhas Identificadas</span>
              </h5>
              <ul class="needs-list">
                <li *ngFor="let need of diagnosis.audience_insights.unmet_needs_or_questions">
                  {{ need }}
                </li>
              </ul>
            </div>
          </div>
        </div>

        <!-- 4. Next 5 Recommended Posts (Actionable Ideas) -->
        <div class="card recommended-posts-card">
          <div class="card-title">
            <div class="title-left">
              <app-icon name="search" [size]="16" customClass="icon-emerald"></app-icon>
              <span>5 Vetores de Investigação & Pivôs Recomendados</span>
            </div>
            <span class="badge badge-success">Aprofundamento OSINT</span>
          </div>
          <p class="card-subtitle">
            Trilhas de investigação e pivôs analíticos sugeridos com base nos dados e metadados expostos pelo alvo.
          </p>

          <div class="recommended-grid">
            <div class="post-idea-card" *ngFor="let post of diagnosis.recommended_posts; let i = index">
              <div class="post-idea-header">
                <span class="post-idea-number">#{{ i + 1 }}</span>
                <span class="badge" [ngClass]="getFormatBadgeClass(post.format)">{{ post.format }}</span>
              </div>
              <h4 class="post-idea-title">{{ post.title }}</h4>

              <div class="hook-box">
                <div class="hook-label">
                  <span>Ponto de Partida / Evidência Crítica:</span>
                  <button class="btn-copy-hook" (click)="copyToClipboard(post.hook)" title="Copiar Evidência">
                    <app-icon name="copy" [size]="12"></app-icon>
                  </button>
                </div>
                <div class="hook-text">"{{ post.hook }}"</div>
              </div>

              <div class="concept-box">
                <span class="concept-label">Metodologia de Investigação:</span>
                <p class="concept-text">{{ post.concept }}</p>
              </div>

              <div class="cta-box">
                <span class="cta-label">Ação Recomendada:</span>
                <span class="cta-text">{{ post.cta }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 5. Interactive Chat with Profile ("Pergunte à IA") -->
        <div class="card ai-chat-card">
          <div class="card-title">
            <div class="title-left">
              <app-icon name="message-square" [size]="16" customClass="icon-rose"></app-icon>
              <span>Consultoria Investigativa OSINT (Interrogue os Dados do Alvo)</span>
            </div>
            <span class="badge badge-primary">&#64;{{ analysis.info.username }}</span>
          </div>
          <p class="card-subtitle">
            Converse diretamente com o analista de inteligência de IA. Ele tem acesso aos metadados, contatos, rede e métricas do perfil.
          </p>

          <!-- Chat Suggestion Chips -->
          <div class="chat-chips-row">
            <button 
              class="chip-btn" 
              (click)="sendQuickQuestion('Quais são as principais vulnerabilidades de OPSEC e dados expostos pelo alvo?')">
              <app-icon name="alert-triangle" [size]="12"></app-icon>
              <span>Vulnerabilidades de OPSEC</span>
            </button>
            <button 
              class="chip-btn" 
              (click)="sendQuickQuestion('Quem são os principais parceiros, concorrentes e contas ligadas a este perfil?')">
              <app-icon name="users" [size]="12"></app-icon>
              <span>Mapeamento de Conexões</span>
            </button>
            <button 
              class="chip-btn" 
              (click)="sendQuickQuestion('Qual é o padrão de vida (Pattern of Life), horários de pico e locais do alvo?')">
              <app-icon name="map-pin" [size]="12"></app-icon>
              <span>Pattern of Life & Rotina</span>
            </button>
            <button 
              class="chip-btn" 
              (click)="sendQuickQuestion('Há indícios estatísticos de compra de seguidores ou engajamento falso/inorgânico?')">
              <app-icon name="cpu" [size]="12"></app-icon>
              <span>Suspeita de Bots & Anomalias</span>
            </button>
          </div>

          <!-- Chat Messages Area -->
          <div class="chat-messages-container" #chatContainer>
            <div class="chat-message assistant-message" *ngIf="chatMessages.length === 0">
              <div class="message-avatar">
                <app-icon name="shield" [size]="15"></app-icon>
              </div>
              <div class="message-bubble">
                Dossiê carregado. Sou seu Analista de Inteligência OSINT sobre o alvo <strong>&#64;{{ analysis.info.username }}</strong>. 
                Pergunte qualquer aspecto sobre perfilamento, exposição de contatos, rede de concorrentes, rotina ou anomalias de seguidores!
              </div>
            </div>

            <div 
              class="chat-message" 
              *ngFor="let msg of chatMessages"
              [ngClass]="msg.role === 'user' ? 'user-message' : 'assistant-message'">
              <div class="message-avatar">
                <app-icon [name]="msg.role === 'user' ? 'users' : 'shield'" [size]="14"></app-icon>
              </div>
              <div class="message-bubble" [innerHTML]="formatMessageText(msg.content)"></div>
            </div>

            <div class="chat-message assistant-message" *ngIf="isSendingChat">
              <div class="message-avatar">
                <app-icon name="shield" [size]="14"></app-icon>
              </div>
              <div class="message-bubble typing-bubble">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
              </div>
            </div>
          </div>

          <!-- Chat Input Area -->
          <div class="chat-input-row">
            <input 
              type="text" 
              class="form-input chat-input" 
              placeholder="Digite sua pergunta sobre este perfil..."
              [(ngModel)]="currentChatMessage"
              (keyup.enter)="sendChatMessage()"
              [disabled]="isSendingChat" />
            <button 
              class="btn btn-primary btn-chat-send" 
              (click)="sendChatMessage()"
              [disabled]="isSendingChat || !currentChatMessage.trim()">
              <span>Enviar</span>
              <app-icon name="zap" [size]="14"></app-icon>
            </button>
          </div>

          <div class="chat-error-notice" *ngIf="chatError">
            <app-icon name="alert-triangle" [size]="14"></app-icon>
            <span>{{ chatError }}</span>
          </div>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .tab-content-wrapper {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      animation: fadeIn 0.3s ease;
    }

    .ai-control-card {
      background: var(--bg-card);
      border: 1px solid rgba(139, 92, 246, 0.3);
      box-shadow: 0 4px 20px rgba(139, 92, 246, 0.08);
      position: relative;
      overflow: hidden;
    }

    .ai-control-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, #ec4899, #8b5cf6, #3b82f6);
    }

    .control-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1.5rem;
      flex-wrap: wrap;
    }

    .ai-badge-pulse {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      background: rgba(139, 92, 246, 0.15);
      border: 1px solid rgba(139, 92, 246, 0.4);
      color: #c4b5fd;
      padding: 0.25rem 0.75rem;
      border-radius: var(--radius-full);
      font-size: 0.75rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
    }

    .ai-heading {
      font-size: 1.35rem;
      font-weight: 800;
      color: #f8fafc;
      margin-bottom: 0.3rem;
    }

    .ai-subheading {
      font-size: 0.85rem;
      color: var(--text-muted);
      max-width: 650px;
      line-height: 1.45;
    }

    .control-actions {
      display: flex;
      gap: 0.65rem;
      align-items: center;
    }

    .settings-toggle-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }

    .generate-btn {
      background: linear-gradient(135deg, #8b5cf6, #6366f1);
      box-shadow: 0 4px 15px rgba(99, 102, 241, 0.35);
      border: 1px solid rgba(255, 255, 255, 0.15);
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
    }
    .generate-btn:hover:not(:disabled) {
      filter: brightness(1.12);
      transform: translateY(-1px);
    }

    .btn-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #ffffff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .ai-settings-drawer {
      margin-top: 1.25rem;
      padding: 1rem;
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
    }

    .settings-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
    }

    .key-detection-notice {
      margin-top: 0.4rem;
    }

    .settings-hint {
      margin-top: 0.75rem;
      font-size: 0.775rem;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .settings-hint code {
      color: #c4b5fd;
      background: rgba(139, 92, 246, 0.12);
      padding: 0.15rem 0.35rem;
      border-radius: 4px;
    }

    .status-indicator-bar {
      margin-top: 1rem;
      padding-top: 0.75rem;
      border-top: 1px solid var(--border-subtle);
      display: flex;
      gap: 1.5rem;
      flex-wrap: wrap;
      font-size: 0.775rem;
      color: var(--text-muted);
    }

    .status-item {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #eab308;
    }
    .status-dot.active {
      background: #10b981;
      box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
    }

    /* Loading Card */
    .loading-ai-card {
      text-align: center;
      padding: 3.5rem 2rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .loading-spinner-ring {
      position: relative;
      width: 60px;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1.25rem;
    }

    .ring-pulse {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 3px solid transparent;
      border-top-color: #8b5cf6;
      border-right-color: #ec4899;
      animation: spin 1s linear infinite;
    }

    .loading-step-text {
      color: var(--text-secondary);
      margin-top: 0.4rem;
      font-size: 0.9rem;
    }

    .ai-loading-progress-bar {
      width: 280px;
      height: 4px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: var(--radius-full);
      margin-top: 1.5rem;
      overflow: hidden;
    }

    .progress-bar-fill {
      width: 50%;
      height: 100%;
      background: linear-gradient(90deg, #ec4899, #8b5cf6);
      animation: indeterminate 1.5s infinite linear;
    }

    @keyframes indeterminate {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(250%); }
    }

    /* Empty Card */
    .empty-ai-card {
      text-align: center;
      padding: 3.5rem 2rem;
    }

    .empty-ai-icon-box {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: rgba(139, 92, 246, 0.15);
      border: 1px solid rgba(139, 92, 246, 0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.25rem auto;
    }

    .empty-desc {
      color: var(--text-secondary);
      max-width: 620px;
      margin: 0.5rem auto 2rem auto;
      font-size: 0.9rem;
      line-height: 1.5;
    }

    .preview-pillars-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 1rem;
      text-align: left;
    }

    .pillar-box {
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border-default);
      padding: 1.25rem;
      border-radius: var(--radius-md);
      transition: all var(--transition-fast);
    }
    .pillar-box:hover {
      border-color: rgba(139, 92, 246, 0.45);
      transform: translateY(-2px);
    }

    .pillar-icon-box {
      width: 34px;
      height: 34px;
      border-radius: var(--radius-sm);
      background: rgba(255, 255, 255, 0.05);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 0.65rem;
    }

    .pillar-box h4 {
      font-size: 0.9rem;
      color: #ffffff;
      margin-bottom: 0.25rem;
    }

    .pillar-box p {
      font-size: 0.775rem;
      color: var(--text-muted);
      line-height: 1.4;
    }

    /* Grid Summary Score */
    .grid-summary-score {
      display: grid;
      grid-template-columns: 280px 1fr;
      gap: 1.5rem;
    }

    @media (max-width: 900px) {
      .grid-summary-score {
        grid-template-columns: 1fr;
      }
    }

    .score-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .score-circle-wrapper {
      margin: 1.5rem 0;
    }

    .score-circle {
      width: 130px;
      height: 130px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(14, 20, 36, 0.9) 60%, rgba(24, 32, 51, 0.4) 100%);
      border: 4px solid #8b5cf6;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 25px rgba(139, 92, 246, 0.25);
    }

    .score-number {
      font-size: 2.5rem;
      font-weight: 800;
      color: #f8fafc;
      line-height: 1;
    }

    .score-max {
      font-size: 0.85rem;
      color: var(--text-muted);
    }

    .score-subtext {
      font-size: 0.78rem;
      color: var(--text-secondary);
      line-height: 1.4;
    }

    .exec-summary-card {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .exec-text {
      font-size: 0.9rem;
      color: var(--text-secondary);
      line-height: 1.6;
    }

    .quick-wins-section {
      background: rgba(245, 158, 11, 0.08);
      border: 1px solid rgba(245, 158, 11, 0.25);
      border-radius: var(--radius-md);
      padding: 1rem;
    }

    .quick-wins-title {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.85rem;
      color: #fbbf24;
      font-weight: 700;
      margin-bottom: 0.65rem;
    }

    .quick-wins-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .quick-wins-list li {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      font-size: 0.825rem;
      color: #fef3c7;
    }

    .win-check {
      color: #f59e0b;
      font-weight: 800;
    }

    /* SWOT Grid */
    .swot-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
      margin-top: 1rem;
    }

    @media (max-width: 768px) {
      .swot-grid {
        grid-template-columns: 1fr;
      }
    }

    .swot-quadrant {
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      padding: 1.15rem;
    }

    .quadrant-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }

    .swot-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .dot-emerald { background: #10b981; }
    .dot-rose { background: #f43f5e; }
    .dot-cyan { background: #38bdf8; }
    .dot-amber { background: #f59e0b; }

    .quadrant-header h4 {
      font-size: 0.88rem;
      font-weight: 700;
      color: #ffffff;
    }

    .swot-quadrant ul {
      list-style-type: disc;
      padding-left: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .swot-quadrant li {
      font-size: 0.825rem;
      color: var(--text-secondary);
      line-height: 1.45;
    }

    .strategy-block {
      margin-bottom: 1rem;
      padding-bottom: 0.85rem;
      border-bottom: 1px solid var(--border-subtle);
    }
    .strategy-block:last-child {
      margin-bottom: 0;
      padding-bottom: 0;
      border-bottom: none;
    }

    .strategy-block h5 {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.825rem;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 0.35rem;
    }

    .strategy-block p {
      font-size: 0.825rem;
      color: var(--text-secondary);
      line-height: 1.45;
    }

    .tags-cloud {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin-top: 0.4rem;
    }

    .audience-tag {
      background: var(--bg-card);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-sm);
      padding: 0.2rem 0.55rem;
      font-size: 0.75rem;
      color: var(--text-primary);
    }

    .needs-list {
      list-style-type: square;
      padding-left: 1.2rem;
      margin-top: 0.4rem;
    }

    .needs-list li {
      font-size: 0.8rem;
      color: var(--text-secondary);
      margin-bottom: 0.25rem;
    }

    /* Recommended Posts */
    .recommended-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1.25rem;
      margin-top: 1rem;
    }

    .post-idea-card {
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      padding: 1.15rem;
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }

    .post-idea-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .post-idea-number {
      font-size: 0.8rem;
      font-weight: 800;
      color: var(--accent-cyan);
    }

    .post-idea-title {
      font-size: 0.95rem;
      font-weight: 700;
      color: #ffffff;
      line-height: 1.35;
    }

    .hook-box {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      padding: 0.6rem 0.75rem;
    }

    .hook-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.7rem;
      font-weight: 700;
      color: var(--text-muted);
      margin-bottom: 0.2rem;
    }

    .btn-copy-hook {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
    }
    .btn-copy-hook:hover {
      color: #ffffff;
    }

    .hook-text {
      font-size: 0.8rem;
      color: #f472b6;
      font-style: italic;
    }

    .concept-box {
      font-size: 0.78rem;
    }

    .concept-label {
      font-weight: 700;
      color: var(--text-muted);
      display: block;
      margin-bottom: 0.15rem;
    }

    .concept-text {
      color: var(--text-secondary);
      line-height: 1.4;
    }

    .cta-box {
      margin-top: auto;
      font-size: 0.76rem;
      color: var(--text-dim);
    }
    .cta-label {
      font-weight: 700;
    }
    .cta-text {
      color: var(--text-secondary);
    }

    /* AI Chat */
    .chat-chips-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
      margin-bottom: 1rem;
    }

    .chip-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-full);
      padding: 0.35rem 0.75rem;
      font-size: 0.75rem;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all var(--transition-fast);
    }
    .chip-btn:hover {
      border-color: var(--border-hover);
      color: #ffffff;
      background: var(--bg-card-hover);
    }

    .chat-messages-container {
      background: #080d18;
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      padding: 1.25rem;
      max-height: 380px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .chat-message {
      display: flex;
      gap: 0.75rem;
      align-items: flex-start;
      max-width: 85%;
    }

    .user-message {
      margin-left: auto;
      flex-direction: row-reverse;
    }

    .message-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border-default);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 0.8rem;
    }

    .assistant-message .message-avatar {
      background: rgba(139, 92, 246, 0.2);
      border-color: rgba(139, 92, 246, 0.4);
      color: #c084fc;
    }

    .message-bubble {
      padding: 0.75rem 1rem;
      border-radius: var(--radius-md);
      font-size: 0.85rem;
      line-height: 1.5;
    }

    .assistant-message .message-bubble {
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border-default);
      color: #e2e8f0;
    }

    .user-message .message-bubble {
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      color: #ffffff;
    }

    .typing-bubble {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 0.6rem 0.85rem;
    }

    .typing-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #94a3b8;
      animation: typing 1.2s infinite ease-in-out;
    }
    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }

    @keyframes typing {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-4px); }
    }

    .chat-input-row {
      display: flex;
      gap: 0.65rem;
    }

    .chat-input {
      flex: 1;
    }

    .btn-chat-send {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }

    .chat-error-notice {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      margin-top: 0.5rem;
      font-size: 0.8rem;
      color: #fda4af;
    }

    :host ::ng-deep .icon-violet { color: #a855f7; }
    :host ::ng-deep .icon-emerald { color: #34d399; }
    :host ::ng-deep .icon-cyan { color: #38bdf8; }
    :host ::ng-deep .icon-rose { color: #f43f5e; }
    :host ::ng-deep .icon-amber { color: #fbbf24; }
    :host ::ng-deep .icon-indigo { color: #818cf8; }
  `]
})
export class TabAiComponent implements OnInit {
  @Input() analysis!: AnalyzeResponse;
  @Input() envConfig?: ConfigResponse;

  private readonly api = inject(ApiService);

  isLoadingDiagnosis = false;
  diagnosisError: string | null = null;
  diagnosis: AiDiagnosisResponse | null = null;
  loadingStepText = '';

  showSettings = false;
  customProvider = 'gemini';
  selectedFocus = 'general';
  customApiKey = '';
  customModel = '';

  chatMessages: AiChatMessage[] = [];
  currentChatMessage = '';
  isSendingChat = false;
  chatError: string | null = null;

  ngOnInit(): void {
    if (this.envConfig?.ai_config?.provider) {
      this.customProvider = this.envConfig.ai_config.provider;
    }
    if (this.envConfig?.ai_config?.model) {
      this.customModel = this.envConfig.ai_config.model;
    }
  }

  onApiKeyChange(): void {
    const k = this.customApiKey.trim();
    if (k.startsWith('AQ.') || k.startsWith('AIzaSy')) {
      this.customProvider = 'gemini';
      if (!this.customModel || this.customModel.includes('gpt') || this.customModel.includes('openrouter')) {
        this.customModel = 'gemma-4-31b-it';
      }
    } else if (k.startsWith('sk-or-')) {
      this.customProvider = 'openrouter';
      if (!this.customModel || this.customModel.includes('gemini-') || this.customModel.includes('gpt-')) {
        this.customModel = 'google/gemini-2.0-flash-001';
      }
    } else if (k.startsWith('sk-')) {
      this.customProvider = 'openai';
      if (!this.customModel || this.customModel.includes('gemini')) {
        this.customModel = 'gpt-4o-mini';
      }
    }
  }

  get isAiReady(): boolean {
    return Boolean(
      this.envConfig?.ai_config?.configured ||
      this.envConfig?.ai_config?.fallback_available ||
      this.customApiKey.trim() ||
      this.customProvider === 'ollama'
    );
  }

  generateDiagnosis(): void {
    if (!this.analysis) return;

    this.isLoadingDiagnosis = true;
    this.diagnosisError = null;
    this.loadingStepText = 'Destilando métricas e publicações do perfil...';

    const p = this.customProvider && this.customProvider !== 'none' ? this.customProvider : 'gemini';
    const req: AiDiagnosisRequest = {
      analysis: this.analysis,
      focus: this.selectedFocus,
      token: this.customApiKey.trim() || undefined,
      provider: p,
      model: this.customModel.trim() || undefined,
    };

    const timer = setTimeout(() => {
      this.loadingStepText = 'Consultando IA para mapear pontos fortes e pautas...';
    }, 2000);

    this.api.getAiDiagnosis(req).subscribe({
      next: (res: AiDiagnosisResponse) => {
        clearTimeout(timer);
        this.diagnosis = res;
        this.isLoadingDiagnosis = false;
      },
      error: (err: Error) => {
        clearTimeout(timer);
        this.diagnosisError = err.message || 'Falha ao processar diagnóstico com IA.';
        this.isLoadingDiagnosis = false;
      }
    });
  }

  sendChatMessage(): void {
    const text = this.currentChatMessage.trim();
    if (!text || this.isSendingChat || !this.analysis) return;

    this.chatMessages.push({
      role: 'user',
      content: text,
      timestamp: new Date()
    });

    this.currentChatMessage = '';
    this.isSendingChat = true;
    this.chatError = null;

    const p = this.customProvider && this.customProvider !== 'none' ? this.customProvider : 'gemini';
    const payload: AiChatRequest = {
      analysis: this.analysis,
      messages: this.chatMessages.map(m => ({ role: m.role, content: m.content })),
      token: this.customApiKey.trim() || undefined,
      provider: p,
      model: this.customModel.trim() || undefined,
    };

    this.api.sendAiChatMessage(payload).subscribe({
      next: (res: AiChatResponse) => {
        this.chatMessages.push({
          role: 'assistant',
          content: res.reply,
          timestamp: new Date()
        });
        this.isSendingChat = false;
      },
      error: (err: Error) => {
        this.chatError = err.message || 'Erro ao comunicar com a IA.';
        this.isSendingChat = false;
      }
    });
  }

  sendQuickQuestion(question: string): void {
    this.currentChatMessage = question;
    this.sendChatMessage();
  }

  copyToClipboard(text: string): void {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    }
  }

  formatMessageText(text: string): string {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return escaped
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');
  }

  getScoreBadgeClass(score: number): string {
    if (score >= 80) return 'badge-success';
    if (score >= 60) return 'badge-primary';
    if (score >= 40) return 'badge-warning';
    return 'badge-danger';
  }

  getScoreLabel(score: number): string {
    if (score >= 80) return 'Alta Integridade / Baixo Risco';
    if (score >= 60) return 'Moderado / Monitorável';
    if (score >= 40) return 'Alerta de OPSEC';
    return 'Vulnerabilidade Crítica';
  }

  getFormatBadgeClass(format: string): string {
    const f = (format || '').toLowerCase();
    if (f.includes('reel') || f.includes('vídeo') || f.includes('video')) return 'badge-ig';
    if (f.includes('carrossel')) return 'badge-primary';
    return 'badge-neutral';
  }
}
