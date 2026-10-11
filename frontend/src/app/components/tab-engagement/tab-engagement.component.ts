import { Component, Input, AfterViewInit, OnDestroy, OnChanges, SimpleChanges, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import Chart from 'chart.js/auto';
import { AnalysisCharts, PostItem } from '../../models/instagram.model';
import { IconComponent } from '../ui/icon/icon.component';

@Component({
  selector: 'app-tab-engagement',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="tab-content-wrapper">
      <!-- Timeline Chart Card -->
      <div class="card mb-4">
        <div class="card-title">
          <div class="title-left">
            <app-icon name="trend-up" [size]="18" customClass="icon-rose"></app-icon>
            <span>Evolução Cronológica de Engajamento</span>
          </div>
          <span class="badge badge-primary">{{ charts?.timeline?.length || 0 }} publicações mapeadas</span>
        </div>
        <p class="card-subtitle">
          Acompanhamento de interações totais, curtidas e comentários ao longo do histórico de postagens analisadas.
        </p>

        <div class="chart-container" *ngIf="charts?.timeline?.length">
          <canvas #timelineCanvas></canvas>
        </div>
        <div *ngIf="!charts?.timeline?.length" class="empty-state">
          <div class="empty-state-icon">
            <app-icon name="trend-up" [size]="24"></app-icon>
          </div>
          <div class="empty-state-title">Sem histórico cronológico</div>
          <p class="empty-state-desc">Nenhuma publicação cronológica disponível para gerar a curva temporal.</p>
        </div>
      </div>

      <!-- Top Posts Grid / Table -->
      <div class="card">
        <div class="card-title">
          <div class="title-left">
            <app-icon name="award" [size]="18" customClass="icon-amber"></app-icon>
            <span>Top Posts com Maior Engajamento</span>
          </div>
          <span class="badge badge-ig">Top 10 Melhores</span>
        </div>
        <p class="card-subtitle">
          Publicações que obtiveram o maior volume combinado de curtidas e comentários.
        </p>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 60px;">Posição</th>
                <th>Data</th>
                <th>Formato</th>
                <th>Curtidas</th>
                <th>Comentários</th>
                <th>Total Interações</th>
                <th>Legenda</th>
                <th style="text-align: right;">Ação</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let post of topPosts; let idx = index">
                <td>
                  <div class="rank-wrap">
                    <span class="rank-badge" [class.rank-top3]="idx < 3">#{{ idx + 1 }}</span>
                    <span *ngIf="post.fixado" title="Post Fixado no Perfil" class="pinned-tag">
                      <app-icon name="pin" [size]="11"></app-icon>
                    </span>
                  </div>
                </td>
                <td class="text-nowrap text-date">{{ formatDate(post.data) }}</td>
                <td>
                  <div class="format-cell">
                    <span class="badge" [ngClass]="getTypeBadgeClass(post.tipo)">
                      {{ formatType(post.tipo) }}
                    </span>
                    <span *ngIf="post.plays_video" class="plays-tag">
                      <app-icon name="play" [size]="9"></app-icon>
                      {{ post.plays_video | number }} plays
                    </span>
                    <span *ngIf="post.colabs?.length" class="colab-tag" title="Colaboração">
                      <app-icon name="share-2" [size]="10"></app-icon> Colab
                    </span>
                  </div>
                </td>
                <td>
                  <strong class="number-font">{{ post.curtidas >= 0 ? (post.curtidas | number) : 'Ocultas' }}</strong>
                </td>
                <td class="number-font">{{ post.comentarios | number }}</td>
                <td>
                  <span class="highlight-inter number-font">{{ post.interacoes | number }}</span>
                </td>
                <td class="caption-col" [title]="post.legenda || ''">
                  <div class="caption-text">{{ truncateCaption(post.legenda) }}</div>
                  <div *ngIf="post.musica" class="post-audio-info" [title]="(post.artista ? post.artista + ' - ' : '') + post.musica">
                    <app-icon name="music" [size]="11"></app-icon>
                    <span>{{ post.musica }}</span>
                  </div>
                </td>
                <td style="text-align: right;">
                  <a [href]="getPostUrl(post)" 
                     target="_blank" 
                     rel="noopener noreferrer" 
                     class="btn btn-outline btn-sm action-link-btn">
                    <span>Instagram</span>
                    <app-icon name="external-link" [size]="12"></app-icon>
                  </a>
                </td>
              </tr>
              <tr *ngIf="!topPosts || topPosts.length === 0">
                <td colspan="8" class="text-center text-muted py-4">Nenhum post registrado.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .mb-4 {
      margin-bottom: 1.5rem;
    }

    .chart-container {
      position: relative;
      height: 350px;
      width: 100%;
    }

    .rank-wrap {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .rank-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: var(--radius-xs);
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border-default);
      color: var(--text-secondary);
      font-size: 0.72rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }

    .rank-top3 {
      background: var(--ig-gradient);
      color: #ffffff;
      border-color: transparent;
      box-shadow: 0 2px 8px rgba(225, 48, 108, 0.4);
    }

    .pinned-tag {
      color: var(--accent-amber);
      display: inline-flex;
    }

    .text-date {
      color: var(--text-muted);
      font-size: 0.8rem;
    }

    .format-cell {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .highlight-inter {
      color: var(--accent-cyan);
      font-weight: 700;
    }

    .number-font {
      font-variant-numeric: tabular-nums;
    }

    .caption-col {
      max-width: 280px;
      color: var(--text-secondary);
      font-size: 0.825rem;
    }

    .caption-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .action-link-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.75rem;
    }

    .text-nowrap {
      white-space: nowrap;
    }

    .text-center {
      text-align: center;
    }

    .py-4 {
      padding-top: 2rem;
      padding-bottom: 2rem;
    }

    .plays-tag {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 0.675rem;
      color: var(--accent-cyan);
      font-weight: 600;
      white-space: nowrap;
    }

    .colab-tag {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 0.65rem;
      color: #a78bfa;
      background: rgba(167, 139, 250, 0.12);
      border: 1px solid rgba(167, 139, 250, 0.25);
      border-radius: 3px;
      padding: 1px 5px;
      width: fit-content;
    }

    .post-audio-info {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.725rem;
      color: #38bdf8;
      margin-top: 3px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 260px;
    }

    :host ::ng-deep .icon-rose { color: #f43f5e; }
    :host ::ng-deep .icon-amber { color: #fbbf24; }
  `]
})
export class TabEngagementComponent implements AfterViewInit, OnDestroy, OnChanges {
  @Input() charts?: AnalysisCharts;
  @Input() topPosts: PostItem[] = [];

  private timelineCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('timelineCanvas') set timelineCanvasRef(ref: ElementRef<HTMLCanvasElement> | undefined) {
    this.timelineCanvas = ref;
    if (ref) {
      setTimeout(() => this.renderChart(), 0);
    }
  }

  private chartInstance: Chart | null = null;

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['charts'] && !changes['charts'].firstChange) {
      this.renderChart();
    }
  }

  ngOnDestroy(): void {
    this.destroyChart();
  }

  private destroyChart(): void {
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
  }

  private renderChart(): void {
    if (!this.timelineCanvas || !this.charts?.timeline || this.charts.timeline.length === 0) {
      return;
    }

    this.destroyChart();

    const ctx = this.timelineCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    // Gradient fill under interactions curve
    const gradient = ctx.createLinearGradient(0, 0, 0, 320);
    gradient.addColorStop(0, 'rgba(225, 48, 108, 0.28)');
    gradient.addColorStop(1, 'rgba(225, 48, 108, 0.00)');

    const labels = this.charts.timeline.map(p => this.formatDate(p.d));
    const interactionsData = this.charts.timeline.map(p => p.interacoes);
    const likesData = this.charts.timeline.map(p => Math.max(p.curtidas, 0));
    const commentsData = this.charts.timeline.map(p => p.comentarios);

    this.chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Total Interações',
            data: interactionsData,
            borderColor: '#e1306c',
            backgroundColor: gradient,
            fill: true,
            tension: 0.35,
            borderWidth: 2.5,
            pointRadius: 3,
            pointHoverRadius: 6,
            pointBackgroundColor: '#e1306c',
          },
          {
            label: 'Curtidas',
            data: likesData,
            borderColor: '#6366f1',
            backgroundColor: 'transparent',
            tension: 0.35,
            borderWidth: 1.8,
            pointRadius: 2,
            borderDash: [4, 4],
          },
          {
            label: 'Comentários',
            data: commentsData,
            borderColor: '#38bdf8',
            backgroundColor: 'transparent',
            tension: 0.35,
            borderWidth: 1.8,
            pointRadius: 2,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: '#94a3b8',
              font: { family: 'Plus Jakarta Sans', size: 12, weight: 600 },
              usePointStyle: true,
              boxWidth: 8,
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleColor: '#ffffff',
            bodyColor: '#cbd5e1',
            borderColor: 'rgba(255, 255, 255, 0.12)',
            borderWidth: 1,
            padding: 12,
            boxPadding: 6,
            usePointStyle: true,
            titleFont: { family: 'Plus Jakarta Sans', weight: 'bold' },
            bodyFont: { family: 'Plus Jakarta Sans' },
            cornerRadius: 8,
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: {
              color: '#64748b',
              maxTicksLimit: 12,
              font: { family: 'Plus Jakarta Sans', size: 11 }
            }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: '#64748b',
              font: { family: 'Plus Jakarta Sans', size: 11 }
            }
          }
        }
      }
    });
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  formatType(type: string | null | undefined): string {
    if (!type) return 'Foto';
    if (type.includes('Image')) return 'Foto';
    if (type.includes('Video')) return 'Vídeo / Reel';
    if (type.includes('Sidecar')) return 'Carrossel';
    return type;
  }

  getTypeBadgeClass(type: string | null | undefined): string {
    if (!type) return 'badge-neutral';
    if (type.includes('Image')) return 'badge-primary';
    if (type.includes('Video')) return 'badge-ig';
    if (type.includes('Sidecar')) return 'badge-success';
    return 'badge-neutral';
  }

  truncateCaption(caption: string | null | undefined): string {
    if (!caption) return '—';
    return caption.length > 80 ? caption.slice(0, 80) + '...' : caption;
  }

  getPostUrl(post: PostItem): string {
    if (post.url) return post.url;
    if (post.shortcode) return `https://www.instagram.com/p/${post.shortcode}/`;
    return '#';
  }
}
