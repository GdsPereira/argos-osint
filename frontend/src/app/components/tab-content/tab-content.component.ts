import { Component, Input, AfterViewInit, OnDestroy, OnChanges, SimpleChanges, ViewChild, ElementRef, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import Chart from 'chart.js/auto';
import { AnalysisCharts, ExtraData, HighlightItem, HighlightMediaItem, PostItem, TypeBreakdown } from '../../models/instagram.model';
import { ApiService } from '../../services/api.service';
import { IconComponent } from '../ui/icon/icon.component';

@Component({
  selector: 'app-tab-content',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="tab-content-wrapper">
      <div class="grid-2">
        <!-- Media Type Distribution (Pie/Doughnut) -->
        <div class="card">
          <div class="card-title">
            <div class="title-left">
              <app-icon name="bar-chart" [size]="18" customClass="icon-indigo"></app-icon>
              <span>Distribuição de Formatos</span>
            </div>
          </div>
          <p class="card-subtitle">
            Proporção quantitativa entre fotos estáticas, vídeos/reels e álbuns em carrossel.
          </p>

          <div class="chart-container-sm" *ngIf="charts?.by_type?.length">
            <canvas #pieCanvas></canvas>
          </div>
          <div *ngIf="!charts?.by_type?.length" class="empty-state">
            <div class="empty-state-icon">
              <app-icon name="bar-chart" [size]="24"></app-icon>
            </div>
            <p class="empty-state-desc">Nenhum formato de conteúdo identificado.</p>
          </div>
        </div>

        <!-- Performance by Format (Bar Chart) -->
        <div class="card">
          <div class="card-title">
            <div class="title-left">
              <app-icon name="zap" [size]="18" customClass="icon-amber"></app-icon>
              <span>Média de Interações por Formato</span>
            </div>
          </div>
          <p class="card-subtitle">
            Comparativo de tração do público conforme o formato da mídia publicada.
          </p>

          <div class="chart-container-sm" *ngIf="charts?.by_type?.length">
            <canvas #formatBarCanvas></canvas>
          </div>
          <div *ngIf="!charts?.by_type?.length" class="empty-state">
            <div class="empty-state-icon">
              <app-icon name="zap" [size]="24"></app-icon>
            </div>
            <p class="empty-state-desc">Dados insuficientes para médias por formato.</p>
          </div>
        </div>
      </div>

      <!-- Performance Table by Type -->
      <div class="card mb-4">
        <div class="card-title">
          <div class="title-left">
            <app-icon name="file-text" [size]="18" customClass="icon-cyan"></app-icon>
            <span>Tabela Detalhada por Tipo de Conteúdo</span>
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Formato de Mídia</th>
                <th>Volume de Posts</th>
                <th>% do Total</th>
                <th>Média de Curtidas</th>
                <th>Média de Comentários</th>
                <th>Média Interações Totais</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of charts?.by_type">
                <td>
                  <strong class="format-title">{{ formatTypeName(item.tipo) }}</strong>
                </td>
                <td class="number-font">{{ item.posts }}</td>
                <td class="number-font">{{ getPercentage(item.posts) | number:'1.1-1' }}%</td>
                <td class="number-font">{{ item.curtidas | number:'1.0-0' }}</td>
                <td class="number-font">{{ item.comentarios | number:'1.1-1' }}</td>
                <td>
                  <span class="highlight-val number-font">{{ item.interacoes | number:'1.0-0' }}</span>
                </td>
              </tr>
              <tr *ngIf="!charts?.by_type?.length">
                <td colspan="6" class="text-center text-muted py-4">Nenhum formato registrado.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Caption Length vs Interactions Scatter / Analysis -->
      <div class="card mb-4">
        <div class="card-title">
          <div class="title-left">
            <app-icon name="sparkles" [size]="18" customClass="icon-rose"></app-icon>
            <span>Tamanho da Legenda vs. Engajamento</span>
          </div>
          <span class="badge badge-primary">Correlação de Caracteres</span>
        </div>
        <p class="card-subtitle">
          Relação entre o volume de caracteres na legenda e as interações geradas.
        </p>

        <div class="chart-container" *ngIf="charts?.caption?.length">
          <canvas #captionScatterCanvas></canvas>
        </div>
        <div *ngIf="!charts?.caption?.length" class="empty-state">
          <div class="empty-state-icon">
            <app-icon name="file-text" [size]="24"></app-icon>
          </div>
          <p class="empty-state-desc">Nenhuma legenda disponível para traçar dispersão de caracteres.</p>
        </div>
      </div>

      <!-- Profile Highlights Card (Apify) -->
      <div class="card mb-4" *ngIf="extra?.highlights?.length">
        <div class="card-title">
          <div class="title-left">
            <app-icon name="award" [size]="18" customClass="icon-yellow"></app-icon>
            <span>Destaques Salvos no Perfil (Highlights)</span>
          </div>
          <div class="highlights-header-actions">
            <span class="badge badge-primary">{{ extra!.highlights!.length }} destaques</span>
            <button class="btn btn-outline btn-sm btn-hl-export" (click)="exportHighlightsCsv()" title="Exportar resumo de destaques em planilha CSV">
              <app-icon name="download" [size]="12"></app-icon>
              <span>CSV Resumo</span>
            </button>
            <button class="btn btn-primary btn-sm btn-hl-export" (click)="exportHighlightMediaCsv()" title="Exportar todas as mídias (fotos e vídeos) dos destaques em planilha CSV">
              <app-icon name="download" [size]="12"></app-icon>
              <span>Todas as Mídias CSV</span>
            </button>
            <button class="btn btn-outline btn-sm btn-hl-export" (click)="exportHighlightsJson()" title="Exportar destaques em formato JSON">
              <app-icon name="download" [size]="12"></app-icon>
              <span>JSON</span>
            </button>
          </div>
        </div>
        <p class="card-subtitle">
          Stories permanentes fixados na biografia do perfil, com capas, contagem real de mídias e extração de vídeos e fotos.
        </p>

        <div class="highlights-grid">
          <div class="highlight-item-card" *ngFor="let h of extra?.highlights">
            <div class="highlight-cover-wrapper" *ngIf="(h.coverImageUrl || h.cover) && !h.coverFailed; else fallbackCover">
              <img [src]="h.coverImageUrl || h.cover" 
                   [alt]="h.title || 'Destaque'" 
                   class="highlight-cover"
                   referrerpolicy="no-referrer"
                   crossorigin="anonymous" 
                   (error)="h.coverFailed = true" />
            </div>
            <ng-template #fallbackCover>
              <div class="highlight-cover-wrapper highlight-cover-fallback">
                <app-icon name="award" [size]="24" customClass="icon-yellow"></app-icon>
              </div>
            </ng-template>

            <div class="highlight-info">
              <span class="highlight-title" [title]="h.title || 'Sem título'">{{ h.title || 'Sem título' }}</span>
              <span class="highlight-count">
                {{ (h.items?.length || h.mediaCount || h.media_count || 0) }} mídias
              </span>
              <div class="highlight-actions">
                <button *ngIf="h.items?.length" (click)="openHighlightModal(h)" class="story-link-media" title="Ver mídias e fotos deste destaque">
                  <app-icon name="eye" [size]="11"></app-icon>
                  <span>Ver Mídias ({{ h.items?.length }})</span>
                </button>
                <a *ngIf="h.url" [href]="h.url" target="_blank" rel="noopener noreferrer" class="story-link" title="Abrir destaque no Instagram">
                  <span>Instagram</span>
                  <app-icon name="external-link" [size]="11"></app-icon>
                </a>
                <a *ngIf="h.coverImageUrl || h.cover" [href]="h.coverImageUrl || h.cover" target="_blank" rel="noopener noreferrer" class="story-link story-link-cover" title="Abrir capa em alta definição">
                  <span>Capa HD</span>
                  <app-icon name="image" [size]="11"></app-icon>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal de Conteúdos/Stories do Destaque Selecionado -->
      <div class="hl-modal-backdrop" *ngIf="selectedHighlight" (click)="closeHighlightModal()">
        <div class="hl-modal-container" (click)="$event.stopPropagation()">
          <div class="hl-modal-header">
            <div class="hl-modal-title-box">
              <div class="hl-modal-badge">
                <app-icon name="award" [size]="18" customClass="icon-yellow"></app-icon>
              </div>
              <div>
                <h3 class="hl-modal-title">{{ selectedHighlight.title || 'Destaque' }}</h3>
                <span class="hl-modal-subtitle">
                  {{ selectedHighlight.items?.length || 0 }} mídias extraídas • ID: {{ selectedHighlight.id }}
                </span>
              </div>
            </div>
            <button class="hl-modal-close" (click)="closeHighlightModal()" title="Fechar janela">
              <app-icon name="x" [size]="18"></app-icon>
            </button>
          </div>

          <div class="hl-modal-body">
            <div class="hl-stories-grid">
              <div class="hl-story-card" *ngFor="let s of selectedHighlight.items; let sIdx = index">
                <div class="hl-story-media-preview" 
                     (click)="openStoryViewer(s, sIdx, selectedHighlight.items, selectedHighlight.title)"
                     title="Clique para assistir/visualizar no player integrado">
                  <img *ngIf="s.thumbnail_url || s.media_url" 
                       [src]="s.thumbnail_url || s.media_url" 
                       [alt]="'Story ' + (sIdx + 1)"
                       class="hl-story-thumb" 
                       referrerpolicy="no-referrer"
                       crossorigin="anonymous" />
                  <span class="hl-story-type-badge" [class.badge-video]="s.type === 'video' || s.is_video">
                    <app-icon [name]="(s.type === 'video' || s.is_video) ? 'play' : 'image'" [size]="10"></app-icon>
                    <span>{{ (s.type === 'video' || s.is_video) ? 'Vídeo' : 'Foto' }}</span>
                  </span>
                  <span class="hl-story-index-badge">#{{ sIdx + 1 }}</span>

                  <!-- Overlay Play / View button -->
                  <div class="hl-play-overlay" *ngIf="s.type === 'video' || s.is_video">
                    <div class="hl-play-btn-circle">
                      <app-icon name="play" [size]="20"></app-icon>
                    </div>
                    <span class="hl-play-btn-text">Assistir Vídeo</span>
                  </div>
                  <div class="hl-view-overlay" *ngIf="!(s.type === 'video' || s.is_video)">
                    <div class="hl-view-btn-circle">
                      <app-icon name="eye" [size]="16"></app-icon>
                    </div>
                  </div>
                </div>

                <div class="hl-story-details">
                  <div class="hl-story-meta" *ngIf="s.timestamp || s.data">
                    <app-icon name="calendar" [size]="11"></app-icon>
                    <span>{{ s.timestamp || s.data }}</span>
                  </div>
                  <p class="hl-story-caption" *ngIf="s.caption || s.legenda" [title]="s.caption || s.legenda">
                    {{ s.caption || s.legenda }}
                  </p>
                  <a class="hl-story-sticker-link" *ngIf="s.link_sticker" [href]="s.link_sticker" target="_blank" rel="noopener noreferrer">
                    <app-icon name="globe" [size]="11"></app-icon>
                    <span>Link do Sticker</span>
                  </a>
                  <div class="hl-story-actions">
                    <button type="button" 
                            class="story-link-btn btn-watch-action" 
                            (click)="openStoryViewer(s, sIdx, selectedHighlight.items, selectedHighlight.title)"
                            [title]="(s.type === 'video' || s.is_video) ? 'Assistir ao vídeo sem abrir nova aba' : 'Visualizar imagem'">
                      <app-icon [name]="(s.type === 'video' || s.is_video) ? 'play' : 'eye'" [size]="12"></app-icon>
                      <span>{{ (s.type === 'video' || s.is_video) ? 'Assistir' : 'Ver' }}</span>
                    </button>
                    <a *ngIf="s.media_url" [href]="s.media_url" download target="_blank" class="story-link-btn btn-dl" title="Baixar arquivo de mídia">
                      <app-icon name="download" [size]="11"></app-icon>
                      <span>Baixar</span>
                    </a>
                    <a *ngIf="s.media_url" [href]="s.media_url" target="_blank" rel="noopener noreferrer" class="story-link-btn btn-ext-icon" title="Abrir link original em nova aba">
                      <app-icon name="external-link" [size]="11"></app-icon>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tagged Posts Card (Apify) -->
      <div class="card mb-4" *ngIf="extra?.tagged_posts?.length">
        <div class="card-title">
          <div class="title-left">
            <app-icon name="hash" [size]="18" customClass="icon-cyan"></app-icon>
            <span>Publicações Marcadas por Terceiros (Tagged)</span>
          </div>
          <span class="badge badge-ig">{{ extra!.tagged_posts!.length }} posts</span>
        </div>
        <p class="card-subtitle">
          Conteúdo gerado por clientes, parceiros e terceiros marcando o perfil.
        </p>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Formato</th>
                <th>Data</th>
                <th>Curtidas</th>
                <th>Comentários</th>
                <th>Música / Áudio</th>
                <th>Legenda</th>
                <th style="text-align: right;">Ação</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let p of extra?.tagged_posts">
                <td>
                  <span class="badge badge-neutral">{{ p.tipo || (p.is_video ? 'Vídeo' : 'Foto') }}</span>
                </td>
                <td class="number-font">{{ p.data ? (p.data | date:'dd/MM/yyyy') : '—' }}</td>
                <td class="number-font">{{ p.curtidas >= 0 ? (p.curtidas | number) : '—' }}</td>
                <td class="number-font">{{ p.comentarios | number }}</td>
                <td>
                  <span *ngIf="p.musica" class="audio-pill" [title]="(p.artista ? p.artista + ' - ' : '') + p.musica">
                    <app-icon name="music" [size]="11"></app-icon>
                    <span>{{ p.musica }}</span>
                  </span>
                  <span *ngIf="!p.musica" class="text-muted">—</span>
                </td>
                <td class="caption-col" [title]="p.legenda || ''">
                  {{ p.legenda ? (p.legenda.length > 60 ? p.legenda.slice(0, 60) + '...' : p.legenda) : '—' }}
                </td>
                <td style="text-align: right;">
                  <a [href]="p.url || ('https://www.instagram.com/p/' + p.shortcode + '/')" 
                     target="_blank" 
                     rel="noopener noreferrer" 
                     class="btn btn-outline btn-sm">
                    <span>Abrir</span>
                    <app-icon name="external-link" [size]="11"></app-icon>
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Active Stories Card (Apify) -->
      <div class="card" *ngIf="extra?.stories?.length">
        <div class="card-title">
          <div class="title-left">
            <app-icon name="clock" [size]="18" customClass="icon-amber"></app-icon>
            <span>Stories Ativos Extraídos (Últimas 24h)</span>
          </div>
          <span class="badge badge-success">{{ extra!.stories!.length }} stories</span>
        </div>
        <p class="card-subtitle">
          Stories temporários capturados pelo pipeline complementar da Apify.
        </p>

        <div class="stories-grid">
          <div class="story-item-card" *ngFor="let s of extra?.stories; let sIdx = index">
            <div class="story-header">
              <span class="badge badge-neutral">{{ s.tipo || (s.is_video ? 'Vídeo' : 'Foto') }}</span>
              <span class="story-time" *ngIf="s.data">{{ s.data | date:'HH:mm' }}</span>
            </div>
            <div class="story-details">
              <span *ngIf="s.visualizacoes" class="number-font">
                <app-icon name="eye" [size]="12"></app-icon> {{ s.visualizacoes }} views
              </span>
              <span *ngIf="s.expira_em" class="text-muted">Expira: {{ s.expira_em | date:'HH:mm' }}</span>
            </div>
            <div class="story-card-actions">
              <button *ngIf="s.url" type="button" class="btn btn-outline btn-sm story-view-btn" (click)="openActiveStoryViewer(s, sIdx)">
                <app-icon [name]="s.is_video ? 'play' : 'eye'" [size]="11"></app-icon>
                <span>{{ s.is_video ? 'Assistir' : 'Ver' }}</span>
              </button>
              <a *ngIf="s.url" [href]="s.url" target="_blank" rel="noopener noreferrer" class="story-link-icon" title="Abrir link original em nova aba">
                <app-icon name="external-link" [size]="12"></app-icon>
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- Visualizador / Player Integrado de Stories e Destaques (Lightbox) -->
      <div class="story-viewer-backdrop" *ngIf="activeStoryItem" (click)="closeStoryViewer()">
        <div class="story-viewer-modal" (click)="$event.stopPropagation()">
          
          <!-- Segmented Progress Bar (Instagram Stories style) -->
          <div class="story-progress-container" *ngIf="activeStoryList.length > 1">
            <div class="story-progress-segment" 
                 *ngFor="let item of activeStoryList; let idx = index"
                 [class.active]="idx === activeStoryIndex"
                 [class.completed]="idx < activeStoryIndex"
                 (click)="goToStory(idx)"
                 [title]="'Ir para mídia #' + (idx + 1)">
              <div class="story-progress-fill"></div>
            </div>
          </div>

          <!-- Viewer Header -->
          <div class="story-viewer-header">
            <div class="story-viewer-info">
              <div class="story-viewer-badge" [class.badge-video]="activeStoryItem.is_video || activeStoryItem.type === 'video'">
                <app-icon [name]="(activeStoryItem.is_video || activeStoryItem.type === 'video') ? 'play' : 'image'" [size]="14"></app-icon>
              </div>
              <div class="story-viewer-titles">
                <h4 class="story-viewer-title">{{ activeStoryContextTitle || 'Destaque' }}</h4>
                <span class="story-viewer-meta">
                  Mídia {{ activeStoryIndex + 1 }} de {{ activeStoryList.length }}
                  <span *ngIf="activeStoryItem.timestamp || activeStoryItem.data"> • {{ activeStoryItem.timestamp || activeStoryItem.data }}</span>
                </span>
              </div>
            </div>

            <div class="story-viewer-header-actions">
              <button class="viewer-icon-btn" 
                      *ngIf="activeStoryItem.is_video || activeStoryItem.type === 'video'"
                      (click)="toggleProxyForce(activeStoryItem)"
                      [class.btn-proxy-active]="isProxyForced(activeStoryItem)"
                      [title]="isProxyForced(activeStoryItem) ? 'Streaming via Proxy Backend Ativo (clique para alternar)' : 'Usar Proxy Backend para contornar restrições'">
                <app-icon name="shield" [size]="14"></app-icon>
                <span class="proxy-tag">Proxy</span>
              </button>
              <a *ngIf="activeStoryItem.media_url" 
                 [href]="activeStoryItem.media_url" 
                 download 
                 class="viewer-icon-btn" 
                 title="Baixar arquivo de mídia">
                <app-icon name="download" [size]="15"></app-icon>
              </a>
              <a *ngIf="activeStoryItem.media_url" 
                 [href]="activeStoryItem.media_url" 
                 target="_blank" 
                 rel="noopener noreferrer" 
                 class="viewer-icon-btn" 
                 title="Abrir URL original em nova aba">
                <app-icon name="external-link" [size]="15"></app-icon>
              </a>
              <button class="viewer-icon-btn btn-close-viewer" (click)="closeStoryViewer()" title="Fechar visualizador (Esc)">
                <app-icon name="x" [size]="18"></app-icon>
              </button>
            </div>
          </div>

          <!-- Viewer Media Stage -->
          <div class="story-viewer-stage">
            <!-- Nav Previous -->
            <button class="story-nav-btn nav-prev" 
                    *ngIf="activeStoryIndex > 0" 
                    (click)="prevStory()" 
                    title="Mídia anterior (Seta Esquerda)">
              <app-icon name="chevron-left" [size]="24"></app-icon>
            </button>

            <!-- Video Player -->
            <div class="story-media-player-box" *ngIf="activeStoryItem.is_video || activeStoryItem.type === 'video'">
              <video class="story-video-element"
                     [src]="getMediaPlaybackUrl(activeStoryItem)"
                     controls
                     autoplay
                     playsinline
                     referrerpolicy="no-referrer"
                     (error)="onVideoError(activeStoryItem)">
                Seu navegador não suporta reprodução direta de vídeo.
              </video>
              <div class="video-proxy-notice" *ngIf="isProxyForced(activeStoryItem)">
                <app-icon name="shield" [size]="11" customClass="icon-cyan"></app-icon>
                <span>Streaming via Proxy Backend ativo</span>
              </div>
            </div>

            <!-- Photo Viewer -->
            <div class="story-media-player-box" *ngIf="!(activeStoryItem.is_video || activeStoryItem.type === 'video')">
              <img [src]="getMediaPlaybackUrl(activeStoryItem)" 
                   [alt]="'Story ' + (activeStoryIndex + 1)"
                   class="story-photo-element"
                   referrerpolicy="no-referrer"
                   crossorigin="anonymous"
                   (error)="onImageError(activeStoryItem)" />
            </div>

            <!-- Nav Next -->
            <button class="story-nav-btn nav-next" 
                    *ngIf="activeStoryIndex < activeStoryList.length - 1" 
                    (click)="nextStory()" 
                    title="Próxima mídia (Seta Direita)">
              <app-icon name="chevron-right" [size]="24"></app-icon>
            </button>
          </div>

          <!-- Viewer Footer -->
          <div class="story-viewer-footer" *ngIf="activeStoryItem.caption || activeStoryItem.legenda || activeStoryItem.link_sticker">
            <p class="story-viewer-caption" *ngIf="activeStoryItem.caption || activeStoryItem.legenda">
              {{ activeStoryItem.caption || activeStoryItem.legenda }}
            </p>
            <div class="story-viewer-footer-links" *ngIf="activeStoryItem.link_sticker">
              <a [href]="activeStoryItem.link_sticker" target="_blank" rel="noopener noreferrer" class="story-sticker-btn">
                <app-icon name="globe" [size]="12"></app-icon>
                <span>Acessar Link do Sticker</span>
              </a>
            </div>
          </div>

        </div>
      </div>
    </div>
  `,
  styles: [`
    .mb-4 {
      margin-bottom: 1.5rem;
    }

    .chart-container-sm {
      position: relative;
      height: 280px;
      width: 100%;
    }

    .chart-container {
      position: relative;
      height: 320px;
      width: 100%;
    }

    .format-title {
      color: #ffffff;
    }

    .highlight-val {
      color: var(--accent-cyan);
      font-weight: 700;
    }

    .number-font {
      font-variant-numeric: tabular-nums;
    }

    .caption-col {
      max-width: 260px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--text-secondary);
      font-size: 0.825rem;
    }

    .stories-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1rem;
      margin-top: 1rem;
    }

    .story-item-card {
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      padding: 0.85rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .story-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .story-time {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .story-details {
      font-size: 0.8rem;
      color: var(--text-secondary);
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .story-link {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.8rem;
      color: var(--ig-pink);
      text-decoration: none;
      font-weight: 600;
      margin-top: auto;
    }

    .highlights-header-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .btn-hl-export {
      padding: 0.25rem 0.6rem;
      font-size: 0.75rem;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      border-radius: var(--radius-sm);
      cursor: pointer;
    }

    .highlights-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 1rem;
      margin-top: 1rem;
    }

    .highlight-item-card {
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      padding: 0.85rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 0.5rem;
      transition: all var(--transition-fast);
    }

    .highlight-item-card:hover {
      border-color: var(--border-hover);
      transform: translateY(-2px);
    }

    .highlight-cover-wrapper {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      padding: 2px;
      background: var(--ig-gradient);
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .highlight-cover-fallback {
      background: rgba(250, 204, 21, 0.12);
      border: 2px solid rgba(250, 204, 21, 0.35);
    }

    .highlight-cover {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
      background: var(--bg-base);
    }

    .highlight-info {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      align-items: center;
      width: 100%;
    }

    .highlight-title {
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--text-primary);
      max-width: 130px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .highlight-count {
      font-size: 0.7rem;
      color: var(--text-muted);
    }

    .highlight-actions {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      width: 100%;
      margin-top: 0.25rem;
    }

    .story-link-cover {
      color: var(--text-muted);
      font-size: 0.75rem;
      font-weight: 500;
    }

    .story-link-cover:hover {
      color: var(--text-primary);
    }

    .story-link-media {
      background: rgba(225, 48, 108, 0.12);
      border: 1px solid rgba(225, 48, 108, 0.4);
      color: #fff;
      border-radius: var(--radius-xs);
      padding: 0.25rem 0.45rem;
      cursor: pointer;
      font-size: 0.725rem;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.3rem;
      transition: all var(--transition-fast);
      width: 100%;
    }

    .story-link-media:hover {
      background: rgba(225, 48, 108, 0.25);
      border-color: var(--ig-pink);
    }

    /* Highlight Media Modal Styles */
    .hl-modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.82);
      backdrop-filter: blur(8px);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }

    .hl-modal-container {
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-lg);
      width: 100%;
      max-width: 920px;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      box-shadow: var(--shadow-lg);
      overflow: hidden;
      animation: modalFadeIn 0.2s ease-out;
    }

    @keyframes modalFadeIn {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }

    .hl-modal-header {
      padding: 1.25rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border-default);
      background: var(--bg-surface);
    }

    .hl-modal-title-box {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .hl-modal-badge {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(250, 204, 21, 0.12);
      border: 1px solid rgba(250, 204, 21, 0.35);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .hl-modal-title {
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0;
    }

    .hl-modal-subtitle {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .hl-modal-close {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 0.4rem;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all var(--transition-fast);
    }

    .hl-modal-close:hover {
      background: var(--border-subtle);
      color: var(--text-primary);
    }

    .hl-modal-body {
      padding: 1.5rem;
      overflow-y: auto;
      flex: 1;
    }

    .hl-stories-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1.25rem;
    }

    .hl-story-card {
      background: var(--bg-card);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: all var(--transition-fast);
    }

    .hl-story-card:hover {
      border-color: var(--border-hover);
      transform: translateY(-2px);
    }

    .hl-story-media-preview {
      position: relative;
      width: 100%;
      height: 220px;
      background: #000;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    .hl-story-thumb {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .hl-story-type-badge {
      position: absolute;
      top: 8px;
      left: 8px;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      padding: 0.2rem 0.45rem;
      border-radius: var(--radius-xs);
      font-size: 0.7rem;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      color: #fff;
    }

    .hl-story-type-badge.badge-video {
      background: rgba(225, 48, 108, 0.85);
    }

    .hl-story-index-badge {
      position: absolute;
      top: 8px;
      right: 8px;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      padding: 0.2rem 0.45rem;
      border-radius: var(--radius-xs);
      font-size: 0.7rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .hl-story-details {
      padding: 0.85rem;
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
      flex: 1;
    }

    .hl-story-meta {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.7rem;
      color: var(--text-muted);
    }

    .hl-story-caption {
      font-size: 0.75rem;
      color: var(--text-secondary);
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .hl-story-sticker-link {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.7rem;
      color: var(--accent-cyan);
      text-decoration: none;
      font-weight: 600;
    }

    .hl-story-sticker-link:hover {
      text-decoration: underline;
    }

    .hl-story-actions {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      margin-top: auto;
      padding-top: 0.4rem;
    }

    .story-link-btn {
      flex: 1;
      font-size: 0.7rem;
      font-weight: 600;
      padding: 0.3rem 0.4rem;
      border-radius: var(--radius-xs);
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.25rem;
      border: 1px solid var(--border-default);
      color: var(--text-secondary);
      background: var(--bg-surface);
      transition: all var(--transition-fast);
      cursor: pointer;
    }

    .story-link-btn:hover {
      border-color: var(--border-hover);
      color: var(--text-primary);
    }

    .story-link-btn.btn-dl {
      background: var(--ig-gradient-vibrant);
      border: none;
      color: #fff;
    }

    .story-link-btn.btn-dl:hover {
      opacity: 0.9;
    }

    .story-link-btn.btn-watch-action {
      background: var(--ig-gradient-vibrant);
      border: none;
      color: #fff;
      font-weight: 700;
      box-shadow: 0 2px 8px rgba(225, 48, 108, 0.25);
    }

    .story-link-btn.btn-watch-action:hover {
      opacity: 0.92;
      transform: translateY(-1px);
    }

    .story-link-btn.btn-ext-icon {
      flex: 0 0 32px;
      padding: 0.3rem 0;
    }

    .hl-play-overlay, .hl-view-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.45rem;
      opacity: 0.85;
      transition: all var(--transition-fast);
      z-index: 2;
    }

    .hl-story-media-preview {
      cursor: pointer;
    }

    .hl-story-media-preview:hover .hl-play-overlay,
    .hl-story-media-preview:hover .hl-view-overlay {
      background: rgba(0, 0, 0, 0.2);
      opacity: 1;
    }

    .hl-play-btn-circle {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--ig-gradient-vibrant);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 14px rgba(225, 48, 108, 0.5);
      transform: scale(1);
      transition: transform 0.2s ease;
    }

    .hl-view-btn-circle {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: rgba(15, 23, 42, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(4px);
      transition: transform 0.2s ease;
    }

    .hl-story-media-preview:hover .hl-play-btn-circle,
    .hl-story-media-preview:hover .hl-view-btn-circle {
      transform: scale(1.12);
    }

    .hl-play-btn-text {
      font-size: 0.7rem;
      font-weight: 700;
      color: #ffffff;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
      letter-spacing: 0.02em;
    }

    .story-card-actions {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      margin-top: auto;
      padding-top: 0.4rem;
    }

    .story-view-btn {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.3rem;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.35rem 0.5rem;
    }

    .story-link-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.35rem;
      color: var(--text-muted);
      border-radius: var(--radius-xs);
      border: 1px solid var(--border-default);
      transition: all var(--transition-fast);
    }

    .story-link-icon:hover {
      color: var(--text-primary);
      border-color: var(--border-hover);
    }

    /* In-App Story Viewer / Video Player Lightbox */
    .story-viewer-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1100;
      background: rgba(0, 0, 0, 0.92);
      backdrop-filter: blur(14px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      animation: fadeInViewer 0.2s ease-out;
    }

    @keyframes fadeInViewer {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .story-viewer-modal {
      background: #0f172a;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: var(--radius-lg);
      width: 100%;
      max-width: 460px;
      max-height: 94vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.85);
      position: relative;
    }

    .story-progress-container {
      display: flex;
      gap: 4px;
      padding: 10px 14px 4px;
      background: #0f172a;
      width: 100%;
    }

    .story-progress-segment {
      flex: 1;
      height: 3px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 2px;
      cursor: pointer;
      overflow: hidden;
      transition: background 0.2s ease;
    }

    .story-progress-segment.completed {
      background: rgba(255, 255, 255, 0.85);
    }

    .story-progress-segment.active {
      background: var(--ig-pink);
      box-shadow: 0 0 8px rgba(225, 48, 108, 0.6);
    }

    .story-viewer-header {
      padding: 0.6rem 1rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      background: #0f172a;
    }

    .story-viewer-info {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      min-width: 0;
      flex: 1;
    }

    .story-viewer-badge {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fbbf24;
      flex-shrink: 0;
    }

    .story-viewer-badge.badge-video {
      background: rgba(225, 48, 108, 0.2);
      color: #f43f5e;
    }

    .story-viewer-titles {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .story-viewer-title {
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .story-viewer-meta {
      font-size: 0.7rem;
      color: var(--text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .story-viewer-header-actions {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      flex-shrink: 0;
    }

    .viewer-icon-btn {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: var(--text-secondary);
      cursor: pointer;
      padding: 0.35rem 0.5rem;
      border-radius: var(--radius-sm);
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.7rem;
      transition: all var(--transition-fast);
      text-decoration: none;
    }

    .viewer-icon-btn:hover {
      background: rgba(255, 255, 255, 0.15);
      color: var(--text-primary);
    }

    .viewer-icon-btn.btn-proxy-active {
      background: rgba(56, 189, 248, 0.2);
      color: #38bdf8;
      border-color: rgba(56, 189, 248, 0.4);
    }

    .proxy-tag {
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.02em;
    }

    .btn-close-viewer {
      padding: 0.35rem;
    }

    .btn-close-viewer:hover {
      background: rgba(244, 63, 94, 0.2);
      color: #f43f5e;
      border-color: rgba(244, 63, 94, 0.4);
    }

    .story-viewer-stage {
      position: relative;
      width: 100%;
      height: 520px;
      max-height: 64vh;
      background: #000000;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    .story-media-player-box {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }

    .story-video-element {
      width: 100%;
      height: 100%;
      max-height: 64vh;
      object-fit: contain;
      background: #000;
      outline: none;
    }

    .story-photo-element {
      width: 100%;
      height: 100%;
      max-height: 64vh;
      object-fit: contain;
      background: #000;
    }

    .video-proxy-notice {
      position: absolute;
      top: 10px;
      left: 10px;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(6px);
      border: 1px solid rgba(56, 189, 248, 0.3);
      padding: 0.2rem 0.5rem;
      border-radius: var(--radius-xs);
      font-size: 0.68rem;
      font-weight: 600;
      color: #38bdf8;
      display: flex;
      align-items: center;
      gap: 0.3rem;
      z-index: 5;
    }

    .story-nav-btn {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 10;
      backdrop-filter: blur(8px);
      transition: all 0.2s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    }

    .story-nav-btn.nav-prev {
      left: 12px;
    }

    .story-nav-btn.nav-next {
      right: 12px;
    }

    .story-nav-btn:hover {
      background: var(--ig-gradient-vibrant);
      border-color: transparent;
      transform: translateY(-50%) scale(1.1);
    }

    .story-viewer-footer {
      padding: 0.85rem 1rem;
      background: #0f172a;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .story-viewer-caption {
      font-size: 0.775rem;
      color: var(--text-secondary);
      line-height: 1.4;
      margin: 0;
      max-height: 4.5rem;
      overflow-y: auto;
    }

    .story-viewer-footer-links {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .story-sticker-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.725rem;
      font-weight: 600;
      color: var(--accent-cyan);
      background: rgba(56, 189, 248, 0.1);
      border: 1px solid rgba(56, 189, 248, 0.25);
      padding: 0.25rem 0.6rem;
      border-radius: var(--radius-sm);
      text-decoration: none;
      transition: all var(--transition-fast);
    }

    .story-sticker-btn:hover {
      background: rgba(56, 189, 248, 0.2);
      border-color: rgba(56, 189, 248, 0.4);
    }

    .audio-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.725rem;
      color: #38bdf8;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    :host ::ng-deep .icon-indigo { color: #818cf8; }
    :host ::ng-deep .icon-amber { color: #fbbf24; }
    :host ::ng-deep .icon-cyan { color: #38bdf8; }
    :host ::ng-deep .icon-rose { color: #f43f5e; }
    :host ::ng-deep .icon-yellow { color: #facc15; }
  `]
})
export class TabContentComponent implements AfterViewInit, OnDestroy, OnChanges {
  @Input() charts?: AnalysisCharts;
  @Input() posts: PostItem[] = [];
  @Input() extra?: ExtraData;
  @Input() username: string = 'perfil';

  selectedHighlight: HighlightItem | null = null;

  activeStoryItem: HighlightMediaItem | null = null;
  activeStoryIndex: number = 0;
  activeStoryList: HighlightMediaItem[] = [];
  activeStoryContextTitle: string = '';
  forcedProxyMap: { [key: string]: boolean } = {};

  private readonly api = inject(ApiService);

  private pieCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('pieCanvas') set pieCanvasRef(ref: ElementRef<HTMLCanvasElement> | undefined) {
    this.pieCanvas = ref;
    if (ref) setTimeout(() => this.renderPieChart(), 0);
  }

  private formatBarCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('formatBarCanvas') set formatBarCanvasRef(ref: ElementRef<HTMLCanvasElement> | undefined) {
    this.formatBarCanvas = ref;
    if (ref) setTimeout(() => this.renderFormatBarChart(), 0);
  }

  private captionScatterCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('captionScatterCanvas') set captionScatterCanvasRef(ref: ElementRef<HTMLCanvasElement> | undefined) {
    this.captionScatterCanvas = ref;
    if (ref) setTimeout(() => this.renderCaptionScatterChart(), 0);
  }

  private pieChartInstance: Chart | null = null;
  private formatBarChartInstance: Chart | null = null;
  private scatterChartInstance: Chart | null = null;

  ngAfterViewInit(): void {
    this.renderCharts();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['charts'] && !changes['charts'].firstChange) {
      this.renderCharts();
    }
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  private destroyCharts(): void {
    if (this.pieChartInstance) {
      this.pieChartInstance.destroy();
      this.pieChartInstance = null;
    }
    if (this.formatBarChartInstance) {
      this.formatBarChartInstance.destroy();
      this.formatBarChartInstance = null;
    }
    if (this.scatterChartInstance) {
      this.scatterChartInstance.destroy();
      this.scatterChartInstance = null;
    }
  }

  private renderCharts(): void {
    if (!this.charts) return;
    this.destroyCharts();
    this.renderPieChart();
    this.renderFormatBarChart();
    this.renderCaptionScatterChart();
  }

  private renderPieChart(): void {
    if (!this.pieCanvas || !this.charts?.by_type || this.charts.by_type.length === 0) return;
    const ctx = this.pieCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const labels = this.charts.by_type.map(t => this.formatTypeName(t.tipo));
    const data = this.charts.by_type.map(t => t.posts);
    const colors = ['#6366f1', '#e1306c', '#10b981', '#f59e0b', '#06b6d4'];

    this.pieChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.slice(0, data.length),
          borderColor: '#0e1424',
          borderWidth: 3,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#94a3b8',
              font: { family: 'Plus Jakarta Sans', size: 12, weight: 600 },
              usePointStyle: true,
              boxWidth: 8
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleColor: '#ffffff',
            bodyColor: '#cbd5e1',
            borderColor: 'rgba(255, 255, 255, 0.12)',
            borderWidth: 1,
            cornerRadius: 8,
          }
        },
        cutout: '65%'
      }
    });
  }

  private renderFormatBarChart(): void {
    if (!this.formatBarCanvas || !this.charts?.by_type || this.charts.by_type.length === 0) return;
    const ctx = this.formatBarCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const labels = this.charts.by_type.map(t => this.formatTypeName(t.tipo));
    const likes = this.charts.by_type.map(t => t.curtidas);
    const comments = this.charts.by_type.map(t => t.comentarios);

    this.formatBarChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Média de Curtidas',
            data: likes,
            backgroundColor: 'rgba(99, 102, 241, 0.75)',
            borderColor: '#6366f1',
            borderWidth: 1,
            borderRadius: 6
          },
          {
            label: 'Média de Comentários',
            data: comments,
            backgroundColor: 'rgba(225, 48, 108, 0.75)',
            borderColor: '#e1306c',
            borderWidth: 1,
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: '#94a3b8',
              font: { family: 'Plus Jakarta Sans', size: 11, weight: 600 },
              usePointStyle: true
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleColor: '#ffffff',
            bodyColor: '#cbd5e1',
            borderColor: 'rgba(255, 255, 255, 0.12)',
            borderWidth: 1,
            cornerRadius: 8,
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#64748b', font: { family: 'Plus Jakarta Sans', size: 11 } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#64748b', font: { family: 'Plus Jakarta Sans', size: 11 } }
          }
        }
      }
    });
  }

  private renderCaptionScatterChart(): void {
    if (!this.captionScatterCanvas || !this.charts?.caption || this.charts.caption.length === 0) return;
    const ctx = this.captionScatterCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const points = this.charts.caption;

    this.scatterChartInstance = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Interações vs Caracteres',
          data: points.map(p => ({ x: p.x ?? (p as any).len ?? 0, y: p.y ?? (p as any).inter ?? 0 })),
          backgroundColor: 'rgba(56, 189, 248, 0.65)',
          borderColor: '#38bdf8',
          borderWidth: 1,
          pointRadius: 4,
          pointHoverRadius: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleColor: '#ffffff',
            bodyColor: '#cbd5e1',
            borderColor: 'rgba(255, 255, 255, 0.12)',
            borderWidth: 1,
            cornerRadius: 8,
            callbacks: {
              label: (item: any) => `${item.raw.x} caracteres: ${item.raw.y} interações`
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Comprimento da Legenda (Caracteres)',
              color: '#94a3b8',
              font: { family: 'Plus Jakarta Sans', size: 11 }
            },
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: { color: '#64748b', font: { family: 'Plus Jakarta Sans', size: 11 } }
          },
          y: {
            title: {
              display: true,
              text: 'Volume de Interações',
              color: '#94a3b8',
              font: { family: 'Plus Jakarta Sans', size: 11 }
            },
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#64748b', font: { family: 'Plus Jakarta Sans', size: 11 } }
          }
        }
      }
    });
  }

  formatTypeName(tipo: string): string {
    if (!tipo) return 'Outro';
    if (tipo.includes('Image')) return 'Foto Estática';
    if (tipo.includes('Video')) return 'Vídeo / Reel';
    if (tipo.includes('Sidecar')) return 'Carrossel';
    return tipo;
  }

  getPercentage(postsCount: number): number {
    if (!this.charts?.by_type || this.charts.by_type.length === 0) return 0;
    const total = this.charts.by_type.reduce((sum, item) => sum + item.posts, 0);
    return total > 0 ? (postsCount / total) * 100 : 0;
  }

  openHighlightModal(h: HighlightItem): void {
    this.selectedHighlight = h;
  }

  closeHighlightModal(): void {
    this.selectedHighlight = null;
  }

  // --- Visualizador Integrado de Mídia / Player de Vídeo (In-App) ---

  openStoryViewer(
    item: HighlightMediaItem,
    index: number,
    list?: HighlightMediaItem[],
    contextTitle?: string
  ): void {
    this.activeStoryList = list && list.length ? list : [item];
    this.activeStoryIndex = index >= 0 && index < this.activeStoryList.length ? index : 0;
    this.activeStoryItem = this.activeStoryList[this.activeStoryIndex] || item;
    this.activeStoryContextTitle = contextTitle || 'Destaque';
  }

  openActiveStoryViewer(story: any, index: number): void {
    const list: HighlightMediaItem[] = (this.extra?.stories || []).map((s: any, idx: number) => ({
      id: s.id || `active_story_${idx}`,
      type: s.is_video || s.tipo === 'Vídeo' ? 'video' : 'photo',
      tipo: s.tipo || (s.is_video ? 'Vídeo' : 'Foto'),
      is_video: !!s.is_video,
      media_url: s.url || '',
      video_url: s.is_video ? s.url : undefined,
      thumbnail_url: s.thumbnail || s.url || '',
      data: s.data ? new Date(s.data).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      timestamp: s.data,
      visualizacoes: s.visualizacoes,
      caption: s.visualizacoes ? `${s.visualizacoes} visualizações registradas` : '',
    }));
    const current = list[index] || {
      id: story.id || `active_story_${index}`,
      type: story.is_video ? 'video' : 'photo',
      is_video: !!story.is_video,
      media_url: story.url || '',
      video_url: story.is_video ? story.url : undefined,
      thumbnail_url: story.url || '',
    };
    this.openStoryViewer(current, index, list, 'Stories Recentes (24h)');
  }

  closeStoryViewer(): void {
    this.activeStoryItem = null;
    this.activeStoryIndex = 0;
    this.activeStoryList = [];
    this.activeStoryContextTitle = '';
  }

  nextStory(): void {
    if (this.activeStoryIndex < this.activeStoryList.length - 1) {
      this.activeStoryIndex++;
      this.activeStoryItem = this.activeStoryList[this.activeStoryIndex];
    }
  }

  prevStory(): void {
    if (this.activeStoryIndex > 0) {
      this.activeStoryIndex--;
      this.activeStoryItem = this.activeStoryList[this.activeStoryIndex];
    }
  }

  goToStory(index: number): void {
    if (index >= 0 && index < this.activeStoryList.length) {
      this.activeStoryIndex = index;
      this.activeStoryItem = this.activeStoryList[this.activeStoryIndex];
    }
  }

  isProxyForced(item?: HighlightMediaItem | null): boolean {
    if (!item) return false;
    const key = item.id || item.media_url || item.url || '';
    return !!this.forcedProxyMap[key];
  }

  toggleProxyForce(item: HighlightMediaItem): void {
    const key = item.id || item.media_url || item.url || '';
    this.forcedProxyMap[key] = !this.forcedProxyMap[key];
  }

  getMediaPlaybackUrl(item?: HighlightMediaItem | null): string {
    if (!item) return '';
    const rawUrl = item.video_url || item.media_url || item.url || '';
    if (!rawUrl) return '';
    const key = item.id || item.media_url || item.url || '';
    if (this.forcedProxyMap[key]) {
      return (item.is_video || item.type === 'video')
        ? this.api.getVideoProxyUrl(rawUrl)
        : this.api.getImageProxyUrl(rawUrl);
    }
    return rawUrl;
  }

  onVideoError(item: HighlightMediaItem): void {
    const key = item.id || item.media_url || item.url || '';
    if (!this.forcedProxyMap[key]) {
      // Auto-fallback para streaming seguro via proxy do backend
      this.forcedProxyMap[key] = true;
    }
  }

  onImageError(item: HighlightMediaItem): void {
    const key = item.id || item.media_url || item.url || '';
    if (!this.forcedProxyMap[key]) {
      this.forcedProxyMap[key] = true;
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    if (!this.activeStoryItem) return;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.nextStory();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.prevStory();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.closeStoryViewer();
    }
  }

  exportHighlightsCsv(): void {
    if (!this.extra?.highlights?.length) return;
    const user = this.username || 'perfil';
    const rows = this.extra.highlights.map((h, idx) => ({
      ordem: idx + 1,
      id: h.id || '',
      titulo: h.title || 'Sem título',
      qtd_midias: (h.items?.length || h.mediaCount || h.media_count || 0),
      url_instagram: h.url || (h.id ? `https://www.instagram.com/stories/highlights/${h.id}/` : ''),
      url_capa: h.coverImageUrl || h.cover || ''
    }));
    this.api.exportToCsv(rows, `destaques_${user}_${this.getDateStamp()}`);
  }

  exportHighlightMediaCsv(): void {
    if (!this.extra?.highlights?.length) return;
    const user = this.username || 'perfil';
    const rows: any[] = [];
    let mediaIndex = 1;

    for (const h of this.extra.highlights) {
      const hTitle = h.title || 'Sem título';
      const hId = h.id || '';
      const hUrl = h.url || (hId ? `https://www.instagram.com/stories/highlights/${hId}/` : '');
      const items = h.items || [];

      if (items.length > 0) {
        items.forEach((item, itemIdx) => {
          rows.push({
            ordem_geral: mediaIndex++,
            destaque_titulo: hTitle,
            destaque_id: hId,
            ordem_no_destaque: itemIdx + 1,
            tipo_midia: item.type === 'video' || item.is_video ? 'Vídeo' : 'Foto',
            url_midia: item.media_url || item.video_url || '',
            url_miniatura: item.thumbnail_url || item.coverUrl || '',
            data_publicacao: item.timestamp || item.data || '',
            link_sticker_externo: item.link_sticker || '',
            legenda: item.caption || item.legenda || '',
            url_destaque_instagram: hUrl,
          });
        });
      } else {
        rows.push({
          ordem_geral: mediaIndex++,
          destaque_titulo: hTitle,
          destaque_id: hId,
          ordem_no_destaque: 1,
          tipo_midia: 'Capa/Resumo',
          url_midia: h.coverImageUrl || h.cover || '',
          url_miniatura: h.coverImageUrl || h.cover || '',
          data_publicacao: '',
          link_sticker_externo: '',
          legenda: '',
          url_destaque_instagram: hUrl,
        });
      }
    }

    this.api.exportToCsv(rows, `conteudos_destaques_${user}_${this.getDateStamp()}`);
  }

  exportHighlightsJson(): void {
    if (!this.extra?.highlights?.length) return;
    const user = this.username || 'perfil';
    const data = this.extra.highlights.map(h => ({
      id: h.id || '',
      title: h.title || 'Sem título',
      media_count: (h.items?.length || h.mediaCount || h.media_count || 0),
      url: h.url || (h.id ? `https://www.instagram.com/stories/highlights/${h.id}/` : ''),
      cover_image_url: h.coverImageUrl || h.cover || '',
      items: h.items || []
    }));
    this.api.exportToJson(data, `destaques_${user}_${this.getDateStamp()}`);
  }

  private getDateStamp(): string {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  }
}
