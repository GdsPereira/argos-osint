import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnalysisSummary } from '../../models/instagram.model';
import { IconComponent } from '../ui/icon/icon.component';

@Component({
  selector: 'app-kpi-summary',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="kpi-grid" *ngIf="summary">
      <!-- Engajamento Rate -->
      <div class="kpi-card highlight-card">
        <div class="kpi-label">
          <div class="label-with-icon">
            <app-icon name="trend-up" [size]="14"></app-icon>
            <span>Taxa de Engajamento</span>
          </div>
          <span class="badge" [ngClass]="getEngagementBadgeClass(summary.taxa_engajamento)">
            {{ getEngagementLabel(summary.taxa_engajamento) }}
          </span>
        </div>
        <div class="kpi-value text-gradient">
          {{ summary.taxa_engajamento !== null ? (summary.taxa_engajamento | number:'1.2-2') + '%' : '—' }}
        </div>
        <div class="kpi-subtext">
          Interações médias relativas à base de seguidores
        </div>
      </div>

      <!-- Média de Curtidas -->
      <div class="kpi-card">
        <div class="kpi-label">
          <div class="label-with-icon">
            <app-icon name="heart" [size]="14" [strokeWidth]="2" customClass="icon-rose"></app-icon>
            <span>Média de Curtidas</span>
          </div>
        </div>
        <div class="kpi-value">
          {{ summary.media_curtidas !== null ? (summary.media_curtidas | number:'1.0-0') : '—' }}
        </div>
        <div class="kpi-subtext">
          Mediana: {{ summary.mediana_curtidas !== null ? (summary.mediana_curtidas | number:'1.0-0') : '—' }}
          <span *ngIf="summary.curtidas_ocultas > 0" class="text-dim">
            ({{ summary.curtidas_ocultas }} ocultas)
          </span>
        </div>
      </div>

      <!-- Média de Comentários -->
      <div class="kpi-card">
        <div class="kpi-label">
          <div class="label-with-icon">
            <app-icon name="message-square" [size]="14" customClass="icon-cyan"></app-icon>
            <span>Média Comentários</span>
          </div>
        </div>
        <div class="kpi-value">
          {{ summary.media_comentarios !== null ? (summary.media_comentarios | number:'1.1-1') : '—' }}
        </div>
        <div class="kpi-subtext">
          Total acumulado: {{ summary.total_comentarios | number }}
        </div>
      </div>

      <!-- Total Interações -->
      <div class="kpi-card">
        <div class="kpi-label">
          <div class="label-with-icon">
            <app-icon name="flame" [size]="14" customClass="icon-amber"></app-icon>
            <span>Total Interações</span>
          </div>
        </div>
        <div class="kpi-value text-cyan">
          {{ summary.total_interacoes | number }}
        </div>
        <div class="kpi-subtext">
          Em {{ summary.posts_analisados }} posts catalogados
        </div>
      </div>

      <!-- Frequência de Postagem -->
      <div class="kpi-card">
        <div class="kpi-label">
          <div class="label-with-icon">
            <app-icon name="calendar" [size]="14" customClass="icon-indigo"></app-icon>
            <span>Frequência</span>
          </div>
        </div>
        <div class="kpi-value">
          {{ summary.posts_por_semana !== null ? (summary.posts_por_semana | number:'1.1-1') : '—' }}
          <span class="unit">/ sem</span>
        </div>
        <div class="kpi-subtext">
          {{ summary.periodo_dias ? summary.periodo_dias + ' dias de histórico' : 'Período único' }}
        </div>
      </div>

      <!-- Melhor Horário e Dia -->
      <div class="kpi-card">
        <div class="kpi-label">
          <div class="label-with-icon">
            <app-icon name="clock" [size]="14" customClass="icon-yellow"></app-icon>
            <span>Pico de Interação</span>
          </div>
        </div>
        <div class="kpi-value text-amber">
          {{ formatBestTiming(summary.melhor_dia, summary.melhor_hora) }}
        </div>
        <div class="kpi-subtext">
          Janela de maior tração histórica
        </div>
      </div>
    </div>
  `,
  styles: [`
    .label-with-icon {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .highlight-card {
      background: linear-gradient(135deg, rgba(225, 48, 108, 0.09) 0%, rgba(14, 20, 36, 0.95) 100%);
      border-color: rgba(225, 48, 108, 0.35);
    }

    .text-gradient {
      background: var(--ig-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .text-cyan {
      color: #38bdf8;
    }

    .text-amber {
      color: #fbbf24;
    }

    .unit {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--text-muted);
    }

    .text-dim {
      color: var(--text-dim);
    }

    :host ::ng-deep .icon-rose { color: #f43f5e; }
    :host ::ng-deep .icon-cyan { color: #38bdf8; }
    :host ::ng-deep .icon-amber { color: #f59e0b; }
    :host ::ng-deep .icon-indigo { color: #818cf8; }
    :host ::ng-deep .icon-yellow { color: #facc15; }
  `]
})
export class KpiSummaryComponent {
  @Input() summary?: AnalysisSummary;

  getEngagementBadgeClass(rate: number | null): string {
    if (rate === null) return 'badge-neutral';
    if (rate >= 3.5) return 'badge-success';
    if (rate >= 1.5) return 'badge-primary';
    return 'badge-warning';
  }

  getEngagementLabel(rate: number | null): string {
    if (rate === null) return 'N/D';
    if (rate >= 3.5) return 'Excelente (>3.5%)';
    if (rate >= 1.5) return 'Bom (1.5%+)';
    return 'Moderado';
  }

  formatBestTiming(dia: string | null, hora: number | null): string {
    if (!dia && hora === null) return 'N/D';
    if (dia && hora !== null) return `${dia} às ${hora}h`;
    if (dia) return dia;
    return `${hora}h`;
  }
}
