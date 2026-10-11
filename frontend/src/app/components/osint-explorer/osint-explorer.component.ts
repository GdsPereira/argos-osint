import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { IconComponent } from '../ui/icon/icon.component';
import {
  OsintDorkPreset,
  OsintDorkResponse,
  BioResolveResponse,
  UsernameScanResponse,
  OsintDossierResponse,
  DiscoveredPlatformAccount,
  OsintWebResult,
} from '../../models/osint.model';

type OsintSubTab = 'dorks' | 'bio' | 'footprint' | 'dossier';

@Component({
  selector: 'app-osint-explorer',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div class="osint-container">
      <!-- Header Banner -->
      <header class="osint-header">
        <div class="osint-badge">
          <app-icon name="shield" [size]="14" customClass="icon-gradient"></app-icon>
          <span>OSINT & Threat Intelligence Open-Source</span>
        </div>
        <h2 class="osint-title">Investigação Digital & Google Dorking</h2>
        <p class="osint-subtitle">
          Descubra pegada digital de criadores e marcas, audite menções em fontes abertas,
          resolva agregadores de bio (Linktree/Beacons) e execute dorks avançados sem custos de API.
        </p>

        <!-- Sub Tabs Nav -->
        <nav class="subtabs-nav">
          <button
            class="subtab-btn"
            [class.active]="activeTab === 'dorks'"
            (click)="activeTab = 'dorks'">
            <app-icon name="terminal" [size]="16"></app-icon>
            <span>Google & DDG Dorks</span>
          </button>
          <button
            class="subtab-btn"
            [class.active]="activeTab === 'bio'"
            (click)="activeTab = 'bio'">
            <app-icon name="globe" [size]="16"></app-icon>
            <span>Bio Link Resolver</span>
          </button>
          <button
            class="subtab-btn"
            [class.active]="activeTab === 'footprint'"
            (click)="activeTab = 'footprint'">
            <app-icon name="users" [size]="16"></app-icon>
            <span>Pegada Digital (Username)</span>
          </button>
          <button
            class="subtab-btn"
            [class.active]="activeTab === 'dossier'"
            (click)="activeTab = 'dossier'">
            <app-icon name="sparkles" [size]="16"></app-icon>
            <span>Dossiê Completo 360°</span>
          </button>
        </nav>
      </header>

      <!-- TAB 1: GOOGLE & DDG DORKS -->
      <section *ngIf="activeTab === 'dorks'" class="tab-pane">
        <div class="search-panel">
          <div class="inputs-grid">
            <div class="input-group">
              <label>Alvo / Marca / Nome</label>
              <div class="input-wrapper">
                <app-icon name="search" [size]="16" class="input-icon"></app-icon>
                <input
                  type="text"
                  [(ngModel)]="dorkQuery"
                  (keyup.enter)="runDorkSearch()"
                  placeholder="Ex: Nubank, cristiano, marca..."
                />
              </div>
            </div>

            <div class="input-group">
              <label>Preset de Inteligência</label>
              <select [(ngModel)]="selectedPreset" (change)="onPresetChange()">
                <option value="reputation">🛡️ Reputação & Reclame Aqui</option>
                <option value="press">📰 Imprensa & Entrevistas</option>
                <option value="media_kit">📄 Mídia Kit & Tarifários (PDF)</option>
                <option value="transmedia">🌐 Descoberta Transmídia (Outras Redes)</option>
                <option value="judicial">⚖️ Processos & Notificações</option>
                <option value="custom">⚙️ Dork Personalizado (Livre)</option>
              </select>
            </div>
          </div>

          <!-- Preview da Query do Dork -->
          <div class="query-preview">
            <span class="preview-label">Operador Executado:</span>
            <code class="preview-code">{{ getActiveDorkPreview() }}</code>
          </div>

          <div *ngIf="selectedPreset === 'custom'" class="input-group custom-dork-input">
            <label>Query Dork Customizada (Google/DDG)</label>
            <input
              type="text"
              [(ngModel)]="customDorkQuery"
              placeholder="Ex: site:github.com &quot;username&quot; or filetype:pdf &quot;termo&quot;"
            />
          </div>

          <button
            class="btn-primary"
            [disabled]="isLoadingDorks || !dorkQuery.trim()"
            (click)="runDorkSearch()">
            <app-icon *ngIf="!isLoadingDorks" name="terminal" [size]="16"></app-icon>
            <app-icon *ngIf="isLoadingDorks" name="refresh-cw" [size]="16" class="spin"></app-icon>
            <span>{{ isLoadingDorks ? 'Pesquisando fontes abertas...' : 'Executar Dorking OSINT' }}</span>
          </button>
        </div>

        <!-- Dork Results -->
        <div *ngIf="dorkResults" class="results-container">
          <div class="results-header">
            <h3>Resultados Encontrados ({{ dorkResults.total_found }})</h3>
            <button class="btn-secondary" (click)="exportDorksCsv()">
              <app-icon name="download" [size]="14"></app-icon>
              <span>Exportar CSV</span>
            </button>
          </div>

          <div *ngIf="dorkResults.results.length === 0" class="empty-state">
            <app-icon name="info" [size]="28"></app-icon>
            <p>Nenhuma menção indexada encontrada para os parâmetros informados.</p>
          </div>

          <div class="cards-list">
            <div *ngFor="let item of dorkResults.results" class="result-card">
              <div class="card-meta">
                <span class="preset-tag">{{ item.preset }}</span>
                <span class="engine-tag">{{ item.source_engine }}</span>
              </div>
              <h4 class="card-title">
                <a [href]="item.url" target="_blank" rel="noopener noreferrer">
                  {{ item.title || item.url }}
                </a>
              </h4>
              <p class="card-snippet">{{ item.snippet }}</p>
              <div class="card-footer">
                <span class="card-url">{{ item.url }}</span>
                <a [href]="item.url" target="_blank" rel="noopener noreferrer" class="link-btn">
                  <span>Abrir Fonte</span>
                  <app-icon name="external-link" [size]="12"></app-icon>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- TAB 2: BIO LINK RESOLVER -->
      <section *ngIf="activeTab === 'bio'" class="tab-pane">
        <div class="search-panel">
          <div class="input-group">
            <label>URL da Bio (Linktree, Beacons, Carrd, Bento.me ou site próprio)</label>
            <div class="input-wrapper">
              <app-icon name="globe" [size]="16" class="input-icon"></app-icon>
              <input
                type="text"
                [(ngModel)]="bioUrlInput"
                (keyup.enter)="runBioResolve()"
                placeholder="Ex: https://linktr.ee/cristiano ou https://beacons.ai/perfil"
              />
            </div>
          </div>
          <button
            class="btn-primary"
            [disabled]="isLoadingBio || !bioUrlInput.trim()"
            (click)="runBioResolve()">
            <app-icon *ngIf="!isLoadingBio" name="globe" [size]="16"></app-icon>
            <app-icon *ngIf="isLoadingBio" name="refresh-cw" [size]="16" class="spin"></app-icon>
            <span>{{ isLoadingBio ? 'Resolvendo canais e redirecionamentos...' : 'Extrair Redes Oficiais' }}</span>
          </button>
        </div>

        <div *ngIf="bioResults" class="results-container">
          <div *ngIf="bioResults.error" class="error-banner">
            <app-icon name="alert-triangle" [size]="18"></app-icon>
            <span>{{ bioResults.error }}</span>
          </div>

          <div *ngIf="!bioResults.error">
            <div class="results-header">
              <div>
                <h3>{{ bioResults.title || 'Página de Destino Resolvida' }}</h3>
                <span class="subtext">{{ bioResults.final_url }}</span>
              </div>
              <span class="badge-count">{{ bioResults.socials.length }} Canais Identificados</span>
            </div>

            <!-- Socials Grid -->
            <div class="socials-grid">
              <div *ngFor="let soc of bioResults.socials" class="social-card">
                <div class="social-header">
                  <span class="social-platform">{{ soc.platform | uppercase }}</span>
                  <span class="social-verified">OFICIAL</span>
                </div>
                <div class="social-handle">{{ soc.handle ? '&#64;' + soc.handle : 'Canal Detectado' }}</div>
                <a [href]="soc.url" target="_blank" rel="noopener noreferrer" class="social-link">
                  <span>{{ soc.url }}</span>
                  <app-icon name="external-link" [size]="12"></app-icon>
                </a>
              </div>
            </div>

            <!-- Other Links -->
            <div *ngIf="bioResults.other_links.length > 0" class="other-links-section">
              <h4>Outros Destinos & Links Externos Detectados</h4>
              <ul class="links-list">
                <li *ngFor="let link of bioResults.other_links">
                  <a [href]="link" target="_blank" rel="noopener noreferrer">
                    {{ link }}
                    <app-icon name="external-link" [size]="12"></app-icon>
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <!-- TAB 3: USERNAME FOOTPRINT -->
      <section *ngIf="activeTab === 'footprint'" class="tab-pane">
        <div class="search-panel">
          <div class="input-group">
            <label>Nome de Usuário (&#64;username) para Varredura</label>
            <div class="input-wrapper">
              <app-icon name="users" [size]="16" class="input-icon"></app-icon>
              <input
                type="text"
                [(ngModel)]="footprintUsername"
                (keyup.enter)="runFootprintScan()"
                placeholder="Ex: cristiano, roberto, marca..."
              />
            </div>
          </div>
          <button
            class="btn-primary"
            [disabled]="isLoadingFootprint || !footprintUsername.trim()"
            (click)="runFootprintScan()">
            <app-icon *ngIf="!isLoadingFootprint" name="users" [size]="16"></app-icon>
            <app-icon *ngIf="isLoadingFootprint" name="refresh-cw" [size]="16" class="spin"></app-icon>
            <span>{{ isLoadingFootprint ? 'Varrendo 16+ plataformas abertas...' : 'Escanear Pegada Digital' }}</span>
          </button>
        </div>

        <div *ngIf="footprintResults" class="results-container">
          <div class="results-header">
            <h3>
              Pegada Digital de <strong>&#64;{{ footprintResults.username }}</strong>:
              {{ footprintResults.total_found }} de {{ footprintResults.total_checked }} plataformas confirmadas
            </h3>
            <button class="btn-secondary" (click)="exportFootprintCsv()">
              <app-icon name="download" [size]="14"></app-icon>
              <span>Exportar CSV</span>
            </button>
          </div>

          <div class="footprint-grid">
            <div
              *ngFor="let acc of footprintResults.all_results"
              class="footprint-card"
              [class.card-found]="acc.exists"
              [class.card-missing]="!acc.exists">
              <div class="card-status-pill" [class.pill-active]="acc.exists">
                {{ acc.exists ? 'CONTA ENCONTRADA' : 'NÃO DETECTADO' }}
              </div>
              <div class="footprint-name">{{ acc.name }}</div>
              <span class="footprint-category">{{ acc.category }}</span>

              <div *ngIf="acc.exists && acc.url" class="footprint-action">
                <a [href]="acc.url" target="_blank" rel="noopener noreferrer" class="link-btn">
                  <span>Ver Perfil</span>
                  <app-icon name="external-link" [size]="12"></app-icon>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- TAB 4: DOSSIÊ COMPLETO 360 -->
      <section *ngIf="activeTab === 'dossier'" class="tab-pane">
        <div class="search-panel">
          <div class="inputs-grid">
            <div class="input-group">
              <label>Nome do Alvo / Marca / &#64;username</label>
              <div class="input-wrapper">
                <app-icon name="search" [size]="16" class="input-icon"></app-icon>
                <input
                  type="text"
                  [(ngModel)]="dossierTarget"
                  (keyup.enter)="runGenerateDossier()"
                  placeholder="Ex: cristiano ou MarcaX"
                />
              </div>
            </div>
            <div class="input-group">
              <label>Link da Bio (Opcional - Linktree, Beacons, etc.)</label>
              <div class="input-wrapper">
                <app-icon name="globe" [size]="16" class="input-icon"></app-icon>
                <input
                  type="text"
                  [(ngModel)]="dossierBioUrl"
                  placeholder="https://linktr.ee/..."
                />
              </div>
            </div>
          </div>

          <button
            class="btn-primary"
            [disabled]="isLoadingDossier || !dossierTarget.trim()"
            (click)="runGenerateDossier()">
            <app-icon *ngIf="!isLoadingDossier" name="sparkles" [size]="16"></app-icon>
            <app-icon *ngIf="isLoadingDossier" name="refresh-cw" [size]="16" class="spin"></app-icon>
            <span>{{ isLoadingDossier ? 'Gerando Dossiê OSINT Unificado...' : 'Compilar Dossiê Completo 360°' }}</span>
          </button>
        </div>

        <div *ngIf="dossierResults" class="results-container">
          <div class="results-header">
            <h3>Dossiê Consolidado de Inteligência: {{ dossierResults.target }}</h3>
            <button class="btn-secondary" (click)="exportDossierJson()">
              <app-icon name="download" [size]="14"></app-icon>
              <span>Exportar Dossiê JSON</span>
            </button>
          </div>

          <!-- Dossier Summary Cards -->
          <div class="kpi-grid">
            <div class="kpi-card">
              <span class="kpi-label">Redes Oficiais na Bio</span>
              <span class="kpi-value">{{ dossierResults.bio_intelligence?.socials?.length || 0 }}</span>
            </div>
            <div class="kpi-card">
              <span class="kpi-label">Pegada Digital (&#64;username)</span>
              <span class="kpi-value">{{ dossierResults.digital_footprint?.total_found || 0 }}</span>
            </div>
            <div class="kpi-card">
              <span class="kpi-label">Menções Web & Dorks</span>
              <span class="kpi-value">{{ dossierResults.total_web_mentions }}</span>
            </div>
          </div>

          <!-- Mentions Feed -->
          <div class="dossier-section">
            <h4>Menções de Imprensa & Reputação Indexadas</h4>
            <div class="cards-list">
              <div *ngFor="let item of dossierResults.web_mentions" class="result-card">
                <div class="card-meta">
                  <span class="preset-tag">{{ item.preset }}</span>
                </div>
                <h4 class="card-title">
                  <a [href]="item.url" target="_blank" rel="noopener noreferrer">{{ item.title }}</a>
                </h4>
                <p class="card-snippet">{{ item.snippet }}</p>
                <div class="card-footer">
                  <span class="card-url">{{ item.url }}</span>
                  <a [href]="item.url" target="_blank" rel="noopener noreferrer" class="link-btn">
                    <span>Acessar</span>
                    <app-icon name="external-link" [size]="12"></app-icon>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .osint-container {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      padding: 1.5rem;
      color: #f8fafc;
    }

    .osint-header {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .osint-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      width: fit-content;
      padding: 0.35rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      background: rgba(139, 92, 246, 0.15);
      border: 1px solid rgba(139, 92, 246, 0.3);
      color: #c084fc;
    }

    .osint-title {
      font-size: 1.75rem;
      font-weight: 800;
      color: #ffffff;
      margin: 0;
      letter-spacing: -0.02em;
    }

    .osint-subtitle {
      font-size: 0.95rem;
      color: #94a3b8;
      max-width: 800px;
      margin: 0;
      line-height: 1.5;
    }

    .subtabs-nav {
      display: flex;
      gap: 0.5rem;
      margin-top: 1rem;
      border-bottom: 1px solid #334155;
      padding-bottom: 0.5rem;
      overflow-x: auto;
    }

    .subtab-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.6rem 1.1rem;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      font-weight: 600;
      color: #94a3b8;
      background: transparent;
      border: 1px solid transparent;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;

      &:hover {
        color: #f8fafc;
        background: #1e293b;
      }

      &.active {
        color: #ffffff;
        background: #1e293b;
        border-color: #3b82f6;
        box-shadow: 0 0 12px rgba(59, 130, 246, 0.25);
      }
    }

    .search-panel {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 0.75rem;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .inputs-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 1rem;

      @media (max-width: 768px) {
        grid-template-columns: 1fr;
      }
    }

    .input-group {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;

      label {
        font-size: 0.8rem;
        font-weight: 600;
        color: #cbd5e1;
      }

      select, input {
        background: #0f172a;
        border: 1px solid #334155;
        border-radius: 0.5rem;
        padding: 0.65rem 0.85rem;
        color: #f8fafc;
        font-size: 0.9rem;
        outline: none;
        transition: border-color 0.2s;

        &:focus {
          border-color: #3b82f6;
        }
      }
    }

    .input-wrapper {
      position: relative;
      display: flex;
      align-items: center;

      .input-icon {
        position: absolute;
        left: 0.75rem;
        color: #64748b;
      }

      input {
        width: 100%;
        padding-left: 2.3rem;
      }
    }

    .query-preview {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background: rgba(15, 23, 42, 0.7);
      padding: 0.6rem 0.85rem;
      border-radius: 0.5rem;
      border: 1px dashed #475569;
      font-size: 0.8rem;

      .preview-label {
        color: #94a3b8;
        font-weight: 600;
      }

      .preview-code {
        color: #38bdf8;
        font-family: monospace;
        word-break: break-all;
      }
    }

    .btn-primary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      color: #ffffff;
      padding: 0.75rem 1.5rem;
      border-radius: 0.5rem;
      font-weight: 600;
      font-size: 0.95rem;
      border: none;
      cursor: pointer;
      transition: opacity 0.2s;

      &:hover:not(:disabled) {
        opacity: 0.9;
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .btn-secondary {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: #334155;
      color: #f8fafc;
      padding: 0.45rem 0.85rem;
      border-radius: 0.4rem;
      font-size: 0.8rem;
      font-weight: 600;
      border: none;
      cursor: pointer;

      &:hover {
        background: #475569;
      }
    }

    .results-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-top: 1rem;
    }

    .results-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #334155;
      padding-bottom: 0.75rem;

      h3 {
        margin: 0;
        font-size: 1.15rem;
      }

      .subtext {
        font-size: 0.8rem;
        color: #94a3b8;
      }
    }

    .cards-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .result-card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 0.6rem;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      transition: border-color 0.2s;

      &:hover {
        border-color: #3b82f6;
      }

      .card-meta {
        display: flex;
        gap: 0.5rem;

        .preset-tag {
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          background: rgba(59, 130, 246, 0.15);
          color: #60a5fa;
          padding: 0.2rem 0.5rem;
          border-radius: 0.25rem;
        }

        .engine-tag {
          font-size: 0.7rem;
          color: #94a3b8;
          padding: 0.2rem 0.5rem;
        }
      }

      .card-title {
        margin: 0;
        font-size: 1rem;

        a {
          color: #f8fafc;
          text-decoration: none;

          &:hover {
            color: #38bdf8;
            text-decoration: underline;
          }
        }
      }

      .card-snippet {
        font-size: 0.875rem;
        color: #cbd5e1;
        margin: 0;
        line-height: 1.4;
      }

      .card-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 0.25rem;
        font-size: 0.75rem;

        .card-url {
          color: #64748b;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 70%;
        }

        .link-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          color: #38bdf8;
          text-decoration: none;
          font-weight: 600;

          &:hover {
            text-decoration: underline;
          }
        }
      }
    }

    .socials-grid, .footprint-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 0.85rem;
    }

    .social-card, .footprint-card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 0.5rem;
      padding: 0.85rem;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;

      &.card-found {
        border-color: rgba(34, 197, 94, 0.5);
        background: rgba(34, 197, 94, 0.05);
      }

      &.card-missing {
        opacity: 0.6;
      }
    }

    .social-header {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .social-platform {
        font-weight: 700;
        font-size: 0.85rem;
        color: #f8fafc;
      }

      .social-verified {
        font-size: 0.65rem;
        font-weight: 700;
        background: #22c55e;
        color: #022c22;
        padding: 0.15rem 0.4rem;
        border-radius: 0.25rem;
      }
    }

    .social-handle {
      font-size: 0.85rem;
      color: #94a3b8;
    }

    .social-link {
      font-size: 0.75rem;
      color: #38bdf8;
      text-decoration: none;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 0.3rem;
    }

    .card-status-pill {
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.15rem 0.45rem;
      border-radius: 0.25rem;
      width: fit-content;
      background: #475569;
      color: #cbd5e1;

      &.pill-active {
        background: rgba(34, 197, 94, 0.2);
        color: #4ade80;
        border: 1px solid rgba(34, 197, 94, 0.4);
      }
    }

    .footprint-name {
      font-weight: 700;
      font-size: 1rem;
      color: #f8fafc;
    }

    .footprint-category {
      font-size: 0.75rem;
      color: #94a3b8;
      text-transform: uppercase;
    }

    .footprint-action {
      margin-top: 0.25rem;

      .link-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        color: #38bdf8;
        font-size: 0.8rem;
        text-decoration: none;
        font-weight: 600;
      }
    }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;

      @media (max-width: 640px) {
        grid-template-columns: 1fr;
      }
    }

    .kpi-card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 0.6rem;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.3rem;

      .kpi-label {
        font-size: 0.8rem;
        color: #94a3b8;
      }

      .kpi-value {
        font-size: 1.6rem;
        font-weight: 800;
        color: #f8fafc;
      }
    }

    .spin {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `]
})
export class OsintExplorerComponent {
  private api = inject(ApiService);

  activeTab: OsintSubTab = 'dorks';

  // Dorks Tab
  dorkQuery: string = '';
  selectedPreset: OsintDorkPreset = 'reputation';
  customDorkQuery: string = '';
  isLoadingDorks: boolean = false;
  dorkResults: OsintDorkResponse | null = null;

  // Bio Tab
  bioUrlInput: string = '';
  isLoadingBio: boolean = false;
  bioResults: BioResolveResponse | null = null;

  // Footprint Tab
  footprintUsername: string = '';
  isLoadingFootprint: boolean = false;
  footprintResults: UsernameScanResponse | null = null;

  // Dossier Tab
  dossierTarget: string = '';
  dossierBioUrl: string = '';
  isLoadingDossier: boolean = false;
  dossierResults: OsintDossierResponse | null = null;

  getActiveDorkPreview(): string {
    const q = this.dorkQuery.trim() || 'ALVO';
    if (this.selectedPreset === 'custom') {
      return this.customDorkQuery.trim() || `(digite o operador customizado)`;
    } else if (this.selectedPreset === 'reputation') {
      return `"${q}" (site:reclameaqui.com.br OR "reclamação" OR "fraude" OR "golpe" OR "processo")`;
    } else if (this.selectedPreset === 'media_kit') {
      return `"${q}" ("mídia kit" OR "tabela de preços") filetype:pdf`;
    } else if (this.selectedPreset === 'press') {
      return `"${q}" -site:instagram.com (entrevista OR podcast OR notícia)`;
    } else if (this.selectedPreset === 'transmedia') {
      return `"${q}" (site:tiktok.com OR site:youtube.com OR site:linkedin.com)`;
    } else if (this.selectedPreset === 'judicial') {
      return `"${q}" (site:jusbrasil.com.br OR "processo civil")`;
    }
    return q;
  }

  onPresetChange(): void {
    if (this.selectedPreset === 'custom' && !this.customDorkQuery) {
      this.customDorkQuery = `site:github.com "${this.dorkQuery.trim()}"`;
    }
  }

  runDorkSearch(): void {
    if (!this.dorkQuery.trim()) return;
    this.isLoadingDorks = true;

    this.api.searchOsintDork({
      query: this.dorkQuery.trim(),
      preset: this.selectedPreset,
      custom_dork: this.selectedPreset === 'custom' ? this.customDorkQuery.trim() : undefined,
      max_results: 20
    }).subscribe({
      next: (res) => {
        this.dorkResults = res;
        this.isLoadingDorks = false;
      },
      error: () => {
        this.isLoadingDorks = false;
      }
    });
  }

  runBioResolve(): void {
    if (!this.bioUrlInput.trim()) return;
    this.isLoadingBio = true;

    this.api.resolveBioUrl({ url: this.bioUrlInput.trim() }).subscribe({
      next: (res) => {
        this.bioResults = res;
        this.isLoadingBio = false;
      },
      error: (err) => {
        this.bioResults = {
          original_url: this.bioUrlInput,
          socials: [],
          other_links: [],
          status: 'error',
          error: err.message || 'Falha ao resolver link da bio.'
        };
        this.isLoadingBio = false;
      }
    });
  }

  runFootprintScan(): void {
    if (!this.footprintUsername.trim()) return;
    this.isLoadingFootprint = true;

    this.api.scanUsernameFootprint({
      username: this.footprintUsername.trim(),
      limit_targets: 16
    }).subscribe({
      next: (res) => {
        this.footprintResults = res;
        this.isLoadingFootprint = false;
      },
      error: () => {
        this.isLoadingFootprint = false;
      }
    });
  }

  runGenerateDossier(): void {
    if (!this.dossierTarget.trim()) return;
    this.isLoadingDossier = true;

    this.api.generateOsintDossier({
      target: this.dossierTarget.trim(),
      bio_url: this.dossierBioUrl.trim() || undefined,
      include_reputation: true,
      include_press: true,
      include_media_kit: true
    }).subscribe({
      next: (res) => {
        this.dossierResults = res;
        this.isLoadingDossier = false;
      },
      error: () => {
        this.isLoadingDossier = false;
      }
    });
  }

  exportDorksCsv(): void {
    if (!this.dorkResults || !this.dorkResults.results.length) return;
    this.api.exportToCsv(this.dorkResults.results, `dorks_${this.dorkQuery}_${this.selectedPreset}`);
  }

  exportFootprintCsv(): void {
    if (!this.footprintResults || !this.footprintResults.all_results.length) return;
    this.api.exportToCsv(this.footprintResults.all_results, `footprint_${this.footprintUsername}`);
  }

  exportDossierJson(): void {
    if (!this.dossierResults) return;
    this.api.exportToJson(this.dossierResults, `osint_dossier_${this.dossierResults.target}`);
  }
}
