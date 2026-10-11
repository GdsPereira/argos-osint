import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AudienceData, AudienceUser, DataSource, ExtraData } from '../../models/instagram.model';
import { IconComponent } from '../ui/icon/icon.component';

@Component({
  selector: 'app-tab-audience',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div class="tab-content-wrapper">
      <!-- Graph API Official Account Insights (If Available) -->
      <div *ngIf="hasGraphInsights" class="mb-4">
        <div class="card mb-3">
          <div class="card-title">
            <div class="title-left">
              <app-icon name="trend-up" [size]="18" customClass="icon-emerald"></app-icon>
              <span>Métricas Oficiais da Conta (Últimos 30 Dias)</span>
            </div>
            <span class="badge badge-success">Meta Graph API</span>
          </div>
          <p class="card-subtitle">
            Dados agregados privados fornecidos diretamente pelo Instagram Business Insights.
          </p>

          <div class="kpi-grid">
            <div class="kpi-card" *ngIf="extra?.ultimos_30_dias?.['reach'] !== undefined">
              <div class="kpi-label">Alcance Total (30d)</div>
              <div class="kpi-value text-cyan number-font">{{ extra!.ultimos_30_dias!['reach'] | number }}</div>
              <div class="kpi-subtext">Contas únicas alcançadas</div>
            </div>

            <div class="kpi-card" *ngIf="extra?.ultimos_30_dias?.['profile_views'] !== undefined">
              <div class="kpi-label">Visitas ao Perfil</div>
              <div class="kpi-value text-amber number-font">{{ extra!.ultimos_30_dias!['profile_views'] | number }}</div>
              <div class="kpi-subtext">Visualizações do perfil nos 30d</div>
            </div>

            <div class="kpi-card" *ngIf="extra?.ultimos_30_dias?.['accounts_engaged'] !== undefined">
              <div class="kpi-label">Contas Engajadas</div>
              <div class="kpi-value text-pink number-font">{{ extra!.ultimos_30_dias!['accounts_engaged'] | number }}</div>
              <div class="kpi-subtext">Contas com ações nos posts</div>
            </div>

            <div class="kpi-card" *ngIf="extra?.ultimos_30_dias?.['total_interactions'] !== undefined">
              <div class="kpi-label">Interações Globais</div>
              <div class="kpi-value text-emerald number-font">{{ extra!.ultimos_30_dias!['total_interactions'] | number }}</div>
              <div class="kpi-subtext">Likes, saves, comentários e shares</div>
            </div>
          </div>
        </div>

        <!-- Demographics Breakdown -->
        <div class="card" *ngIf="hasDemographics">
          <div class="card-title">
            <div class="title-left">
              <app-icon name="users" [size]="18" customClass="icon-cyan"></app-icon>
              <span>Demografia da Audiência</span>
            </div>
            <span class="badge badge-primary">Público Ativo</span>
          </div>

          <div class="grid-2">
            <!-- Age Breakdown -->
            <div *ngIf="extra?.demografia?.age" class="demo-section">
              <h4 class="demo-title">Faixa Etária</h4>
              <div class="demo-item" *ngFor="let item of getDemoEntries(extra?.demografia?.age)">
                <div class="demo-header">
                  <span>{{ item.key }}</span>
                  <strong class="number-font">{{ item.val | number }}</strong>
                </div>
                <div class="progress-bar-bg">
                  <div class="progress-bar-fill fill-cyan" [style.width.%]="getDemoPct(item.val, maxAge)"></div>
                </div>
              </div>
            </div>

            <!-- Gender Breakdown -->
            <div *ngIf="extra?.demografia?.gender" class="demo-section">
              <h4 class="demo-title">Gênero</h4>
              <div class="demo-item" *ngFor="let item of getDemoEntries(extra?.demografia?.gender)">
                <div class="demo-header">
                  <span>{{ formatGender(item.key) }}</span>
                  <strong class="number-font">{{ item.val | number }}</strong>
                </div>
                <div class="progress-bar-bg">
                  <div class="progress-bar-fill fill-rose" [style.width.%]="getDemoPct(item.val, maxGender)"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Instaloader Relationship Lists (Mutuals & Not Following Back) -->
      <div *ngIf="hasInstaAudience" class="mb-4">
        <div class="kpi-grid mb-3">
          <div class="kpi-card">
            <div class="kpi-label">Não Seguem de Volta</div>
            <div class="kpi-value text-rose number-font">{{ audience?.not_following_back?.length || 0 }}</div>
            <div class="kpi-subtext">Perfis seguidos sem reciprocidade</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-label">Seguidores Mútuos</div>
            <div class="kpi-value text-emerald number-font">{{ audience?.mutual?.length || 0 }}</div>
            <div class="kpi-subtext">Conexões recíprocas confirmadas</div>
          </div>

          <div class="kpi-card" *ngIf="audience?.followers?.length">
            <div class="kpi-label">Amostra Seguidores</div>
            <div class="kpi-value text-cyan number-font">{{ audience?.followers?.length || 0 }}</div>
            <div class="kpi-subtext">Perfis analisados na amostra</div>
          </div>

          <div class="kpi-card" *ngIf="audience?.followees?.length">
            <div class="kpi-label">Amostra Seguindo</div>
            <div class="kpi-value text-amber number-font">{{ audience?.followees?.length || 0 }}</div>
            <div class="kpi-subtext">Perfis seguidos analisados</div>
          </div>
        </div>

        <div class="grid-2">
          <!-- Not Following Back List -->
          <div class="card">
            <div class="card-title-row">
              <div class="card-title">
                <div class="title-left">
                  <app-icon name="alert-triangle" [size]="18" customClass="icon-rose"></app-icon>
                  <span>Não Seguem de Volta</span>
                </div>
                <span class="badge badge-danger">{{ filteredNotFollowing.length }}</span>
              </div>
              <button class="btn btn-outline btn-xs" 
                      (click)="copyToClipboard(audience?.not_following_back || [], 'not_following')">
                <app-icon [name]="copiedType === 'not_following' ? 'check' : 'copy'" [size]="12"></app-icon>
                <span>{{ copiedType === 'not_following' ? 'Copiado!' : 'Copiar' }}</span>
              </button>
            </div>
            
            <div class="search-box">
              <input type="text" 
                     class="form-input form-input-sm" 
                     placeholder="Filtrar usuário..." 
                     [(ngModel)]="searchNotFollowing" />
            </div>

            <div class="users-list-scroll">
              <div class="user-row" *ngFor="let u of filteredNotFollowing">
                <div class="user-info">
                  <span class="user-username">&#64;{{ u }}</span>
                </div>
                <div class="user-badges">
                  <a [href]="'https://www.instagram.com/' + u" target="_blank" class="user-link" title="Abrir perfil">
                    <app-icon name="external-link" [size]="12"></app-icon>
                  </a>
                </div>
              </div>
              <div *ngIf="filteredNotFollowing.length === 0" class="text-muted text-center py-4">
                Nenhum perfil nesta categoria.
              </div>
            </div>
          </div>

          <!-- Mutual Followers List -->
          <div class="card">
            <div class="card-title-row">
              <div class="card-title">
                <div class="title-left">
                  <app-icon name="users" [size]="18" customClass="icon-emerald"></app-icon>
                  <span>Seguidores Mútuos</span>
                </div>
                <span class="badge badge-success">{{ filteredMutual.length }}</span>
              </div>
              <button class="btn btn-outline btn-xs" 
                      (click)="copyToClipboard(audience?.mutual || [], 'mutual')">
                <app-icon [name]="copiedType === 'mutual' ? 'check' : 'copy'" [size]="12"></app-icon>
                <span>{{ copiedType === 'mutual' ? 'Copiado!' : 'Copiar' }}</span>
              </button>
            </div>

            <div class="search-box">
              <input type="text" 
                     class="form-input form-input-sm" 
                     placeholder="Filtrar mútuos..." 
                     [(ngModel)]="searchMutual" />
            </div>

            <div class="users-list-scroll">
              <div class="user-row" *ngFor="let u of filteredMutual">
                <div class="user-info">
                  <span class="user-username">&#64;{{ u }}</span>
                </div>
                <div class="user-badges">
                  <a [href]="'https://www.instagram.com/' + u" target="_blank" class="user-link" title="Abrir perfil">
                    <app-icon name="external-link" [size]="12"></app-icon>
                  </a>
                </div>
              </div>
              <div *ngIf="filteredMutual.length === 0" class="text-muted text-center py-4">
                Nenhum perfil mútuo encontrado.
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State if neither source has data -->
      <div class="card empty-state" *ngIf="!hasGraphInsights && !hasInstaAudience">
        <div class="empty-state-icon">
          <app-icon name="users" [size]="28"></app-icon>
        </div>
        <h3 class="empty-state-title">Audiência Detalhada Não Disponível</h3>
        <p class="empty-state-desc">
          Para acessar dados demográficos ou listas de mútuos e unfollowers, utilize a fonte <strong>"Graph API Própria"</strong> ou marque a opção <strong>"Listas de Audiência"</strong> via Instaloader.
        </p>
      </div>
    </div>
  `,
  styles: [`
    .mb-3 { margin-bottom: 1rem; }
    .mb-4 { margin-bottom: 1.5rem; }

    .number-font {
      font-variant-numeric: tabular-nums;
    }

    .card-title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.75rem;
    }

    .btn-xs {
      padding: 0.25rem 0.55rem;
      font-size: 0.72rem;
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
    }

    .search-box {
      margin-bottom: 0.75rem;
    }

    .form-input-sm {
      padding: 0.45rem 0.65rem;
      font-size: 0.8rem;
    }

    .users-list-scroll {
      max-height: 380px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
    }

    .user-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.55rem 0.75rem;
      background: var(--bg-surface-elevated);
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-subtle);
      transition: all var(--transition-fast);
    }
    .user-row:hover {
      border-color: var(--border-hover);
      background: var(--bg-card-hover);
    }

    .user-info {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }

    .user-username {
      font-size: 0.825rem;
      font-weight: 700;
      color: #ffffff;
    }

    .user-fullname {
      font-size: 0.72rem;
      color: var(--text-muted);
    }

    .user-badges {
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }

    .user-link {
      color: var(--text-muted);
      display: inline-flex;
      align-items: center;
      padding: 2px;
      border-radius: 3px;
    }
    .user-link:hover {
      color: #ffffff;
    }

    .demo-section {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }

    .demo-title {
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--text-secondary);
      margin-bottom: 0.25rem;
    }

    .demo-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .demo-header {
      display: flex;
      justify-content: space-between;
      font-size: 0.8rem;
      color: var(--text-primary);
    }

    .progress-bar-bg {
      width: 100%;
      height: 6px;
      background: var(--bg-surface-elevated);
      border-radius: var(--radius-full);
      overflow: hidden;
    }

    .progress-bar-fill {
      height: 100%;
      border-radius: var(--radius-full);
      transition: width 0.3s ease;
    }

    .fill-cyan { background: linear-gradient(90deg, #0284c7, #38bdf8); }
    .fill-rose { background: linear-gradient(90deg, #e11d48, #fb7185); }

    .text-pink { color: #f472b6; }
    .text-emerald { color: #34d399; }
    .text-amber { color: #fbbf24; }
    .text-rose { color: #fb7185; }
    .text-cyan { color: #38bdf8; }

    :host ::ng-deep .icon-emerald { color: #34d399; }
    :host ::ng-deep .icon-cyan { color: #38bdf8; }
    :host ::ng-deep .icon-rose { color: #f43f5e; }
  `]
})
export class TabAudienceComponent {
  @Input() audience?: AudienceData;
  @Input() extra?: ExtraData;
  @Input() source: DataSource = 'apify';

  searchNotFollowing = '';
  searchMutual = '';
  copiedType: string | null = null;

  get hasGraphInsights(): boolean {
    return !!this.extra?.ultimos_30_dias && Object.keys(this.extra.ultimos_30_dias).length > 0;
  }

  get hasDemographics(): boolean {
    return !!this.extra?.demografia && (!!this.extra.demografia.age || !!this.extra.demografia.gender);
  }

  get hasInstaAudience(): boolean {
    return !!this.audience && (
      (this.audience.not_following_back && this.audience.not_following_back.length > 0) ||
      (this.audience.mutual && this.audience.mutual.length > 0)
    );
  }

  get filteredNotFollowing(): string[] {
    const list = this.audience?.not_following_back || [];
    if (!this.searchNotFollowing.trim()) return list;
    const term = this.searchNotFollowing.toLowerCase().trim();
    return list.filter(u => u.toLowerCase().includes(term));
  }

  get filteredMutual(): string[] {
    const list = this.audience?.mutual || [];
    if (!this.searchMutual.trim()) return list;
    const term = this.searchMutual.toLowerCase().trim();
    return list.filter(u => u.toLowerCase().includes(term));
  }

  get maxAge(): number {
    if (!this.extra?.demografia?.age) return 1;
    return Math.max(...Object.values(this.extra.demografia.age), 1);
  }

  get maxGender(): number {
    if (!this.extra?.demografia?.gender) return 1;
    return Math.max(...Object.values(this.extra.demografia.gender), 1);
  }

  getDemoEntries(obj?: Record<string, number>): { key: string; val: number }[] {
    if (!obj) return [];
    return Object.entries(obj).map(([key, val]) => ({ key, val }));
  }

  getDemoPct(val: number, max: number): number {
    return Math.min(Math.max((val / max) * 100, 5), 100);
  }

  formatGender(key: string): string {
    if (key === 'M') return 'Masculino';
    if (key === 'F') return 'Feminino';
    if (key === 'U') return 'Não Especificado';
    return key;
  }

  copyToClipboard(users: string[], type: string): void {
    if (!users || users.length === 0) return;
    const text = users.map(u => `@${u}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      this.copiedType = type;
      setTimeout(() => (this.copiedType = null), 2000);
    });
  }
}
