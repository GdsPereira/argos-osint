import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AnalyzeRequest, ConfigResponse, DataSource } from '../../models/instagram.model';
import { IconComponent } from '../ui/icon/icon.component';

@Component({
  selector: 'app-config-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <aside class="sidebar" [class.collapsed]="isCollapsed">
      <!-- Header -->
      <div class="sidebar-header">
        <div class="brand">
          <div class="brand-icon">
            <app-icon name="instagram" [size]="20" [strokeWidth]="2"></app-icon>
          </div>
          <div class="brand-text">
            <span class="brand-title">Insta Analyzer</span>
            <span class="version-tag">Intelligence Pro</span>
          </div>
        </div>
        <button class="toggle-btn" (click)="toggleSidebar()" [title]="isCollapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'">
          <app-icon [name]="isCollapsed ? 'chevron-right' : 'chevron-left'" [size]="16"></app-icon>
        </button>
      </div>

      <!-- Form Body -->
      <div class="sidebar-content" *ngIf="!isCollapsed">
        <form (ngSubmit)="onSubmit()">
          <!-- Source Selection -->
          <div class="form-section">
            <div class="section-label">
              <span>Fonte de Coleta</span>
              <span class="source-active-pill">{{ getSourceTitle(form.source) }}</span>
            </div>

            <div class="source-grid">
              <!-- Apify -->
              <button type="button" 
                      class="source-card" 
                      [class.active]="form.source === 'apify'"
                      (click)="setSource('apify')">
                <div class="source-header">
                  <div class="source-icon-wrap apify-icon">
                    <app-icon name="zap" [size]="15"></app-icon>
                  </div>
                  <span class="source-title">Apify</span>
                  <span class="status-dot" [class.online]="hasEnv('apify')" [title]="hasEnv('apify') ? 'Token configurado no .env' : 'Requer token'"></span>
                </div>
                <span class="source-desc">Bypass anti-bot, sem login próprio</span>
              </button>

              <!-- Graph API Own -->
              <button type="button" 
                      class="source-card" 
                      [class.active]="form.source === 'own'"
                      (click)="setSource('own')">
                <div class="source-header">
                  <div class="source-icon-wrap meta-icon">
                    <app-icon name="award" [size]="15"></app-icon>
                  </div>
                  <span class="source-title">Meta Graph</span>
                  <span class="status-dot" [class.online]="hasEnv('own')" [title]="hasEnv('own') ? 'Token configurado no .env' : 'Requer token'"></span>
                </div>
                <span class="source-desc">Oficial, insights privados & demografia</span>
              </button>

              <!-- Graph Discovery -->
              <button type="button" 
                      class="source-card" 
                      [class.active]="form.source === 'discovery'"
                      (click)="setSource('discovery')">
                <div class="source-header">
                  <div class="source-icon-wrap disc-icon">
                    <app-icon name="search" [size]="15"></app-icon>
                  </div>
                  <span class="source-title">Discovery</span>
                  <span class="status-dot" [class.online]="hasEnv('discovery')" [title]="hasEnv('discovery') ? 'Token configurado no .env' : 'Requer token'"></span>
                </div>
                <span class="source-desc">Contas comerciais via FB Graph</span>
              </button>

              <!-- Instaloader -->
              <button type="button" 
                      class="source-card" 
                      [class.active]="form.source === 'insta'"
                      (click)="setSource('insta')">
                <div class="source-header">
                  <div class="source-icon-wrap py-icon">
                    <app-icon name="cpu" [size]="15"></app-icon>
                  </div>
                  <span class="source-title">Instaloader</span>
                  <span class="status-dot" [class.online]="true" title="Execução local Python"></span>
                </div>
                <span class="source-desc">Python direto, mútuos & audiência</span>
              </button>
            </div>
          </div>

          <!-- Target Profile Username -->
          <div class="form-section">
            <label class="form-label" for="usernameInput">
              <span>Alvo da Análise</span>
              <span class="required-tag" *ngIf="form.source !== 'own'">Obrigatório</span>
            </label>

            <div class="input-container">
              <span class="input-at">&#64;</span>
              <input id="usernameInput"
                     type="text" 
                     class="form-input-modern" 
                     [(ngModel)]="form.username" 
                     name="username"
                     placeholder="nome_do_perfil" 
                     required
                     autocomplete="off" />
              <button type="button" 
                      class="clear-input-btn" 
                      *ngIf="form.username" 
                      (click)="form.username = ''" 
                      title="Limpar">
                <app-icon name="x" [size]="14"></app-icon>
              </button>
            </div>

            <!-- Quick Preset Chips for Easy Testing -->
            <div class="presets-row">
              <span class="presets-label">Exemplos:</span>
              <button type="button" class="preset-chip" (click)="setPreset('instagram')">&#64;instagram</button>
              <button type="button" class="preset-chip" (click)="setPreset('natgeo')">&#64;natgeo</button>
              <button type="button" class="preset-chip" (click)="setPreset('neymarjr')">&#64;neymarjr</button>
            </div>
          </div>

          <!-- Credentials Box -->
          <div class="credentials-card">
            <!-- Apify Token -->
            <div class="form-group" *ngIf="form.source === 'apify'">
              <div class="label-row">
                <label class="form-label" for="apifyToken">Token da API Apify</label>
                <span class="badge-env" *ngIf="hasEnv('apify')">
                  <app-icon name="check" [size]="12"></app-icon> No .env
                </span>
              </div>
              <input id="apifyToken"
                     type="password" 
                     class="form-input" 
                     [(ngModel)]="tokens.apify" 
                     name="apifyToken"
                     [placeholder]="hasEnv('apify') ? 'Usando APIFY_TOKEN do ambiente' : 'apify_api_...'" />
            </div>

            <!-- Graph API Own Token -->
            <div class="form-group" *ngIf="form.source === 'own'">
              <div class="label-row">
                <label class="form-label" for="ownToken">IG User Token (Próprio)</label>
                <span class="badge-env" *ngIf="hasEnv('own')">
                  <app-icon name="check" [size]="12"></app-icon> No .env
                </span>
              </div>
              <input id="ownToken"
                     type="password" 
                     class="form-input" 
                     [(ngModel)]="tokens.own" 
                     name="ownToken"
                     [placeholder]="hasEnv('own') ? 'Usando IG_TOKEN do ambiente' : 'EAABw...'" />
            </div>

            <!-- Graph API Discovery Fields -->
            <ng-container *ngIf="form.source === 'discovery'">
              <div class="form-group">
                <div class="label-row">
                  <label class="form-label" for="discToken">FB Token (instagram_basic)</label>
                  <span class="badge-env" *ngIf="hasEnv('discovery')">
                    <app-icon name="check" [size]="12"></app-icon> No .env
                  </span>
                </div>
                <input id="discToken"
                       type="password" 
                       class="form-input" 
                       [(ngModel)]="tokens.discovery" 
                       name="discToken"
                       [placeholder]="hasEnv('discovery') ? 'Usando FB_TOKEN do ambiente' : 'EAABw...'" />
              </div>
              <div class="form-group">
                <div class="label-row">
                  <label class="form-label" for="myIgId">ID da Sua Conta IG (ig_user_id)</label>
                  <span class="badge-env" *ngIf="hasEnv('my_ig_id')">
                    <app-icon name="check" [size]="12"></app-icon> No .env
                  </span>
                </div>
                <input id="myIgId"
                       type="text" 
                       class="form-input" 
                       [(ngModel)]="form.my_ig_id" 
                       name="myIgId"
                       [placeholder]="hasEnv('my_ig_id') ? 'Usando IG_USER_ID do ambiente' : '178414...'" />
              </div>
            </ng-container>

            <!-- Instaloader Credentials -->
            <ng-container *ngIf="form.source === 'insta'">
              <div class="form-group">
                <label class="form-label" for="loginUser">Login Instagram (Opcional)</label>
                <input id="loginUser"
                       type="text" 
                       class="form-input" 
                       [(ngModel)]="form.login_user" 
                       name="loginUser"
                       placeholder="usuario_login (para mútuos)" />
              </div>
              <div class="form-group" *ngIf="form.login_user">
                <label class="form-label" for="loginPass">Senha do Instagram</label>
                <input id="loginPass"
                       type="password" 
                       class="form-input" 
                       [(ngModel)]="form.password" 
                       name="loginPass"
                       placeholder="••••••••" />
              </div>
              <div class="form-group">
                <div class="label-row">
                  <label class="form-label">Delay entre requisições</label>
                  <span class="slider-badge">{{ form.delay }}s</span>
                </div>
                <input type="range" 
                       min="0.5" 
                       max="5" 
                       step="0.5" 
                       [(ngModel)]="form.delay" 
                       name="delay" />
              </div>
            </ng-container>
          </div>

          <!-- Post Limit Slider -->
          <div class="form-section">
            <div class="label-row">
              <label class="form-label">
                <app-icon name="bar-chart" [size]="14"></app-icon>
                <span>Volume de Posts</span>
              </label>
              <span class="slider-badge">{{ form.max_posts }} publicações</span>
            </div>
            <input type="range" 
                   min="5" 
                   max="300" 
                   step="5" 
                   [(ngModel)]="form.max_posts" 
                   name="maxPosts" />
          </div>

          <!-- Advanced Options Accordion -->
          <div class="advanced-section">
            <button type="button" 
                    class="advanced-toggle-btn" 
                    (click)="showAdvanced = !showAdvanced">
              <div class="toggle-btn-left">
                <app-icon name="settings" [size]="14"></app-icon>
                <span>Opções Avançadas de Coleta</span>
              </div>
              <app-icon [name]="showAdvanced ? 'chevron-down' : 'chevron-right'" [size]="14"></app-icon>
            </button>

            <div class="advanced-body" *ngIf="showAdvanced">
              <!-- Comments Switch -->
              <label class="form-switch-label">
                <div class="switch-text">
                  <span class="switch-title">Coletar Comentários</span>
                  <span class="switch-desc">Extrai sentimento e autores mais ativos</span>
                </div>
                <input type="checkbox" [(ngModel)]="form.with_comments" name="withComments" />
              </label>

              <!-- Comments limit if checked -->
              <div class="nested-option" *ngIf="form.with_comments">
                <div class="label-row">
                  <label class="form-label">Comentários por publicação</label>
                  <span class="slider-badge">{{ form.comments_per_post }}</span>
                </div>
                <input type="range" min="10" max="150" step="10" [(ngModel)]="form.comments_per_post" name="commentsPerPost" />
              </div>

              <!-- Stories toggle for Apify -->
              <label class="form-switch-label" *ngIf="form.source === 'apify'">
                <div class="switch-text">
                  <span class="switch-title">Stories Recentes (24h)</span>
                  <span class="switch-desc">Extrai stories ativos via actor secundário</span>
                </div>
                <input type="checkbox" [(ngModel)]="form.with_stories" name="withStories" />
              </label>

              <!-- Tagged posts toggle for Apify -->
              <label class="form-switch-label" *ngIf="form.source === 'apify'">
                <div class="switch-text">
                  <span class="switch-title">Posts Marcados (Tagged)</span>
                  <span class="switch-desc">Publicações onde outros perfis marcaram o alvo</span>
                </div>
                <input type="checkbox" [(ngModel)]="form.with_tagged" name="withTagged" />
              </label>

              <!-- Highlights toggle for Apify -->
              <label class="form-switch-label" *ngIf="form.source === 'apify'">
                <div class="switch-text">
                  <span class="switch-title">Destaques (Highlights)</span>
                  <span class="switch-desc">Extrair todos os stories e mídias salvos</span>
                </div>
                <input type="checkbox" [(ngModel)]="form.with_highlights" name="withHighlights" />
              </label>

              <!-- Insights toggle for Own -->
              <label class="form-switch-label" *ngIf="form.source === 'own'">
                <div class="switch-text">
                  <span class="switch-title">Métricas de Insights</span>
                  <span class="switch-desc">Alcance, salvamentos e demografia oficial</span>
                </div>
                <input type="checkbox" [(ngModel)]="form.with_insights" name="withInsights" />
              </label>

              <!-- People toggle for Instaloader -->
              <label class="form-switch-label" *ngIf="form.source === 'insta'">
                <div class="switch-text">
                  <span class="switch-title">Listas de Audiência</span>
                  <span class="switch-desc">Mútuos e quem não segue de volta</span>
                </div>
                <input type="checkbox" [(ngModel)]="form.with_people" name="withPeople" />
              </label>

              <div class="nested-option" *ngIf="form.source === 'insta' && form.with_people">
                <div class="label-row">
                  <label class="form-label">Limite seguidores/seguindo</label>
                  <span class="slider-badge">{{ form.people_limit }}</span>
                </div>
                <input type="range" min="50" max="1000" step="50" [(ngModel)]="form.people_limit" name="peopleLimit" />
              </div>

              <!-- Background async job toggle -->
              <label class="form-switch-label">
                <div class="switch-text">
                  <span class="switch-title">Modo Assíncrono (Job em Background)</span>
                  <span class="switch-desc">Prevenção contra timeouts HTTP 504 em coletas grandes</span>
                </div>
                <input type="checkbox" [(ngModel)]="form.use_async" name="useAsync" />
              </label>
            </div>
          </div>

          <!-- Submit Action Button -->
          <div class="submit-container">
            <button type="submit" 
                    class="btn btn-primary submit-btn" 
                    [disabled]="isLoading || (!form.username && form.source !== 'own')">
              <span *ngIf="isLoading" class="btn-spinner"></span>
              <app-icon *ngIf="!isLoading" name="zap" [size]="18"></app-icon>
              <span>{{ isLoading ? 'Coletando Perfil...' : 'Analisar Perfil' }}</span>
            </button>
          </div>
        </form>
      </div>
    </aside>
  `,
  styles: [`
    .sidebar {
      width: 360px;
      background: var(--bg-surface);
      border-right: 1px solid var(--border-default);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      transition: width var(--transition-normal);
      z-index: 20;
    }

    .sidebar.collapsed {
      width: 72px;
    }

    .sidebar.collapsed .brand-text,
    .sidebar.collapsed .sidebar-content {
      display: none;
    }

    .sidebar-header {
      padding: 1.25rem 1.15rem;
      border-bottom: 1px solid var(--border-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .brand-icon {
      width: 38px;
      height: 38px;
      border-radius: var(--radius-md);
      background: var(--ig-gradient);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      box-shadow: var(--ig-glow);
      flex-shrink: 0;
    }

    .brand-text {
      display: flex;
      flex-direction: column;
    }

    .brand-title {
      font-size: 1rem;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.02em;
    }

    .version-tag {
      font-size: 0.68rem;
      font-weight: 600;
      color: var(--accent-cyan);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .toggle-btn {
      width: 32px;
      height: 32px;
      border-radius: var(--radius-sm);
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border-default);
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .toggle-btn:hover {
      color: #ffffff;
      border-color: var(--border-hover);
      background: var(--bg-card-hover);
    }

    .sidebar-content {
      padding: 1.25rem 1.15rem 2rem 1.15rem;
      overflow-y: auto;
      flex: 1;
    }

    .form-section {
      margin-bottom: 1.25rem;
    }

    .section-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 0.6rem;
    }

    .source-active-pill {
      font-size: 0.68rem;
      color: var(--accent-cyan);
      text-transform: none;
      font-weight: 600;
    }

    .source-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.5rem;
    }

    .source-card {
      background: var(--bg-card);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      padding: 0.65rem 0.75rem;
      text-align: left;
      cursor: pointer;
      transition: all var(--transition-fast);
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .source-card:hover {
      border-color: var(--border-hover);
      background: var(--bg-card-hover);
    }

    .source-card.active {
      background: rgba(225, 48, 108, 0.08);
      border-color: var(--ig-pink);
      box-shadow: 0 0 14px rgba(225, 48, 108, 0.2);
    }

    .source-header {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .source-icon-wrap {
      width: 22px;
      height: 22px;
      border-radius: var(--radius-xs);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
    }

    .apify-icon { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
    .meta-icon { background: rgba(99, 102, 241, 0.15); color: #818cf8; }
    .disc-icon { background: rgba(56, 189, 248, 0.15); color: #38bdf8; }
    .py-icon { background: rgba(16, 185, 129, 0.15); color: #34d399; }

    .source-title {
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--text-primary);
      flex: 1;
    }

    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #475569;
      flex-shrink: 0;
    }

    .status-dot.online {
      background: #10b981;
      box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
    }

    .source-desc {
      font-size: 0.68rem;
      color: var(--text-muted);
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .required-tag {
      font-size: 0.68rem;
      color: var(--ig-pink);
      font-weight: 600;
    }

    .input-container {
      position: relative;
      display: flex;
      align-items: center;
    }

    .input-at {
      position: absolute;
      left: 0.85rem;
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--ig-pink);
      pointer-events: none;
    }

    .form-input-modern {
      width: 100%;
      padding: 0.7rem 2.2rem 0.7rem 2rem;
      background: var(--bg-input);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      color: #ffffff;
      font-family: var(--font-sans);
      font-size: 0.92rem;
      font-weight: 600;
      outline: none;
      transition: all var(--transition-fast);
    }

    .form-input-modern:focus {
      background: var(--bg-input-focus);
      border-color: var(--ig-pink);
      box-shadow: 0 0 0 3px rgba(225, 48, 108, 0.2);
    }

    .clear-input-btn {
      position: absolute;
      right: 0.6rem;
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.25rem;
      border-radius: 50%;
    }
    .clear-input-btn:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.1);
    }

    .presets-row {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      margin-top: 0.5rem;
      flex-wrap: wrap;
    }

    .presets-label {
      font-size: 0.72rem;
      color: var(--text-dim);
    }

    .preset-chip {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-full);
      padding: 0.15rem 0.55rem;
      font-size: 0.72rem;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all var(--transition-fast);
    }
    .preset-chip:hover {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text-primary);
      border-color: var(--border-hover);
    }

    .credentials-card {
      background: var(--bg-card);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      padding: 0.85rem;
      margin-bottom: 1.15rem;
    }

    .label-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.35rem;
    }

    .badge-env {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.68rem;
      font-weight: 700;
      color: #34d399;
      background: rgba(16, 185, 129, 0.12);
      padding: 0.1rem 0.4rem;
      border-radius: var(--radius-full);
    }

    .slider-badge {
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--accent-cyan);
      font-variant-numeric: tabular-nums;
    }

    .advanced-section {
      margin-bottom: 1.25rem;
    }

    .advanced-toggle-btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.6rem 0.75rem;
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .advanced-toggle-btn:hover {
      color: #ffffff;
      border-color: var(--border-hover);
    }

    .toggle-btn-left {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .advanced-body {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-top: 0.65rem;
      padding-top: 0.25rem;
    }

    .switch-text {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }

    .switch-title {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .switch-desc {
      font-size: 0.7rem;
      color: var(--text-muted);
    }

    .nested-option {
      margin-left: 0.75rem;
      padding: 0.5rem 0.65rem;
      border-left: 2px solid var(--ig-pink);
      background: rgba(255, 255, 255, 0.02);
      border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    }

    .submit-container {
      margin-top: 1.25rem;
    }

    .submit-btn {
      width: 100%;
      padding: 0.85rem;
      font-size: 0.95rem;
      font-weight: 700;
    }

    .btn-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #ffffff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @media (max-width: 960px) {
      .sidebar {
        width: 100%;
        border-right: none;
        border-bottom: 1px solid var(--border-default);
      }
      .sidebar.collapsed {
        width: 100%;
      }
    }
  `]
})
export class ConfigSidebarComponent implements OnInit {
  @Input() isLoading = false;
  @Input() envConfig: ConfigResponse | null = null;
  @Output() analyzeRequested = new EventEmitter<AnalyzeRequest>();

  isCollapsed = false;
  showAdvanced = false;

  tokens: Record<string, string> = {
    apify: '',
    own: '',
    discovery: ''
  };

  form: AnalyzeRequest = {
    source: 'apify',
    username: '',
    max_posts: 50,
    token: '',
    my_ig_id: '',
    with_comments: false,
    comments_per_post: 30,
    with_insights: true,
    login_user: '',
    password: '',
    delay: 1.0,
    with_people: false,
    people_limit: 150,
    with_stories: false,
    with_tagged: false,
    with_highlights: false,
    use_async: true
  };

  ngOnInit(): void {
    // defaults
  }

  setSource(src: DataSource): void {
    this.form.source = src;
  }

  getSourceTitle(src: DataSource): string {
    switch (src) {
      case 'apify': return 'Apify Scraper';
      case 'own': return 'Graph API Própria';
      case 'discovery': return 'Graph Discovery';
      case 'insta': return 'Instaloader Python';
      default: return src;
    }
  }

  setPreset(username: string): void {
    this.form.username = username;
  }

  hasEnv(key: 'apify' | 'own' | 'discovery' | 'my_ig_id'): boolean {
    return !!this.envConfig?.env?.[key];
  }

  toggleSidebar(): void {
    this.isCollapsed = !this.isCollapsed;
  }

  onSubmit(): void {
    if (this.isLoading) return;
    const token = (this.tokens[this.form.source] || '').trim();
    const username = (this.form.username || '').trim().replace(/^@+/, '');
    this.analyzeRequested.emit({
      ...this.form,
      username,
      token,
      my_ig_id: (this.form.my_ig_id || '').trim()
    });
  }
}
