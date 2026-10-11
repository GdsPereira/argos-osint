import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HashtagsData, TagCount } from '../../models/instagram.model';
import { IconComponent } from '../ui/icon/icon.component';

@Component({
  selector: 'app-tab-hashtags',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="tab-content-wrapper">
      <div class="grid-2">
        <!-- Top Hashtags by Frequency -->
        <div class="card">
          <div class="card-title">
            <div class="title-left">
              <app-icon name="hash" [size]="18" customClass="icon-rose"></app-icon>
              <span>Hashtags Mais Frequentes</span>
            </div>
            <span class="badge badge-primary">Top 15 Usadas</span>
          </div>
          <p class="card-subtitle">
            Termos com maior recorrência nas legendas das postagens analisadas.
          </p>

          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Hashtag</th>
                  <th>Ocorrências</th>
                  <th style="width: 40%;">Proporção Visual</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let h of hashtags?.top">
                  <td>
                    <span class="hashtag-pill">#{{ h.item }}</span>
                  </td>
                  <td class="number-font"><strong>{{ h.usos }}x</strong></td>
                  <td>
                    <div class="progress-bar-bg">
                      <div class="progress-bar-fill" [style.width.%]="getBarWidth(h.usos, maxTopUsos)"></div>
                    </div>
                  </td>
                </tr>
                <tr *ngIf="!hashtags?.top || hashtags?.top?.length === 0">
                  <td colspan="3" class="text-center text-muted py-3">Nenhuma hashtag encontrada nos posts.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Hashtag Performance by Avg Interactions -->
        <div class="card">
          <div class="card-title">
            <div class="title-left">
              <app-icon name="trend-up" [size]="18" customClass="icon-emerald"></app-icon>
              <span>Performance por Hashtag</span>
            </div>
            <span class="badge badge-success">Média de Interações</span>
          </div>
          <p class="card-subtitle">
            Média de engajamento gerado por hashtags com pelo menos 2 ocorrências.
          </p>

          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Hashtag</th>
                  <th>Usos</th>
                  <th>Média de Interações</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let p of hashtags?.performance">
                  <td>
                    <span class="hashtag-pill pill-success">#{{ p.item }}</span>
                  </td>
                  <td class="number-font">{{ p.usos }}x</td>
                  <td>
                    <strong class="highlight-cyan number-font">{{ p.media | number:'1.0-1' }}</strong>
                  </td>
                </tr>
                <tr *ngIf="!hashtags?.performance || hashtags?.performance?.length === 0">
                  <td colspan="3" class="text-center text-muted py-3">
                    Ainda não há hashtags repetidas (>=2 usos) para cálculo de média.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Mentions & Tagged Users Grid -->
      <div class="grid-3 mt-4">
        <!-- Mentions (@) -->
        <div class="card">
          <div class="card-title">
            <div class="title-left">
              <app-icon name="message-square" [size]="18" customClass="icon-cyan"></app-icon>
              <span>Menções na Legenda</span>
            </div>
            <span class="badge badge-neutral">{{ mentions.length }} perfis</span>
          </div>
          <p class="card-subtitle">Perfis citados no corpo textual da postagem.</p>

          <div class="tags-list" *ngIf="mentions && mentions.length > 0">
            <div class="tag-item" *ngFor="let m of mentions">
              <a [href]="'https://www.instagram.com/' + cleanUsername(m.item)" target="_blank" class="mention-link">
                &#64;{{ cleanUsername(m.item) }}
              </a>
              <span class="tag-count number-font">{{ m.usos }}x</span>
            </div>
          </div>
          <div *ngIf="!mentions || mentions.length === 0" class="text-muted text-center py-3">
            Nenhuma menção encontrada.
          </div>
        </div>

        <!-- Tagged Users -->
        <div class="card">
          <div class="card-title">
            <div class="title-left">
              <app-icon name="users" [size]="18" customClass="icon-indigo"></app-icon>
              <span>Usuários Marcados</span>
            </div>
            <span class="badge badge-neutral">{{ tagged.length }} marcados</span>
          </div>
          <p class="card-subtitle">Contas marcadas na mídia da publicação.</p>

          <div class="tags-list" *ngIf="tagged && tagged.length > 0">
            <div class="tag-item" *ngFor="let t of tagged">
              <a [href]="'https://www.instagram.com/' + cleanUsername(t.item)" target="_blank" class="mention-link">
                &#64;{{ cleanUsername(t.item) }}
              </a>
              <span class="tag-count number-font">{{ t.usos }}x</span>
            </div>
          </div>
          <div *ngIf="!tagged || tagged.length === 0" class="text-muted text-center py-3">
            Nenhum usuário marcado nas fotos.
          </div>
        </div>

        <!-- Locations -->
        <div class="card">
          <div class="card-title">
            <div class="title-left">
              <app-icon name="map-pin" [size]="18" customClass="icon-amber"></app-icon>
              <span>Localizações</span>
            </div>
            <span class="badge badge-neutral">{{ locations.length }} locais</span>
          </div>
          <p class="card-subtitle">Geolocalizações adicionadas aos posts.</p>

          <div class="tags-list" *ngIf="locations && locations.length > 0">
            <div class="tag-item" *ngFor="let loc of locations">
              <span class="location-name">
                <app-icon name="map-pin" [size]="12"></app-icon>
                <span>{{ loc.item }}</span>
              </span>
              <span class="tag-count number-font">{{ loc.usos }}x</span>
            </div>
          </div>
          <div *ngIf="!locations || locations.length === 0" class="text-muted text-center py-3">
            Nenhuma geolocalização informada.
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .mt-4 {
      margin-top: 1.5rem;
    }

    .number-font {
      font-variant-numeric: tabular-nums;
    }

    .hashtag-pill {
      display: inline-block;
      padding: 0.22rem 0.65rem;
      border-radius: var(--radius-sm);
      font-size: 0.8rem;
      font-weight: 600;
      color: #f472b6;
      background: rgba(225, 48, 108, 0.12);
      border: 1px solid rgba(225, 48, 108, 0.25);
      transition: all var(--transition-fast);
    }
    .hashtag-pill:hover {
      background: rgba(225, 48, 108, 0.22);
      border-color: var(--ig-pink);
    }

    .pill-success {
      color: #6ee7b7;
      background: rgba(16, 185, 129, 0.12);
      border-color: rgba(16, 185, 129, 0.25);
    }

    .highlight-cyan {
      color: var(--accent-cyan);
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
      background: var(--ig-gradient);
      border-radius: var(--radius-full);
      transition: width 0.3s ease;
    }

    .tags-list {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      max-height: 250px;
      overflow-y: auto;
    }

    .tag-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.45rem 0.65rem;
      background: var(--bg-surface-elevated);
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-subtle);
      font-size: 0.825rem;
      transition: border-color var(--transition-fast);
    }
    .tag-item:hover {
      border-color: var(--border-hover);
    }

    .mention-link {
      color: var(--accent-cyan);
      font-weight: 600;
      text-decoration: none;
    }
    .mention-link:hover {
      text-decoration: underline;
    }

    .location-name {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      color: var(--text-primary);
      font-weight: 500;
    }

    .tag-count {
      font-weight: 700;
      color: var(--text-muted);
      font-size: 0.75rem;
    }

    .text-center {
      text-align: center;
    }

    .py-3 {
      padding-top: 1rem;
      padding-bottom: 1rem;
    }

    :host ::ng-deep .icon-rose { color: #f43f5e; }
    :host ::ng-deep .icon-emerald { color: #10b981; }
    :host ::ng-deep .icon-cyan { color: #38bdf8; }
    :host ::ng-deep .icon-indigo { color: #818cf8; }
    :host ::ng-deep .icon-amber { color: #fbbf24; }
  `]
})
export class TabHashtagsComponent {
  @Input() hashtags?: HashtagsData;
  @Input() mentions: TagCount[] = [];
  @Input() tagged: TagCount[] = [];
  @Input() locations: TagCount[] = [];

  get maxTopUsos(): number {
    if (!this.hashtags?.top || this.hashtags.top.length === 0) return 1;
    return Math.max(...this.hashtags.top.map(h => h.usos), 1);
  }

  getBarWidth(usos: number, max: number): number {
    return Math.min(Math.max((usos / max) * 100, 5), 100);
  }

  cleanUsername(user: string): string {
    if (!user) return '';
    return user.replace(/^@+/, '').trim();
  }
}
