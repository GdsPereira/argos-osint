import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataSource, ProfileInfo, AnalysisSummary } from '../../models/instagram.model';
import { IconComponent } from '../ui/icon/icon.component';

@Component({
  selector: 'app-profile-header',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="profile-card" *ngIf="info">
      <div class="profile-main">
        <!-- Avatar with Instagram Gradient Ring -->
        <div class="avatar-container" [class.verified-ring]="info.verificado">
          <img *ngIf="avatarSrc && !avatarFailed" 
               [src]="avatarSrc" 
               [alt]="info.username" 
               class="avatar-img"
               loading="lazy"
               referrerpolicy="no-referrer"
               (error)="onAvatarError($event)" />
          <div *ngIf="!avatarSrc || avatarFailed" class="avatar-fallback">
            {{ info.username ? info.username.charAt(0).toUpperCase() : '?' }}
          </div>
        </div>

        <!-- Info Details -->
        <div class="profile-details">
          <div class="profile-title-row">
            <div class="username-group">
              <h1 class="username">&#64;{{ info.username }}</h1>
              <a [href]="'https://www.instagram.com/' + info.username" 
                 target="_blank" 
                 rel="noopener noreferrer" 
                 class="ig-link-pill" 
                 title="Abrir perfil no Instagram">
                <span>Instagram</span>
                <app-icon name="external-link" [size]="12"></app-icon>
              </a>
            </div>
            
            <!-- Badges -->
            <div class="badges-row">
              <span *ngIf="info.verificado" class="badge badge-verified" title="Conta Verificada Oficialmente">
                <app-icon name="check" [size]="12" [strokeWidth]="2.5"></app-icon>
                <span>Verificado</span>
              </span>

              <span *ngIf="info.conta_business" class="badge badge-primary">
                <app-icon name="briefcase" [size]="12"></app-icon>
                <span>{{ info.categoria_business || 'Conta Comercial' }}</span>
              </span>

              <span *ngIf="info.privado" class="badge badge-warning">
                <app-icon name="lock" [size]="12"></app-icon>
                <span>Privado</span>
              </span>

              <span class="badge badge-neutral">
                {{ sourceLabel(source) }}
              </span>
            </div>
          </div>

          <!-- Full name -->
          <div class="fullname" *ngIf="info.nome_completo">
            {{ info.nome_completo }}
          </div>

          <!-- Bio -->
          <p class="bio" *ngIf="info.bio">{{ info.bio }}</p>

          <!-- External link -->
          <div class="external-link" *ngIf="isValidExternalLink(info.link_externo)">
            <app-icon name="globe" [size]="14" customClass="icon-cyan"></app-icon>
            <a [href]="formatUrl(info.link_externo!)" target="_blank" rel="noopener noreferrer">
              {{ info.link_externo }}
            </a>
          </div>

          <!-- Contact & Commercial Info -->
          <div class="contact-strip" *ngIf="info.email || info.telefone || info.endereco">
            <span class="contact-pill" *ngIf="info.email" title="E-mail comercial">
              <app-icon name="mail" [size]="13"></app-icon>
              <a [href]="'mailto:' + info.email">{{ info.email }}</a>
            </span>
            <span class="contact-pill" *ngIf="info.telefone" title="Telefone / WhatsApp">
              <app-icon name="phone" [size]="13"></app-icon>
              <a [href]="'tel:' + info.telefone">{{ info.telefone }}</a>
            </span>
            <span class="contact-pill" *ngIf="formatAddress(info.endereco)" title="Endereço cadastrado">
              <app-icon name="map-pin" [size]="13"></app-icon>
              <span>{{ formatAddress(info.endereco) }}</span>
            </span>
          </div>

          <!-- Similar Accounts / Competitors Suggested -->
          <div class="similar-strip" *ngIf="info.perfis_similares && info.perfis_similares.length > 0">
            <span class="similar-label">
              <app-icon name="users" [size]="13"></app-icon>
              <span>Concorrentes / Perfis Similares:</span>
            </span>
            <span class="similar-pill" *ngFor="let sim of info.perfis_similares">
              <a [href]="'https://www.instagram.com/' + sim" target="_blank" rel="noopener noreferrer">&#64;{{ sim }}</a>
            </span>
          </div>
        </div>
      </div>

      <!-- Quick Metrics Strip -->
      <div class="stats-strip">
        <div class="stat-item" [title]="(info.seguidores | number) + ' seguidores totais'">
          <span class="stat-number">{{ formatNumber(info.seguidores) }}</span>
          <span class="stat-label">Seguidores</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item" [title]="(info.seguindo | number) + ' perfis seguidos'">
          <span class="stat-number">{{ formatNumber(info.seguindo) }}</span>
          <span class="stat-label">Seguindo</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item" [title]="(info.posts | number) + ' postagens no feed'">
          <span class="stat-number">{{ formatNumber(info.posts) }}</span>
          <span class="stat-label">Publicações</span>
        </div>
        <div class="stat-divider" *ngIf="info.destaques_count"></div>
        <div class="stat-item" *ngIf="info.destaques_count">
          <span class="stat-number text-accent">{{ info.destaques_count }}</span>
          <span class="stat-label">Destaques</span>
        </div>
        <div class="stat-divider" *ngIf="summary"></div>
        <div class="stat-item" *ngIf="summary" title="Razão Seguidores / Seguindo">
          <span class="stat-number text-accent">
            {{ summary.seguidores_por_seguindo | number:'1.1-2' }}x
          </span>
          <span class="stat-label">Ratio Seg/Seguindo</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .profile-card {
      background: var(--bg-card);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-lg);
      padding: 1.75rem 2rem;
      margin-bottom: 1.5rem;
      box-shadow: var(--shadow-sm);
      position: relative;
      overflow: hidden;
    }

    .profile-card::after {
      content: '';
      position: absolute;
      top: -60px;
      right: -60px;
      width: 220px;
      height: 220px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(225, 48, 108, 0.12) 0%, transparent 70%);
      pointer-events: none;
    }

    .profile-main {
      display: flex;
      align-items: flex-start;
      gap: 1.75rem;
      margin-bottom: 1.5rem;
    }

    @media (max-width: 768px) {
      .profile-main {
        flex-direction: column;
        align-items: center;
        text-align: center;
      }
      .profile-details {
        align-items: center;
      }
      .badges-row {
        justify-content: center;
      }
      .username-group {
        justify-content: center;
      }
    }

    .avatar-container {
      position: relative;
      width: 96px;
      height: 96px;
      border-radius: 50%;
      padding: 3px;
      background: var(--ig-gradient);
      box-shadow: 0 4px 18px rgba(225, 48, 108, 0.35);
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    .avatar-img {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
      background: #000;
      border: 2px solid var(--bg-card);
      display: block;
    }

    .avatar-fallback {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: var(--bg-surface-elevated);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2.2rem;
      font-weight: 800;
      border: 2px solid var(--bg-card);
    }

    .profile-details {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }

    .profile-title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-bottom: 0.35rem;
    }

    .username-group {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      flex-wrap: wrap;
    }

    .username {
      font-size: 1.5rem;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.025em;
      line-height: 1.2;
    }

    .ig-link-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.2rem 0.55rem;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-full);
      font-size: 0.75rem;
      color: var(--text-secondary);
      transition: all var(--transition-fast);
    }
    .ig-link-pill:hover {
      color: #ffffff;
      background: rgba(225, 48, 108, 0.15);
      border-color: var(--ig-pink);
    }

    .badges-row {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      flex-wrap: wrap;
    }

    .badge-verified {
      background: rgba(56, 189, 248, 0.15);
      color: #38bdf8;
      border: 1px solid rgba(56, 189, 248, 0.35);
    }

    .fullname {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 0.35rem;
    }

    .bio {
      font-size: 0.875rem;
      color: var(--text-secondary);
      line-height: 1.5;
      white-space: pre-line;
      margin-bottom: 0.65rem;
      max-width: 780px;
    }

    .external-link {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      font-size: 0.85rem;
      margin-bottom: 0.65rem;
    }

    .external-link a {
      color: var(--accent-cyan);
      font-weight: 600;
      text-decoration: underline;
      text-underline-offset: 3px;
    }

    .contact-strip {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
      margin-bottom: 0.65rem;
    }

    .contact-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.25rem 0.65rem;
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-sm);
      font-size: 0.78rem;
      color: var(--text-secondary);
    }

    .contact-pill a {
      color: var(--text-primary);
    }
    .contact-pill a:hover {
      color: var(--accent-cyan);
    }

    .similar-strip {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      flex-wrap: wrap;
      margin-top: 0.35rem;
      padding-top: 0.5rem;
      border-top: 1px solid var(--border-subtle);
    }

    .similar-label {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.76rem;
      font-weight: 600;
      color: var(--text-muted);
    }

    .similar-pill {
      display: inline-flex;
      align-items: center;
      padding: 0.15rem 0.5rem;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-full);
      font-size: 0.75rem;
    }
    .similar-pill a {
      color: var(--text-secondary);
    }
    .similar-pill:hover a {
      color: #ffffff;
    }

    /* Stats Strip */
    .stats-strip {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 2rem;
      padding-top: 1.25rem;
      border-top: 1px solid var(--border-subtle);
      flex-wrap: wrap;
    }

    .stat-item {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }

    .stat-number {
      font-size: 1.45rem;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.02em;
      font-variant-numeric: tabular-nums;
      line-height: 1.1;
    }

    .stat-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .stat-divider {
      width: 1px;
      height: 32px;
      background: var(--border-default);
    }

    .text-accent {
      color: var(--accent-cyan);
    }

    :host ::ng-deep .icon-cyan {
      color: var(--accent-cyan);
    }
  `]
})
export class ProfileHeaderComponent implements OnChanges {
  @Input() info!: ProfileInfo;
  @Input() summary?: AnalysisSummary;
  @Input() source: DataSource = 'apify';

  avatarFailed = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['info']) {
      this.avatarFailed = false;
    }
  }

  get avatarSrc(): string {
    if (!this.info?.foto_perfil) return '';
    const raw = this.info.foto_perfil.trim();
    if (raw.startsWith('/api/') || raw.startsWith('data:')) {
      return raw;
    }
    return `/api/proxy-image?url=${encodeURIComponent(raw)}`;
  }

  onAvatarError(event: any): void {
    this.avatarFailed = true;
  }

  isValidExternalLink(url?: string | null): boolean {
    if (!url) return false;
    const trimmed = url.trim().toLowerCase();
    return trimmed !== '' && trimmed !== 'none' && trimmed !== 'null' && trimmed !== 'undefined';
  }

  formatUrl(url: string): string {
    if (!url) return '';
    return url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
  }

  formatAddress(addr: any): string {
    if (!addr) return '';
    if (typeof addr === 'string') return addr;
    if (typeof addr === 'object') {
      const parts = [addr.street_address, addr.city_name, addr.zip_code].filter(Boolean);
      return parts.join(', ') || addr.city_name || '';
    }
    return '';
  }

  formatNumber(val: number): string {
    if (val === undefined || val === null) return '0';
    if (val >= 1_000_000) {
      return (val / 1_000_000).toFixed(1).replace('.0', '') + 'M';
    }
    if (val >= 1_000) {
      return (val / 1_000).toFixed(1).replace('.0', '') + 'k';
    }
    return val.toLocaleString('pt-BR');
  }

  sourceLabel(src: DataSource): string {
    switch (src) {
      case 'apify': return 'Apify Scraper';
      case 'own': return 'Graph API (Própria)';
      case 'discovery': return 'Graph API (Discovery)';
      case 'insta': return 'Instaloader';
      default: return src;
    }
  }
}
