import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnalyzeResponse } from '../../models/instagram.model';
import { ApiService } from '../../services/api.service';
import { IconComponent } from '../ui/icon/icon.component';

@Component({
  selector: 'app-tab-export',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="tab-content-wrapper">
      <div class="card mb-4">
        <div class="card-title">
          <div class="title-left">
            <app-icon name="download" [size]="18" customClass="icon-rose"></app-icon>
            <span>Centro de Exportação de Dados & Relatórios</span>
          </div>
          <span class="badge badge-primary">CSV, JSON & Relatório Executivo</span>
        </div>
        <p class="card-subtitle">
          Exporte os datasets brutos ou processados nos formatos padronizados para alimentar planilhas, dashboards de BI ou backups.
        </p>

        <div class="export-grid">
          <!-- Posts CSV -->
          <div class="export-card">
            <div class="export-top">
              <div class="export-icon-box box-cyan">
                <app-icon name="bar-chart" [size]="22"></app-icon>
              </div>
              <div class="export-info">
                <h4>Publicações Analisadas</h4>
                <p>Métricas completas de curtidas, comentários, engajamento, legendas e links.</p>
                <span class="export-meta">{{ analysis?.posts?.length || 0 }} registros</span>
              </div>
            </div>
            <button class="btn btn-primary export-btn" (click)="exportPostsCsv()" [disabled]="!analysis?.posts?.length">
              <app-icon name="download" [size]="14"></app-icon>
              <span>Baixar CSV</span>
            </button>
          </div>

          <!-- Comments CSV -->
          <div class="export-card">
            <div class="export-top">
              <div class="export-icon-box box-rose">
                <app-icon name="message-square" [size]="22"></app-icon>
              </div>
              <div class="export-info">
                <h4>Comentários & Sentimento</h4>
                <p>Autores, sentimento léxico classificado, texto e carimbo de data/hora.</p>
                <span class="export-meta">{{ analysis?.comments?.items?.length || 0 }} comentários</span>
              </div>
            </div>
            <button class="btn btn-secondary export-btn" (click)="exportCommentsCsv()" [disabled]="!analysis?.comments?.items?.length">
              <app-icon name="download" [size]="14"></app-icon>
              <span>Baixar CSV</span>
            </button>
          </div>

          <!-- Hashtags CSV -->
          <div class="export-card">
            <div class="export-top">
              <div class="export-icon-box box-emerald">
                <app-icon name="hash" [size]="22"></app-icon>
              </div>
              <div class="export-info">
                <h4>Hashtags & Performance</h4>
                <p>Volume de uso e média de interações geradas por hashtag analisada.</p>
                <span class="export-meta">{{ analysis?.hashtags?.top?.length || 0 }} hashtags</span>
              </div>
            </div>
            <button class="btn btn-secondary export-btn" (click)="exportHashtagsCsv()" [disabled]="!analysis?.hashtags?.top?.length">
              <app-icon name="download" [size]="14"></app-icon>
              <span>Baixar CSV</span>
            </button>
          </div>

          <!-- Audience CSV -->
          <div class="export-card">
            <div class="export-top">
              <div class="export-icon-box box-indigo">
                <app-icon name="users" [size]="22"></app-icon>
              </div>
              <div class="export-info">
                <h4>Audiência & Relações</h4>
                <p>Listas de seguidores mútuos, unfollowers e amostras de rede.</p>
                <span class="export-meta">{{ totalAudienceCount }} registros</span>
              </div>
            </div>
            <button class="btn btn-secondary export-btn" (click)="exportAudienceCsv()" 
                    [disabled]="totalAudienceCount === 0">
              <app-icon name="download" [size]="14"></app-icon>
              <span>Baixar CSV</span>
            </button>
          </div>

          <!-- Highlights (Destaques) -->
          <div class="export-card">
            <div class="export-top">
              <div class="export-icon-box box-yellow">
                <app-icon name="award" [size]="22"></app-icon>
              </div>
              <div class="export-info">
                <h4>Destaques & Stories Salvos</h4>
                <p>Resumo dos destaques e lista completa de todas as mídias (fotos e vídeos) com links diretos.</p>
                <span class="export-meta">{{ highlightsCount }} destaques ({{ totalHighlightStoriesCount }} mídias expandidas)</span>
              </div>
            </div>
            <div class="export-card-actions">
              <button class="btn btn-secondary export-btn" (click)="exportHighlightsCsv()" 
                      [disabled]="highlightsCount === 0" title="Planilha resumida com 1 linha por destaque">
                <app-icon name="download" [size]="14"></app-icon>
                <span>Resumo CSV</span>
              </button>
              <button class="btn btn-primary export-btn" (click)="exportHighlightMediaCsv()" 
                      [disabled]="highlightsCount === 0" title="Planilha completa com 1 linha por foto/vídeo de cada destaque">
                <app-icon name="download" [size]="14"></app-icon>
                <span>Todas as Mídias CSV</span>
              </button>
              <button class="btn btn-outline export-btn" (click)="exportHighlightsJson()" 
                      [disabled]="highlightsCount === 0" title="Arquivo JSON estruturado com todos os destaques e mídias">
                <app-icon name="download" [size]="14"></app-icon>
                <span>JSON</span>
              </button>
            </div>
          </div>

          <!-- Full JSON Export -->
          <div class="export-card highlight-export">
            <div class="export-top">
              <div class="export-icon-box box-amber">
                <app-icon name="database" [size]="22"></app-icon>
              </div>
              <div class="export-info">
                <h4>Dataset Completo (JSON)</h4>
                <p>Estrutura íntegra com todos os gráficos, perfil, dados brutos e sumário.</p>
                <span class="export-meta">Backup Estruturado</span>
              </div>
            </div>
            <button class="btn btn-primary export-btn" (click)="exportFullJson()" [disabled]="!analysis">
              <app-icon name="download" [size]="14"></app-icon>
              <span>Baixar JSON</span>
            </button>
          </div>

          <!-- Summary TXT Report -->
          <div class="export-card">
            <div class="export-top">
              <div class="export-icon-box box-cyan">
                <app-icon name="file-text" [size]="22"></app-icon>
              </div>
              <div class="export-info">
                <h4>Resumo Executivo (TXT)</h4>
                <p>Relatório textual condensado pronto para envio a clientes ou equipe.</p>
                <span class="export-meta">Texto Formatado</span>
              </div>
            </div>
            <button class="btn btn-outline export-btn" (click)="exportSummaryTxt()" [disabled]="!analysis">
              <app-icon name="download" [size]="14"></app-icon>
              <span>Baixar Relatório</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .mb-4 { margin-bottom: 1.5rem; }

    .export-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 1.25rem;
      margin-top: 1rem;
    }

    .export-card {
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      justify-content: space-between;
      transition: all var(--transition-fast);
    }

    .export-card:hover {
      border-color: var(--border-hover);
      transform: translateY(-2px);
    }

    .highlight-export {
      background: linear-gradient(135deg, rgba(225, 48, 108, 0.08) 0%, rgba(17, 23, 38, 0.95) 100%);
      border-color: rgba(225, 48, 108, 0.35);
    }

    .export-top {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
    }

    .export-icon-box {
      width: 44px;
      height: 44px;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .box-cyan { background: rgba(56, 189, 248, 0.15); color: #38bdf8; }
    .box-rose { background: rgba(225, 48, 108, 0.15); color: #f472b6; }
    .box-emerald { background: rgba(16, 185, 129, 0.15); color: #34d399; }
    .box-indigo { background: rgba(99, 102, 241, 0.15); color: #818cf8; }
    .box-amber { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
    .box-yellow { background: rgba(250, 204, 21, 0.15); color: #facc15; }

    .export-info h4 {
      font-size: 0.95rem;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 0.25rem;
    }

    .export-info p {
      font-size: 0.8rem;
      color: var(--text-secondary);
      line-height: 1.45;
      margin-bottom: 0.45rem;
    }

    .export-meta {
      font-size: 0.725rem;
      color: var(--accent-cyan);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .export-card-actions {
      display: flex;
      gap: 0.5rem;
      width: 100%;
    }

    .export-card-actions .export-btn {
      flex: 1;
    }

    .export-btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.45rem;
    }

    :host ::ng-deep .icon-rose { color: #f43f5e; }
  `]
})
export class TabExportComponent {
  @Input() analysis?: AnalyzeResponse;
  private readonly api = inject(ApiService);

  get totalAudienceCount(): number {
    if (!this.analysis?.audience) return 0;
    const a = this.analysis.audience;
    return (a.not_following_back?.length || 0) +
           (a.mutual?.length || 0) +
           (a.followers?.length || 0) +
           (a.followees?.length || 0);
  }

  get highlightsCount(): number {
    return this.analysis?.extra?.highlights?.length || 0;
  }

  get totalHighlightStoriesCount(): number {
    if (!this.analysis?.extra?.highlights?.length) return 0;
    return this.analysis.extra.highlights.reduce(
      (sum, h) => sum + (h.items?.length || h.mediaCount || h.media_count || 0),
      0
    );
  }

  exportPostsCsv(): void {
    if (!this.analysis?.posts?.length) return;
    const username = this.analysis.info?.username || 'perfil';
    const rows = this.analysis.posts.map(p => ({
      shortcode: p.shortcode,
      url: p.url || `https://www.instagram.com/p/${p.shortcode}/`,
      data: p.data || '',
      tipo: p.tipo || '',
      curtidas: p.curtidas >= 0 ? p.curtidas : 'Ocultas',
      comentarios: p.comentarios,
      interacoes: p.interacoes,
      taxa_engajamento_pct: p.taxa_engajamento ?? '',
      alcance: p.alcance ?? '',
      salvos: p.salvos ?? '',
      compartilhamentos: p.compartilhamentos ?? '',
      visualizacoes: p.visualizacoes ?? '',
      visualizacoes_video: p.visualizacoes_video ?? '',
      duracao_video_seg: p.duracao_video ?? '',
      produto: p.produto || '',
      patrocinado: p.patrocinado ? 'Sim' : 'Nao',
      n_midias: p.n_midias ?? 1,
      legenda: (p.legenda || '').replace(/\r?\n/g, ' '),
      hashtags: (p.hashtags || []).join(', '),
      mencoes: (p.mencoes || []).join(', '),
      marcados: (p.marcados || []).join(', '),
      local: p.local || '',
    }));
    this.api.exportToCsv(rows, `posts_${username}_${this.getDateStamp()}`);
  }

  exportCommentsCsv(): void {
    if (!this.analysis?.comments?.items?.length) return;
    const username = this.analysis.info?.username || 'perfil';
    const rows = this.analysis.comments.items.map(c => ({
      post_shortcode: c.shortcode || '',
      autor: c.autor || '',
      sentimento: c.sentimento,
      curtidas: c.curtidas,
      data: c.data || '',
      texto: c.texto.replace(/\r?\n/g, ' '),
    }));
    this.api.exportToCsv(rows, `comentarios_${username}_${this.getDateStamp()}`);
  }

  exportHashtagsCsv(): void {
    if (!this.analysis?.hashtags) return;
    const username = this.analysis.info?.username || 'perfil';
    const perfMap = new Map((this.analysis.hashtags.performance || []).map(p => [p.item, p.media]));
    const rows = (this.analysis.hashtags.top || []).map(h => ({
      hashtag: `#${h.item}`,
      usos: h.usos,
      media_interacoes: perfMap.has(h.item) ? perfMap.get(h.item) : '',
    }));
    this.api.exportToCsv(rows, `hashtags_${username}_${this.getDateStamp()}`);
  }

  exportAudienceCsv(): void {
    if (!this.analysis?.audience) return;
    const username = this.analysis.info?.username || 'perfil';
    const notF = (this.analysis.audience.not_following_back || []).map(u => ({
      usuario: u,
      nome: '',
      relacao: 'Nao Te Segue de Volta',
      verificado: '',
      privado: ''
    }));
    const mutual = (this.analysis.audience.mutual || []).map(u => ({
      usuario: u,
      nome: '',
      relacao: 'Seguidor Mutuo',
      verificado: '',
      privado: ''
    }));
    const followers = (this.analysis.audience.followers || []).map(u => ({
      usuario: u.username,
      nome: u.nome || u.full_name || '',
      relacao: 'Seguidor Coletado',
      verificado: (u.verificado || u.is_verified) ? 'Sim' : 'Nao',
      privado: (u.privado || u.is_private) ? 'Sim' : 'Nao'
    }));
    const followees = (this.analysis.audience.followees || []).map(u => ({
      usuario: u.username,
      nome: u.nome || u.full_name || '',
      relacao: 'Perfil Seguido',
      verificado: (u.verificado || u.is_verified) ? 'Sim' : 'Nao',
      privado: (u.privado || u.is_private) ? 'Sim' : 'Nao'
    }));
    const rows = [...notF, ...mutual, ...followers, ...followees];
    this.api.exportToCsv(rows, `audiencia_${username}_${this.getDateStamp()}`);
  }

  exportHighlightsCsv(): void {
    if (!this.analysis?.extra?.highlights?.length) return;
    const username = this.analysis.info?.username || 'perfil';
    const rows = this.analysis.extra.highlights.map((h, idx) => ({
      ordem: idx + 1,
      id: h.id || '',
      titulo: h.title || 'Sem título',
      qtd_midias: (h.items?.length || h.mediaCount || h.media_count || 0),
      url_instagram: h.url || (h.id ? `https://www.instagram.com/stories/highlights/${h.id}/` : ''),
      url_capa: h.coverImageUrl || h.cover || '',
    }));
    this.api.exportToCsv(rows, `destaques_${username}_${this.getDateStamp()}`);
  }

  exportHighlightMediaCsv(): void {
    if (!this.analysis?.extra?.highlights?.length) return;
    const username = this.analysis.info?.username || 'perfil';
    const rows: any[] = [];
    let mediaIndex = 1;

    for (const h of this.analysis.extra.highlights) {
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

    this.api.exportToCsv(rows, `conteudos_destaques_${username}_${this.getDateStamp()}`);
  }

  exportHighlightsJson(): void {
    if (!this.analysis?.extra?.highlights?.length) return;
    const username = this.analysis.info?.username || 'perfil';
    const data = this.analysis.extra.highlights.map(h => ({
      id: h.id || '',
      title: h.title || 'Sem título',
      media_count: (h.items?.length || h.mediaCount || h.media_count || 0),
      url: h.url || (h.id ? `https://www.instagram.com/stories/highlights/${h.id}/` : ''),
      cover_image_url: h.coverImageUrl || h.cover || '',
      items: h.items || [],
    }));
    this.api.exportToJson(data, `destaques_${username}_${this.getDateStamp()}`);
  }

  exportFullJson(): void {
    if (!this.analysis) return;
    const username = this.analysis.info?.username || 'perfil';
    this.api.exportToJson(this.analysis, `analise_completa_${username}_${this.getDateStamp()}`);
  }

  exportSummaryTxt(): void {
    if (!this.analysis) return;
    const info = this.analysis.info;
    const s = this.analysis.summary;
    const username = info?.username || 'perfil';

    const highlightsText = (this.analysis.extra?.highlights || []).length
      ? (this.analysis.extra?.highlights || [])
          .map((h, i) => `  ${i + 1}. ${h.title || 'Sem título'} (${h.mediaCount || h.media_count || 0} mídias) - ${h.url || 'Sem link'}`)
          .join('\n')
      : 'Nenhum destaque extraído.';

    const text = `
=====================================================
INSTA ANALYZER - RESUMO EXECUTIVO
=====================================================
Perfil: @${info?.username} (${info?.nome_completo || 'Sem nome'})
Seguidores: ${info?.seguidores?.toLocaleString('pt-BR')}
Seguindo: ${info?.seguindo?.toLocaleString('pt-BR')}
Total de Posts: ${info?.posts?.toLocaleString('pt-BR')}
Tipo de Conta: ${info?.conta_business ? 'Comercial' : 'Pessoal'}
Fonte dos Dados: ${this.analysis.source}
Data da Análise: ${new Date().toLocaleString('pt-BR')}

--- MÉTRICAS DE ENGAJAMENTO ---
Posts Analisados: ${s.posts_analisados}
Taxa de Engajamento: ${s.taxa_engajamento !== null ? s.taxa_engajamento + '%' : 'N/D'}
Média de Curtidas: ${s.media_curtidas ?? 'N/D'}
Mediana de Curtidas: ${s.mediana_curtidas ?? 'N/D'}
Média de Comentários: ${s.media_comentarios ?? 'N/D'}
Total de Interações: ${(s.total_interacoes ?? 0).toLocaleString('pt-BR')}
Frequência: ${s.posts_por_semana ? s.posts_por_semana + ' posts/semana' : 'N/D'}
Período Histórico: ${s.periodo_dias ? s.periodo_dias + ' dias' : 'N/D'}

--- MELHORES HORÁRIOS ---
Melhor Dia: ${s.melhor_dia || 'N/D'}
Melhor Horário: ${s.melhor_hora !== null ? s.melhor_hora + ':00h' : 'N/D'}

--- DESTAQUES FIXADOS (HIGHLIGHTS) ---
Total de Destaques: ${this.highlightsCount}
${highlightsText}

--- COMENTÁRIOS E SENTIMENTO ---
Total de Comentários Coletados: ${this.analysis.comments?.total || 0}
Positivos: ${this.analysis.comments?.sentiment?.positivo || 0}
Neutros: ${this.analysis.comments?.sentiment?.neutro || 0}
Negativos: ${this.analysis.comments?.sentiment?.negativo || 0}
=====================================================
Gerado automaticamente pelo Insta Analyzer.
`.trim();

    this.api.exportToText(text, `resumo_${username}_${this.getDateStamp()}`);
  }

  private getDateStamp(): string {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  }
}
