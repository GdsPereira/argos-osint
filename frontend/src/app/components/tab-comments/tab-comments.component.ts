import { Component, Input, AfterViewInit, OnDestroy, OnChanges, SimpleChanges, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import Chart from 'chart.js/auto';
import { CommentsData, CommentItem } from '../../models/instagram.model';
import { IconComponent } from '../ui/icon/icon.component';

@Component({
  selector: 'app-tab-comments',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="tab-content-wrapper">
      <!-- Empty state when no comments collected -->
      <div class="card empty-state" *ngIf="!comments || comments.total === 0">
        <div class="empty-state-icon">
          <app-icon name="message-square" [size]="28"></app-icon>
        </div>
        <h3 class="empty-state-title">Nenhum comentário coletado nesta análise</h3>
        <p class="empty-state-desc">
          Para extrair o sentimento léxico, nuvem de palavras, frequência de emojis e autores mais ativos,
          ative a opção <strong>"Coletar Comentários"</strong> nas configurações da barra lateral.
        </p>
      </div>

      <ng-container *ngIf="comments && comments.total > 0">
        <!-- Sentiment & Stats Overview -->
        <div class="grid-2">
          <!-- Sentiment Doughnut -->
          <div class="card">
            <div class="card-title">
              <div class="title-left">
                <app-icon name="sparkles" [size]="18" customClass="icon-rose"></app-icon>
                <span>Análise de Sentimento Léxico</span>
              </div>
              <span class="badge badge-primary">{{ comments.total }} analisados</span>
            </div>
            <p class="card-subtitle">
              Classificação semântica heurística baseada em termos e reações positivas vs. negativas.
            </p>

            <div class="chart-container-sm">
              <canvas #sentimentCanvas></canvas>
            </div>

            <div class="sentiment-legend">
              <div class="legend-badge legend-pos">
                <span class="dot"></span>
                <span>Positivos: {{ comments.sentiment.positivo }} ({{ getSentPct('positivo') | number:'1.1-1' }}%)</span>
              </div>
              <div class="legend-badge legend-neu">
                <span class="dot"></span>
                <span>Neutros: {{ comments.sentiment.neutro }} ({{ getSentPct('neutro') | number:'1.1-1' }}%)</span>
              </div>
              <div class="legend-badge legend-neg">
                <span class="dot"></span>
                <span>Negativos: {{ comments.sentiment.negativo }} ({{ getSentPct('negativo') | number:'1.1-1' }}%)</span>
              </div>
            </div>
          </div>

          <!-- Top Commenters Leaderboard -->
          <div class="card">
            <div class="card-title">
              <div class="title-left">
                <app-icon name="award" [size]="18" customClass="icon-amber"></app-icon>
                <span>Autores Mais Engajados</span>
              </div>
              <span class="badge badge-ig">Top Comentaristas</span>
            </div>
            <p class="card-subtitle">
              Perfis de seguidores mais ativos participando nas publicações analisadas.
            </p>

            <div class="authors-list">
              <div class="author-row" *ngFor="let a of comments.top_authors; let idx = index">
                <div class="author-left">
                  <span class="author-rank" [class.rank-top3]="idx < 3">#{{ idx + 1 }}</span>
                  <a [href]="'https://www.instagram.com/' + a.item" target="_blank" class="author-name">
                    &#64;{{ a.item }}
                  </a>
                </div>
                <span class="author-count badge badge-neutral number-font">{{ a.usos }} comentários</span>
              </div>
              <div *ngIf="!comments.top_authors || comments.top_authors.length === 0" class="text-muted text-center py-3">
                Nenhum autor identificado.
              </div>
            </div>
          </div>
        </div>

        <!-- Words and Emojis Grid -->
        <div class="grid-2 mt-4">
          <!-- Top Words (Tag Cloud) -->
          <div class="card">
            <div class="card-title">
              <div class="title-left">
                <app-icon name="file-text" [size]="18" customClass="icon-cyan"></app-icon>
                <span>Palavras Mais Frequentes</span>
              </div>
              <span class="badge badge-primary">Filtro de Stopwords</span>
            </div>
            <p class="card-subtitle">
              Termos de maior recorrência encontrados no corpo dos comentários.
            </p>

            <div class="word-cloud" *ngIf="comments.words && comments.words.length > 0">
              <span *ngFor="let w of comments.words" 
                    class="word-tag" 
                    [style.font-size.rem]="getWordSize(w.usos)">
                {{ w.item }}
                <span class="word-count number-font">{{ w.usos }}</span>
              </span>
            </div>
            <div *ngIf="!comments.words || comments.words.length === 0" class="text-muted text-center py-3">
              Nenhuma palavra de destaque encontrada nos comentários.
            </div>
          </div>

          <!-- Top Emojis -->
          <div class="card">
            <div class="card-title">
              <div class="title-left">
                <app-icon name="message-square" [size]="18" customClass="icon-yellow"></app-icon>
                <span>Emojis Mais Utilizados</span>
              </div>
            </div>
            <p class="card-subtitle">
              Símbolos e reações visuais mais populares entre os seguidores.
            </p>

            <div class="emojis-grid" *ngIf="comments.emojis && comments.emojis.length > 0">
              <div class="emoji-card" *ngFor="let em of comments.emojis">
                <span class="emoji-icon">{{ em.item }}</span>
                <span class="emoji-count number-font">{{ em.usos }}x</span>
              </div>
            </div>
            <div *ngIf="!comments.emojis || comments.emojis.length === 0" class="text-muted text-center py-3">
              Nenhum emoji identificado nos comentários.
            </div>
          </div>
        </div>

        <!-- Recent Comments Feed -->
        <div class="card mt-4">
          <div class="card-title">
            <div class="title-left">
              <app-icon name="message-square" [size]="18" customClass="icon-rose"></app-icon>
              <span>Amostra de Comentários Recentes</span>
            </div>
            <span class="badge badge-neutral">Feed Interativo</span>
          </div>

          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width: 200px;">Autor</th>
                  <th style="width: 140px;">Sentimento</th>
                  <th>Texto do Comentário</th>
                  <th style="width: 130px; text-align: right;">Data</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let c of recentComments">
                  <td>
                    <strong class="author-name-tag">&#64;{{ c.autor || 'anônimo' }}</strong>
                  </td>
                  <td>
                    <span class="badge" [ngClass]="getSentimentBadgeClass(c.sentimento)">
                      {{ c.sentimento | titlecase }}
                    </span>
                  </td>
                  <td class="comment-text-col">{{ c.texto }}</td>
                  <td class="text-nowrap number-font" style="text-align: right; color: var(--text-muted); font-size: 0.8rem;">
                    {{ formatDate(c.data) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .mt-4 {
      margin-top: 1.5rem;
    }

    .number-font {
      font-variant-numeric: tabular-nums;
    }

    .chart-container-sm {
      position: relative;
      height: 240px;
      width: 100%;
    }

    .sentiment-legend {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 1.25rem;
      margin-top: 1.25rem;
    }

    .legend-badge {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      font-size: 0.8rem;
      font-weight: 600;
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .legend-pos .dot { background: #10b981; }
    .legend-pos { color: #6ee7b7; }

    .legend-neu .dot { background: #94a3b8; }
    .legend-neu { color: #cbd5e1; }

    .legend-neg .dot { background: #f43f5e; }
    .legend-neg { color: #fda4af; }

    .authors-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-height: 310px;
      overflow-y: auto;
    }

    .author-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.55rem 0.85rem;
      background: var(--bg-surface-elevated);
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-subtle);
      transition: border-color var(--transition-fast);
    }
    .author-row:hover {
      border-color: var(--border-hover);
    }

    .author-left {
      display: flex;
      align-items: center;
      gap: 0.65rem;
    }

    .author-rank {
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--text-muted);
      width: 24px;
      height: 24px;
      border-radius: var(--radius-xs);
      background: rgba(255, 255, 255, 0.05);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .author-rank.rank-top3 {
      background: var(--ig-gradient);
      color: #ffffff;
    }

    .author-name {
      color: var(--text-primary);
      font-weight: 600;
      font-size: 0.85rem;
      text-decoration: none;
    }
    .author-name:hover {
      color: var(--accent-cyan);
    }

    .author-name-tag {
      color: var(--text-primary);
      font-size: 0.85rem;
    }

    .word-cloud {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: center;
      padding: 0.5rem 0;
    }

    .word-tag {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-sm);
      padding: 0.3rem 0.6rem;
      color: var(--text-primary);
      font-weight: 600;
      transition: all var(--transition-fast);
    }
    .word-tag:hover {
      border-color: var(--border-hover);
      background: var(--bg-card-hover);
    }

    .word-count {
      font-size: 0.7rem;
      color: var(--text-muted);
    }

    .emojis-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
      gap: 0.65rem;
    }

    .emoji-card {
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      padding: 0.65rem 0.4rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.2rem;
      transition: all var(--transition-fast);
    }
    .emoji-card:hover {
      border-color: var(--border-hover);
      transform: translateY(-2px);
    }

    .emoji-icon {
      font-size: 1.5rem;
      line-height: 1;
    }

    .emoji-count {
      font-size: 0.7rem;
      font-weight: 700;
      color: var(--text-muted);
    }

    .comment-text-col {
      color: var(--text-secondary);
      font-size: 0.85rem;
      line-height: 1.45;
    }

    .text-nowrap {
      white-space: nowrap;
    }

    .text-center {
      text-align: center;
    }

    .py-3 {
      padding-top: 1rem;
      padding-bottom: 1rem;
    }

    :host ::ng-deep .icon-rose { color: #f43f5e; }
    :host ::ng-deep .icon-amber { color: #fbbf24; }
    :host ::ng-deep .icon-cyan { color: #38bdf8; }
    :host ::ng-deep .icon-yellow { color: #facc15; }
  `]
})
export class TabCommentsComponent implements AfterViewInit, OnDestroy, OnChanges {
  @Input() comments?: CommentsData;

  private sentimentCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('sentimentCanvas') set sentimentCanvasRef(ref: ElementRef<HTMLCanvasElement> | undefined) {
    this.sentimentCanvas = ref;
    if (ref) setTimeout(() => this.renderSentimentChart(), 0);
  }

  private chartInstance: Chart | null = null;

  get recentComments(): CommentItem[] {
    return this.comments?.items?.slice(0, 15) || [];
  }

  ngAfterViewInit(): void {
    this.renderSentimentChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['comments'] && !changes['comments'].firstChange) {
      this.renderSentimentChart();
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

  private renderSentimentChart(): void {
    if (!this.sentimentCanvas || !this.comments || this.comments.total === 0) return;
    const ctx = this.sentimentCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    this.destroyChart();

    const { positivo, neutro, negativo } = this.comments.sentiment;

    this.chartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Positivo', 'Neutro', 'Negativo'],
        datasets: [{
          data: [positivo, neutro, negativo],
          backgroundColor: ['#10b981', '#64748b', '#f43f5e'],
          borderColor: '#0e1424',
          borderWidth: 3,
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
          }
        },
        cutout: '68%'
      }
    });
  }

  getSentPct(type: 'positivo' | 'neutro' | 'negativo'): number {
    if (!this.comments || this.comments.total === 0) return 0;
    return (this.comments.sentiment[type] / this.comments.total) * 100;
  }

  getWordSize(usos: number): number {
    const max = this.comments?.words?.[0]?.usos || 1;
    const factor = usos / max;
    return 0.8 + factor * 0.8;
  }

  getSentimentBadgeClass(sent: string): string {
    switch (sent) {
      case 'positivo': return 'badge-success';
      case 'negativo': return 'badge-danger';
      default: return 'badge-neutral';
    }
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
}
