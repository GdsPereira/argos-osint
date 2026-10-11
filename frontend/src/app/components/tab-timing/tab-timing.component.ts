import { Component, Input, AfterViewInit, OnDestroy, OnChanges, SimpleChanges, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import Chart from 'chart.js/auto';
import { AnalysisSummary, HourBreakdown, WeekdayBreakdown } from '../../models/instagram.model';
import { IconComponent } from '../ui/icon/icon.component';

@Component({
  selector: 'app-tab-timing',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="tab-content-wrapper">
      <!-- Strategy Highlights Header -->
      <div class="card mb-4 timing-summary-card">
        <div class="card-title">
          <div class="title-left">
            <app-icon name="clock" [size]="18" customClass="icon-amber"></app-icon>
            <span>Recomendações de Agendamento & Alcance</span>
          </div>
          <span class="badge badge-success">Otimização de Tração</span>
        </div>
        <div class="timing-recommendations">
          <div class="recom-item">
            <span class="recom-label">Melhor Horário para Postar</span>
            <div class="recom-val text-amber">
              {{ summary?.melhor_hora !== null && summary?.melhor_hora !== undefined ? summary!.melhor_hora + ':00h' : 'Dados insuficientes' }}
            </div>
            <span class="recom-hint">Faixa com o maior pico histórico de interações médias por post.</span>
          </div>

          <div class="recom-divider"></div>

          <div class="recom-item">
            <span class="recom-label">Melhor Dia da Semana</span>
            <div class="recom-val text-cyan">
              {{ summary?.melhor_dia || 'Dados insuficientes' }}
            </div>
            <span class="recom-hint">Dia da semana com maior taxa média de resposta do público.</span>
          </div>
        </div>
      </div>

      <div class="grid-2">
        <!-- Hour of Day Bar Chart -->
        <div class="card">
          <div class="card-title">
            <div class="title-left">
              <app-icon name="clock" [size]="18" customClass="icon-cyan"></app-icon>
              <span>Interações por Horário do Dia (0h - 23h)</span>
            </div>
          </div>
          <p class="card-subtitle">
            Média de interações obtidas em publicações veiculadas em cada hora do dia.
          </p>

          <div class="chart-container">
            <canvas #hourCanvas></canvas>
          </div>
        </div>

        <!-- Day of Week Bar Chart -->
        <div class="card">
          <div class="card-title">
            <div class="title-left">
              <app-icon name="calendar" [size]="18" customClass="icon-rose"></app-icon>
              <span>Interações por Dia da Semana</span>
            </div>
          </div>
          <p class="card-subtitle">
            Média de interações agregadas por dia de publicação (Segunda a Domingo).
          </p>

          <div class="chart-container">
            <canvas #weekdayCanvas></canvas>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .mb-4 {
      margin-bottom: 1.5rem;
    }

    .timing-summary-card {
      background: linear-gradient(135deg, rgba(20, 28, 48, 0.75) 0%, rgba(14, 20, 36, 0.95) 100%);
      border-color: rgba(255, 255, 255, 0.12);
    }

    .timing-recommendations {
      display: flex;
      align-items: center;
      gap: 2.5rem;
      padding-top: 0.75rem;
    }

    @media (max-width: 650px) {
      .timing-recommendations {
        flex-direction: column;
        align-items: flex-start;
        gap: 1.25rem;
      }
      .recom-divider {
        display: none;
      }
    }

    .recom-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .recom-label {
      font-size: 0.76rem;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .recom-val {
      font-size: 2rem;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      line-height: 1.1;
    }

    .text-amber {
      color: #fbbf24;
    }

    .text-cyan {
      color: #38bdf8;
    }

    .recom-hint {
      font-size: 0.775rem;
      color: var(--text-secondary);
    }

    .recom-divider {
      width: 1px;
      height: 52px;
      background: var(--border-default);
    }

    .chart-container {
      position: relative;
      height: 300px;
      width: 100%;
    }

    :host ::ng-deep .icon-amber { color: #fbbf24; }
    :host ::ng-deep .icon-cyan { color: #38bdf8; }
    :host ::ng-deep .icon-rose { color: #f43f5e; }
  `]
})
export class TabTimingComponent implements AfterViewInit, OnDestroy, OnChanges {
  @Input() byHour: HourBreakdown[] = [];
  @Input() byWeekday: WeekdayBreakdown[] = [];
  @Input() summary?: AnalysisSummary;

  private hourCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('hourCanvas') set hourCanvasRef(ref: ElementRef<HTMLCanvasElement> | undefined) {
    this.hourCanvas = ref;
    if (ref) setTimeout(() => this.renderHourChart(), 0);
  }

  private weekdayCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('weekdayCanvas') set weekdayCanvasRef(ref: ElementRef<HTMLCanvasElement> | undefined) {
    this.weekdayCanvas = ref;
    if (ref) setTimeout(() => this.renderWeekdayChart(), 0);
  }

  private hourChartInstance: Chart | null = null;
  private weekdayChartInstance: Chart | null = null;

  ngAfterViewInit(): void {
    this.renderCharts();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['byHour'] || changes['byWeekday']) {
      this.renderCharts();
    }
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  private destroyCharts(): void {
    if (this.hourChartInstance) {
      this.hourChartInstance.destroy();
      this.hourChartInstance = null;
    }
    if (this.weekdayChartInstance) {
      this.weekdayChartInstance.destroy();
      this.weekdayChartInstance = null;
    }
  }

  private renderCharts(): void {
    this.destroyCharts();
    this.renderHourChart();
    this.renderWeekdayChart();
  }

  private renderHourChart(): void {
    if (!this.hourCanvas || !this.byHour || this.byHour.length === 0) return;
    const ctx = this.hourCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const labels = this.byHour.map(h => `${h.hora}h`);
    const data = this.byHour.map(h => h.interacoes);
    const bestHour = this.summary?.melhor_hora;

    // Highlight best hour with Instagram pink
    const bgColors = this.byHour.map(h =>
      h.hora === bestHour ? '#e1306c' : 'rgba(99, 102, 241, 0.65)'
    );

    this.hourChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Média de Interações',
          data,
          backgroundColor: bgColors,
          borderRadius: 6,
          borderWidth: 0,
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
              label: (item: any) => `${item.raw} interações médias`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#64748b', font: { family: 'Plus Jakarta Sans', size: 10 } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#64748b', font: { family: 'Plus Jakarta Sans', size: 11 } }
          }
        }
      }
    });
  }

  private renderWeekdayChart(): void {
    if (!this.weekdayCanvas || !this.byWeekday || this.byWeekday.length === 0) return;
    const ctx = this.weekdayCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const labels = this.byWeekday.map(w => w.dia);
    const data = this.byWeekday.map(w => w.interacoes);
    const bestDay = this.summary?.melhor_dia;

    const bgColors = this.byWeekday.map(w =>
      w.dia === bestDay ? '#f59e0b' : 'rgba(56, 189, 248, 0.65)'
    );

    this.weekdayChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Média de Interações',
          data,
          backgroundColor: bgColors,
          borderRadius: 6,
          borderWidth: 0,
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
              label: (item: any) => `${item.raw} interações médias`
            }
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
}
