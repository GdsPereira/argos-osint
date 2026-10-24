import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EntityGraphData, GraphEdge, GraphNode } from '../../../models/osint.model';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-entity-graph',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div class="graph-wrapper">
      <!-- Toolbar Superior -->
      <div class="graph-toolbar">
        <div class="toolbar-left">
          <div class="graph-pill">
            <app-icon name="network" [size]="14" customClass="icon-gradient"></app-icon>
            <span>Grafo Open-Source de Vínculos (Clique para Inspecionar • Duplo-Clique para Expandir)</span>
          </div>
          <span class="stat-pill" *ngIf="graphData">
            {{ graphData.total_nodes }} entidades • {{ graphData.total_edges }} conexões
          </span>
          <span class="bridge-pill" *ngIf="bridgeNodesCount > 0" title="Nós que conectam múltiplas entidades ou alvos">
            ⚡ {{ bridgeNodesCount }} {{ bridgeNodesCount === 1 ? 'Nó Ponte' : 'Nós Pontes' }}
          </span>
        </div>

        <div class="toolbar-right">
          <!-- Filtros de Tipo de Nó -->
          <div class="filter-group" role="group" aria-label="Filtrar tipos de entidade no grafo">
            <button
              class="filter-chip"
              [class.active]="activeTypeFilter === 'all'"
              (click)="setTypeFilter('all')">
              Todos
            </button>
            <button
              class="filter-chip"
              [class.active]="activeTypeFilter === 'social_account'"
              (click)="setTypeFilter('social_account')">
              Contas
            </button>
            <button
              class="filter-chip"
              [class.active]="activeTypeFilter === 'company'"
              (click)="setTypeFilter('company')">
              CNPJ / Sócios
            </button>
            <button
              class="filter-chip"
              [class.active]="activeTypeFilter === 'domain'"
              (click)="setTypeFilter('domain')">
              Domínios / Sub
            </button>
            <button
              class="filter-chip"
              [class.active]="activeTypeFilter === 'tracker'"
              (click)="setTypeFilter('tracker')">
              IPs / Portas
            </button>
            <button
              class="filter-chip"
              [class.active]="activeTypeFilter === 'breach'"
              (click)="setTypeFilter('breach')">
              CVEs / Leaks
            </button>
            <button
              class="filter-chip"
              [class.active]="activeTypeFilter === 'mention'"
              (click)="setTypeFilter('mention')">
              Menções
            </button>
          </div>

          <!-- Ações de Zoom, Adição Manual e Exportação Open-Source -->
          <div class="action-buttons">
            <button
              class="btn-action"
              (click)="showAddNodeForm = !showAddNodeForm"
              title="Adicionar Nó ou Evidência Manual ao Grafo">
              <app-icon name="plus" [size]="14"></app-icon>
              <span>+ Nó Manual</span>
            </button>
            <button class="btn-icon" (click)="zoomIn()" title="Aproximar Zoom" aria-label="Aproximar Zoom">
              <app-icon name="plus" [size]="14"></app-icon>
            </button>
            <button class="btn-icon" (click)="zoomOut()" title="Afastar Zoom" aria-label="Afastar Zoom">
              <app-icon name="minus" [size]="14"></app-icon>
            </button>
            <button class="btn-icon" (click)="resetView()" title="Centralizar Visualização" aria-label="Centralizar Visualização">
              <app-icon name="refresh-cw" [size]="14"></app-icon>
            </button>
            <button class="btn-action" (click)="exportGraphMl()" title="Exportar GraphML (Compatível com Gephi, Cytoscape e Maltego)">
              <app-icon name="share-2" [size]="14"></app-icon>
              <span>GraphML</span>
            </button>
            <button class="btn-action" (click)="exportPng()" title="Exportar Imagem PNG">
              <app-icon name="download" [size]="14"></app-icon>
              <span>PNG</span>
            </button>
            <button class="btn-action" (click)="exportJson()" title="Exportar Dados JSON">
              <app-icon name="file-text" [size]="14"></app-icon>
              <span>JSON</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Barra Inline para Adicionar Nó Manual / Evidência Forense -->
      <div class="add-node-bar" *ngIf="showAddNodeForm">
        <span class="add-node-label">
          Vincular a: <strong>{{ selectedNode ? selectedNode.label : (graphData?.target || 'Alvo Central') }}</strong>
        </span>
        <select class="add-node-select" [(ngModel)]="customNodeType" aria-label="Tipo do novo nó">
          <option value="person">Pessoa / Sócio</option>
          <option value="company">Empresa / CNPJ</option>
          <option value="email">E-mail</option>
          <option value="domain">Domínio / Host</option>
          <option value="social_account">Conta Social / Telefone</option>
          <option value="breach">Evidência / Alerta</option>
        </select>
        <input
          type="text"
          class="add-node-input"
          [(ngModel)]="customNodeLabel"
          placeholder="Ex: Sócio Oculto, +55 11 98888-7777, servidor.interno.br..."
          aria-label="Rótulo do novo nó"
        />
        <input
          type="text"
          class="add-node-input rel-input"
          [(ngModel)]="customNodeRelation"
          placeholder="Relação (ex: socio_oculto, vinculado_a)"
          aria-label="Tipo de vínculo"
        />
        <button type="button" class="btn-add-confirm" (click)="addCustomNode()">Inserir no Grafo</button>
        <button type="button" class="btn-add-cancel" (click)="showAddNodeForm = false">Cancelar</button>
      </div>

      <!-- Canvas Container -->
      <div class="canvas-viewport" #containerRef>
        <canvas
          #canvasRef
          (mousedown)="onMouseDown($event)"
          (mousemove)="onMouseMove($event)"
          (mouseup)="onMouseUp()"
          (mouseleave)="onMouseUp()"
          (dblclick)="onDoubleClick($event)"
          (wheel)="onWheel($event)">
        </canvas>

        <!-- Tooltip Interativo -->
        <div
          *ngIf="hoveredNode && !selectedNode"
          class="graph-tooltip"
          [style.left.px]="tooltipX"
          [style.top.px]="tooltipY">
          <div class="tooltip-header">
            <span class="tooltip-type">{{ hoveredNode.type }}</span>
            <span class="tooltip-category" *ngIf="hoveredNode.category">{{ hoveredNode.category }}</span>
          </div>
          <div class="tooltip-title">{{ hoveredNode.label }}</div>
          <div class="tooltip-degree">Conexões: {{ hoveredNode.degree }} • Clique para inspecionar / Duplo-clique para expandir</div>
          <div class="tooltip-url" *ngIf="hoveredNode.metadata?.['url']">
            {{ hoveredNode.metadata?.['url'] }}
          </div>
        </div>

        <!-- Inspetor Maltego de Nó Selecionado (Run Transform / Pivot) -->
        <div class="node-inspector-card" *ngIf="selectedNode">
          <div class="inspector-header">
            <div class="inspector-badges">
              <span class="tooltip-type">{{ selectedNode.type }}</span>
              <span class="tooltip-category" *ngIf="selectedNode.category">{{ selectedNode.category }}</span>
              <span class="bridge-badge" *ngIf="selectedNode.bridge">⚡ NÓ PONTE</span>
            </div>
            <button class="inspector-close" (click)="selectedNode = null" aria-label="Fechar inspetor de nó">✕</button>
          </div>
          <div class="inspector-title">{{ selectedNode.label }}</div>
          <div class="inspector-meta">
            <span>Grau de Centralidade: <strong>{{ selectedNode.degree }} conexões</strong></span>
            <span *ngIf="selectedNode.metadata?.['indicator']">• {{ selectedNode.metadata?.['indicator'] }}</span>
            <span *ngIf="selectedNode.metadata?.['qualificacao']">• Cargo: {{ selectedNode.metadata?.['qualificacao'] }}</span>
            <span *ngIf="selectedNode.metadata?.['documento']">• Doc: {{ selectedNode.metadata?.['documento'] }}</span>
          </div>
          <div class="inspector-actions">
            <button
              type="button"
              class="btn-pivot-expand"
              (click)="triggerNodePivot(selectedNode, true)"
              title="Roda Transforms neste nó e adiciona novas conexões ao grafo atual">
              <app-icon name="zap" [size]="13"></app-icon>
              <span>Expandir Nó (Run Transform)</span>
            </button>
            <button
              type="button"
              class="btn-pivot-focus"
              (click)="triggerNodePivot(selectedNode, false)"
              title="Inicia nova investigação tendo este nó como alvo central">
              <app-icon name="search" [size]="13"></app-icon>
              <span>Nova Busca neste Alvo</span>
            </button>
            <a
              *ngIf="selectedNode.metadata?.['url']"
              [href]="selectedNode.metadata?.['url']"
              target="_blank"
              rel="noopener noreferrer"
              class="btn-pivot-link">
              <span>Abrir URL ↗</span>
            </a>
          </div>
        </div>

        <!-- Legenda -->
        <div class="graph-legend">
          <span class="legend-item"><span class="dot dot-target"></span> Alvo</span>
          <span class="legend-item"><span class="dot dot-company"></span> Empresa / Sócio</span>
          <span class="legend-item"><span class="dot dot-social"></span> Conta / Canal</span>
          <span class="legend-item"><span class="dot dot-domain"></span> Domínio / Sede</span>
          <span class="legend-item"><span class="dot dot-tracker"></span> IP / Porta / Hash</span>
          <span class="legend-item"><span class="dot dot-breach"></span> CVE / Vazamento</span>
          <span class="legend-item"><span class="dot dot-bridge"></span> Nó Ponte</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .graph-wrapper {
      display: flex;
      flex-direction: column;
      background: #0f172a;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      overflow: hidden;
      margin-top: 1rem;
    }

    .graph-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      background: rgba(30, 41, 59, 0.6);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .toolbar-left, .toolbar-right {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .graph-pill {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.8rem;
      font-weight: 600;
      color: #94a3b8;
    }

    .stat-pill {
      font-size: 0.75rem;
      background: rgba(255, 255, 255, 0.05);
      padding: 0.2rem 0.5rem;
      border-radius: 999px;
      color: #64748b;
    }

    .filter-group {
      display: flex;
      gap: 0.3rem;
      background: rgba(15, 23, 42, 0.6);
      padding: 0.2rem;
      border-radius: 8px;
    }

    .filter-chip {
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 0.72rem;
      padding: 0.25rem 0.55rem;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .filter-chip:hover {
      color: #fff;
    }

    .filter-chip.active {
      background: #3b82f6;
      color: #fff;
      font-weight: 600;
    }

    .action-buttons {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }

    .btn-icon {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #cbd5e1;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background 0.2s;
    }

    .btn-icon:hover {
      background: rgba(255, 255, 255, 0.12);
      color: #fff;
    }

    .btn-action {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #cbd5e1;
      font-size: 0.75rem;
      padding: 0.25rem 0.6rem;
      border-radius: 6px;
      display: flex;
      align-items: center;
      gap: 0.3rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-action:hover {
      background: rgba(59, 130, 246, 0.2);
      border-color: #3b82f6;
      color: #60a5fa;
    }

    .canvas-viewport {
      position: relative;
      width: 100%;
      height: 520px;
      background: radial-gradient(circle at center, #1e293b 0%, #0f172a 100%);
      overflow: hidden;
      cursor: grab;
    }

    .canvas-viewport:active {
      cursor: grabbing;
    }

    canvas {
      display: block;
      width: 100%;
      height: 100%;
    }

    .graph-tooltip {
      position: absolute;
      pointer-events: none;
      background: rgba(15, 23, 42, 0.95);
      border: 1px solid rgba(59, 130, 246, 0.4);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(8px);
      border-radius: 8px;
      padding: 0.6rem 0.8rem;
      max-width: 260px;
      z-index: 10;
      transform: translate(12px, 12px);
    }

    .tooltip-header {
      display: flex;
      gap: 0.4rem;
      margin-bottom: 0.2rem;
    }

    .tooltip-type {
      font-size: 0.65rem;
      text-transform: uppercase;
      font-weight: 700;
      color: #38bdf8;
      letter-spacing: 0.05em;
    }

    .tooltip-category {
      font-size: 0.65rem;
      background: rgba(255, 255, 255, 0.1);
      padding: 0.05rem 0.35rem;
      border-radius: 4px;
      color: #94a3b8;
    }

    .tooltip-title {
      font-size: 0.82rem;
      font-weight: 600;
      color: #fff;
      word-break: break-all;
    }

    .tooltip-degree {
      font-size: 0.7rem;
      color: #64748b;
      margin-top: 0.2rem;
    }

    .tooltip-url {
      font-size: 0.68rem;
      color: #60a5fa;
      margin-top: 0.2rem;
      word-break: break-all;
    }

    .graph-legend {
      position: absolute;
      bottom: 12px;
      left: 12px;
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(6px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 0.4rem 0.75rem;
      display: flex;
      gap: 0.8rem;
      font-size: 0.7rem;
      color: #94a3b8;
      pointer-events: none;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .dot-target { background: #ec4899; box-shadow: 0 0 6px #ec4899; }
    .dot-company { background: #a855f7; }
    .dot-social { background: #3b82f6; }
    .dot-domain { background: #10b981; }
    .dot-tracker { background: #f59e0b; }
    .dot-breach { background: #ef4444; box-shadow: 0 0 6px #ef4444; }
    .dot-bridge { background: transparent; border: 2px solid #fbbf24; }
    .dot-mention { background: #64748b; }

    .bridge-pill {
      font-size: 0.72rem;
      font-weight: 700;
      background: rgba(251, 191, 36, 0.16);
      border: 1px solid rgba(251, 191, 36, 0.45);
      color: #fde68a;
      padding: 0.18rem 0.55rem;
      border-radius: 999px;
    }

    .bridge-badge {
      font-size: 0.62rem;
      font-weight: 800;
      background: rgba(251, 191, 36, 0.2);
      border: 1px solid #fbbf24;
      color: #fde68a;
      padding: 0.05rem 0.38rem;
      border-radius: 4px;
    }

    .add-node-bar {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
      padding: 0.6rem 1rem;
      background: rgba(15, 23, 42, 0.92);
      border-bottom: 1px solid rgba(99, 102, 241, 0.35);
      font-size: 0.76rem;
      color: #cbd5e1;
    }

    .add-node-select, .add-node-input {
      background: rgba(30, 41, 59, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #ffffff;
      border-radius: 6px;
      padding: 0.32rem 0.55rem;
      font-size: 0.76rem;
    }

    .add-node-input {
      min-width: 210px;
      flex: 1;
    }
    .add-node-input.rel-input {
      min-width: 140px;
      flex: 0.6;
    }

    .btn-add-confirm {
      background: #4f46e5;
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 0.35rem 0.75rem;
      font-size: 0.75rem;
      font-weight: 700;
      cursor: pointer;
    }

    .btn-add-cancel {
      background: transparent;
      color: #94a3b8;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 6px;
      padding: 0.35rem 0.65rem;
      font-size: 0.75rem;
      cursor: pointer;
    }

    .node-inspector-card {
      position: absolute;
      top: 14px;
      right: 14px;
      width: 310px;
      background: rgba(15, 23, 42, 0.96);
      border: 1px solid rgba(59, 130, 246, 0.5);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(12px);
      border-radius: 12px;
      padding: 0.9rem 1rem;
      z-index: 15;
    }

    .inspector-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.4rem;
    }

    .inspector-badges {
      display: flex;
      gap: 0.4rem;
      align-items: center;
    }

    .inspector-close {
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      font-size: 0.85rem;
      padding: 0.15rem 0.35rem;
      border-radius: 4px;
    }
    .inspector-close:hover {
      color: #fff;
      background: rgba(255, 255, 255, 0.1);
    }

    .inspector-title {
      font-size: 0.95rem;
      font-weight: 700;
      color: #ffffff;
      word-break: break-all;
      margin-bottom: 0.3rem;
    }

    .inspector-meta {
      font-size: 0.75rem;
      color: #94a3b8;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      margin-bottom: 0.75rem;
    }

    .inspector-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }

    .btn-pivot-expand {
      flex: 1 1 100%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      background: linear-gradient(135deg, #6366f1 0%, #ec4899 100%);
      color: #fff;
      border: none;
      border-radius: 7px;
      padding: 0.48rem 0.75rem;
      font-size: 0.76rem;
      font-weight: 700;
      cursor: pointer;
      transition: filter 0.15s;
    }
    .btn-pivot-expand:hover {
      filter: brightness(1.12);
    }

    .btn-pivot-focus {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      background: rgba(59, 130, 246, 0.18);
      border: 1px solid rgba(59, 130, 246, 0.4);
      color: #93c5fd;
      border-radius: 7px;
      padding: 0.4rem 0.6rem;
      font-size: 0.73rem;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-pivot-focus:hover {
      background: rgba(59, 130, 246, 0.3);
      color: #fff;
    }

    .btn-pivot-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #cbd5e1;
      border-radius: 7px;
      padding: 0.4rem 0.6rem;
      font-size: 0.73rem;
      text-decoration: none;
    }
    .btn-pivot-link:hover {
      color: #fff;
      background: rgba(255, 255, 255, 0.12);
    }
  `]
})
export class EntityGraphComponent implements OnInit, OnChanges, OnDestroy {
  @Input() graphData: EntityGraphData | null = null;
  @Output() nodePivot = new EventEmitter<{ query: string; expand: boolean; node: GraphNode }>();
  @Output() graphModified = new EventEmitter<EntityGraphData>();

  @ViewChild('canvasRef', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('containerRef', { static: true }) containerRef!: ElementRef<HTMLDivElement>;

  private ctx!: CanvasRenderingContext2D;
  private animationFrameId: number | null = null;

  // Nós e arestas simulados
  private nodes: GraphNode[] = [];
  private edges: GraphEdge[] = [];

  // Transformações do Canvas (Zoom e Pan)
  private zoom = 1.0;
  private panX = 0;
  private panY = 0;

  // Interação do Mouse
  private isDraggingCanvas = false;
  private draggedNode: GraphNode | null = null;
  private startMouseX = 0;
  private startMouseY = 0;

  hoveredNode: GraphNode | null = null;
  selectedNode: GraphNode | null = null;
  tooltipX = 0;
  tooltipY = 0;

  activeTypeFilter: string = 'all';
  showAddNodeForm = false;
  customNodeLabel = '';
  customNodeType: GraphNode['type'] = 'person';
  customNodeRelation = 'vinculo_manual';

  get bridgeNodesCount(): number {
    return this.nodes.filter(n => n.bridge || (n.degree >= 2 && n.type !== 'target')).length;
  }

  ngOnInit(): void {
    this.initCanvas();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['graphData'] && this.graphData) {
      this.loadGraphData();
    }
  }

  ngOnDestroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  private initCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  private resizeCanvas(): void {
    const container = this.containerRef.nativeElement;
    const canvas = this.canvasRef.nativeElement;
    const width = container.clientWidth || 800;
    const height = 520;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    this.ctx.scale(dpr, dpr);
    this.render();
  }

  private loadGraphData(): void {
    if (!this.graphData) return;

    const width = this.containerRef.nativeElement.clientWidth || 800;
    const height = 520;
    const centerX = width / 2;
    const centerY = height / 2;

    // Inicializa posições dos nós
    this.nodes = this.graphData.nodes.map((node, i) => {
      const isTarget = node.type === 'target';
      const angle = (i / this.graphData!.nodes.length) * 2 * Math.PI;
      const radius = isTarget ? 0 : 120 + Math.random() * 80;

      return {
        ...node,
        x: isTarget ? centerX : centerX + Math.cos(angle) * radius,
        y: isTarget ? centerY : centerY + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
      };
    });

    this.edges = [...this.graphData.edges];
    this.resetView();
    this.startSimulation();
  }

  private startSimulation(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    let iterations = 0;
    const step = () => {
      this.updatePhysics();
      this.render();

      iterations++;
      // Executa simulação suave por ~180 frames ou enquanto o usuário arrasta
      if (iterations < 240 || this.draggedNode) {
        this.animationFrameId = requestAnimationFrame(step);
      }
    };
    this.animationFrameId = requestAnimationFrame(step);
  }

  private updatePhysics(): void {
    const width = this.containerRef.nativeElement.clientWidth || 800;
    const height = 520;
    const centerX = width / 2;
    const centerY = height / 2;

    // 1. Repulsão entre nós
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const na = this.nodes[i];
        const nb = this.nodes[j];
        const dx = (nb.x || 0) - (na.x || 0);
        const dy = (nb.y || 0) - (na.y || 0);
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        if (dist < 220) {
          const force = (220 - dist) / dist * 0.4;
          if (na !== this.draggedNode && na.type !== 'target') {
            na.vx = (na.vx || 0) - dx * force * 0.05;
            na.vy = (na.vy || 0) - dy * force * 0.05;
          }
          if (nb !== this.draggedNode && nb.type !== 'target') {
            nb.vx = (nb.vx || 0) + dx * force * 0.05;
            nb.vy = (nb.vy || 0) + dy * force * 0.05;
          }
        }
      }
    }

    // 2. Atração pelas arestas
    const nodeMap = new Map<string, GraphNode>();
    this.nodes.forEach(n => nodeMap.set(n.id, n));

    for (const edge of this.edges) {
      const src = nodeMap.get(edge.source);
      const tgt = nodeMap.get(edge.target);
      if (!src || !tgt) continue;

      const dx = (tgt.x || 0) - (src.x || 0);
      const dy = (tgt.y || 0) - (src.y || 0);
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const targetDist = 120;
      const force = (dist - targetDist) * 0.008;

      if (src !== this.draggedNode && src.type !== 'target') {
        src.vx = (src.vx || 0) + dx * force;
        src.vy = (src.vy || 0) + dy * force;
      }
      if (tgt !== this.draggedNode && tgt.type !== 'target') {
        tgt.vx = (tgt.vx || 0) - dx * force;
        tgt.vy = (tgt.vy || 0) - dy * force;
      }
    }

    // 3. Força centralizadora e amortecimento (damping)
    for (const node of this.nodes) {
      if (node === this.draggedNode) continue;
      if (node.type === 'target') {
        node.x = centerX;
        node.y = centerY;
        continue;
      }

      const dx = centerX - (node.x || centerX);
      const dy = centerY - (node.y || centerY);
      node.vx = ((node.vx || 0) + dx * 0.001) * 0.85;
      node.vy = ((node.vy || 0) + dy * 0.001) * 0.85;

      node.x = (node.x || 0) + (node.vx || 0);
      node.y = (node.y || 0) + (node.vy || 0);
    }
  }

  private render(): void {
    if (!this.ctx) return;
    const width = this.containerRef.nativeElement.clientWidth || 800;
    const height = 520;

    this.ctx.clearRect(0, 0, width, height);
    this.ctx.save();

    // Aplica Pan e Zoom
    this.ctx.translate(this.panX, this.panY);
    this.ctx.scale(this.zoom, this.zoom);

    const nodeMap = new Map<string, GraphNode>();
    this.nodes.forEach(n => nodeMap.set(n.id, n));

    // 1. Desenha as Arestas (Linhas com gradiente)
    for (const edge of this.edges) {
      const src = nodeMap.get(edge.source);
      const tgt = nodeMap.get(edge.target);
      if (!src || !tgt) continue;

      if (this.shouldFilterNode(src) || this.shouldFilterNode(tgt)) continue;

      this.ctx.beginPath();
      this.ctx.moveTo(src.x || 0, src.y || 0);
      this.ctx.lineTo(tgt.x || 0, tgt.y || 0);
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      this.ctx.lineWidth = 1.2;
      this.ctx.stroke();
    }

    // 2. Desenha os Nós
    for (const node of this.nodes) {
      if (this.shouldFilterNode(node)) continue;

      const isTarget = node.type === 'target';
      const isHovered = this.hoveredNode === node;
      const isBridge = Boolean(node.bridge || (node.degree >= 2 && !isTarget));
      const radius = isTarget ? 18 : Math.max(9, Math.min(15, 8 + (node.degree || 1) * 2));

      const nx = node.x || 0;
      const ny = node.y || 0;

      // Brilho exterior (Glow) + Anel Dourado de Nó Ponte
      if (isTarget || isHovered || isBridge) {
        this.ctx.beginPath();
        this.ctx.arc(nx, ny, radius + 6, 0, Math.PI * 2);
        this.ctx.fillStyle = isTarget
          ? 'rgba(236, 72, 153, 0.25)'
          : isBridge
            ? 'rgba(251, 191, 36, 0.22)'
            : 'rgba(59, 130, 246, 0.35)';
        this.ctx.fill();

        if (isBridge) {
          this.ctx.beginPath();
          this.ctx.arc(nx, ny, radius + 4, 0, Math.PI * 2);
          this.ctx.lineWidth = 1.8;
          this.ctx.strokeStyle = '#fbbf24';
          this.ctx.stroke();
        }
      }

      // Corpo do Nó
      this.ctx.beginPath();
      this.ctx.arc(nx, ny, radius, 0, Math.PI * 2);
      this.ctx.fillStyle = this.getNodeColor(node);
      this.ctx.fill();
      this.ctx.lineWidth = 2;
      this.ctx.strokeStyle = isHovered ? '#ffffff' : 'rgba(255, 255, 255, 0.2)';
      this.ctx.stroke();

      // Rótulo do Nó
      this.ctx.fillStyle = isHovered ? '#ffffff' : 'rgba(255, 255, 255, 0.85)';
      this.ctx.font = isTarget ? 'bold 12px Inter, sans-serif' : '10px Inter, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(node.label.length > 24 ? node.label.slice(0, 22) + '...' : node.label, nx, ny + radius + 14);
    }

    this.ctx.restore();
  }

  private getNodeColor(node: GraphNode): string {
    switch (node.type) {
      case 'target':
        return '#ec4899'; // Rosa neon / magenta
      case 'company':
      case 'person':
        return '#a855f7'; // Violeta (CNPJ / Sócio QSA)
      case 'social_account':
      case 'social_link':
        return '#3b82f6'; // Azul primário
      case 'domain':
        return '#10b981'; // Verde esmeralda
      case 'tracker':
      case 'email':
        return '#f59e0b'; // Âmbar
      case 'breach':
        return '#ef4444'; // Vermelho Alerta (CVE / Infostealer / Breach)
      case 'mention':
        return '#64748b'; // Cinza ardósia
      default:
        return '#8b5cf6'; // Roxo
    }
  }

  private shouldFilterNode(node: GraphNode): boolean {
    if (this.activeTypeFilter === 'all' || node.type === 'target') return false;
    if (this.activeTypeFilter === 'social_account' && (node.type === 'social_account' || node.type === 'social_link')) return false;
    if (this.activeTypeFilter === 'company' && (node.type === 'company' || node.type === 'person')) return false;
    if (this.activeTypeFilter === 'tracker' && (node.type === 'tracker' || node.type === 'email')) return false;
    return node.type !== this.activeTypeFilter;
  }

  // ==========================================
  // Interações de Mouse e Eventos de Canvas
  // ==========================================

  onMouseDown(e: MouseEvent): void {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - this.panX) / this.zoom;
    const mouseY = (e.clientY - rect.top - this.panY) / this.zoom;

    // Detecta se clicou em um nó
    const clicked = this.nodes.find(n => {
      const dx = (n.x || 0) - mouseX;
      const dy = (n.y || 0) - mouseY;
      return Math.sqrt(dx * dx + dy * dy) < 20;
    });

    if (clicked) {
      this.selectedNode = clicked;
      this.draggedNode = clicked;
      this.startSimulation();
    } else {
      this.selectedNode = null;
      this.isDraggingCanvas = true;
      this.startMouseX = e.clientX - this.panX;
      this.startMouseY = e.clientY - this.panY;
    }
  }

  onDoubleClick(e: MouseEvent): void {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - this.panX) / this.zoom;
    const mouseY = (e.clientY - rect.top - this.panY) / this.zoom;

    const clicked = this.nodes.find(n => {
      const dx = (n.x || 0) - mouseX;
      const dy = (n.y || 0) - mouseY;
      return Math.sqrt(dx * dx + dy * dy) < 22;
    });

    if (clicked) {
      this.triggerNodePivot(clicked, true);
    }
  }

  triggerNodePivot(node: GraphNode, expand: boolean): void {
    const pivotQuery =
      node.metadata?.['pivot_query'] ||
      node.metadata?.['domain'] ||
      node.metadata?.['email'] ||
      node.metadata?.['url'] ||
      node.label.replace(/^@\S+\s+\((.+)\)$/, '$1').replace(/^\[.*?\]\s*/, '');
    if (pivotQuery) {
      this.nodePivot.emit({ query: String(pivotQuery), expand, node });
    }
  }

  onMouseMove(e: MouseEvent): void {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - this.panX) / this.zoom;
    const mouseY = (e.clientY - rect.top - this.panY) / this.zoom;

    if (this.draggedNode) {
      this.draggedNode.x = mouseX;
      this.draggedNode.y = mouseY;
      this.render();
      return;
    }

    if (this.isDraggingCanvas) {
      this.panX = e.clientX - this.startMouseX;
      this.panY = e.clientY - this.startMouseY;
      this.render();
      return;
    }

    // Hover detection
    const hovered = this.nodes.find(n => {
      const dx = (n.x || 0) - mouseX;
      const dy = (n.y || 0) - mouseY;
      return Math.sqrt(dx * dx + dy * dy) < 18;
    });

    this.hoveredNode = hovered || null;
    if (this.hoveredNode) {
      this.tooltipX = e.clientX - rect.left;
      this.tooltipY = e.clientY - rect.top;
    }
    this.render();
  }

  onMouseUp(): void {
    this.isDraggingCanvas = false;
    this.draggedNode = null;
  }

  onWheel(e: WheelEvent): void {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    this.zoom = Math.max(0.3, Math.min(3.0, this.zoom * zoomFactor));
    this.render();
  }

  zoomIn(): void {
    this.zoom = Math.min(3.0, this.zoom * 1.2);
    this.render();
  }

  zoomOut(): void {
    this.zoom = Math.max(0.3, this.zoom * 0.8);
    this.render();
  }

  resetView(): void {
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.render();
  }

  setTypeFilter(type: string): void {
    this.activeTypeFilter = type;
    this.render();
  }

  addCustomNode(): void {
    const label = this.customNodeLabel.trim();
    if (!label || !this.graphData) return;

    const anchorNode = this.selectedNode || this.nodes[0];
    if (!anchorNode) return;

    const newId = `manual_${Date.now()}`;
    const newNode: GraphNode = {
      id: newId,
      label,
      type: this.customNodeType,
      category: 'manual_evidence',
      degree: 1,
      metadata: {
        pivot_query: label,
        indicator: 'Evidência manual adicionada pelo analista',
      },
      x: (anchorNode.x || 400) + (Math.random() - 0.5) * 140,
      y: (anchorNode.y || 260) + (Math.random() - 0.5) * 140,
      vx: 0,
      vy: 0,
    };

    const newEdge: GraphEdge = {
      source: anchorNode.id,
      target: newId,
      relationship: this.customNodeRelation.trim() || 'vinculo_manual',
      weight: 1.5,
    };

    anchorNode.degree = (anchorNode.degree || 1) + 1;
    if (anchorNode.degree >= 2 && anchorNode.type !== 'target') {
      anchorNode.bridge = true;
    }

    this.nodes.push(newNode);
    this.edges.push(newEdge);
    this.graphData.nodes = [...this.nodes];
    this.graphData.edges = [...this.edges];
    this.graphData.total_nodes = this.nodes.length;
    this.graphData.total_edges = this.edges.length;

    this.customNodeLabel = '';
    this.showAddNodeForm = false;
    this.startSimulation();
    this.graphModified.emit(this.graphData);
  }

  exportGraphMl(): void {
    if (!this.graphData) return;
    const esc = (s: any) =>
      String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const lines: string[] = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<graphml xmlns="http://graphml.graphdrawing.org/xmlns">',
      '  <key id="label" for="node" attr.name="label" attr.type="string"/>',
      '  <key id="type" for="node" attr.name="type" attr.type="string"/>',
      '  <key id="category" for="node" attr.name="category" attr.type="string"/>',
      '  <key id="degree" for="node" attr.name="degree" attr.type="int"/>',
      '  <key id="bridge" for="node" attr.name="bridge" attr.type="boolean"/>',
      '  <key id="relationship" for="edge" attr.name="relationship" attr.type="string"/>',
      '  <key id="weight" for="edge" attr.name="weight" attr.type="double"/>',
      '  <graph id="ArgosOsintGraph" edgedefault="directed">',
    ];

    for (const n of this.graphData.nodes) {
      lines.push(`    <node id="${esc(n.id)}">`);
      lines.push(`      <data key="label">${esc(n.label)}</data>`);
      lines.push(`      <data key="type">${esc(n.type)}</data>`);
      lines.push(`      <data key="category">${esc(n.category)}</data>`);
      lines.push(`      <data key="degree">${n.degree || 0}</data>`);
      lines.push(`      <data key="bridge">${Boolean(n.bridge)}</data>`);
      lines.push('    </node>');
    }

    this.graphData.edges.forEach((e, idx) => {
      lines.push(`    <edge id="e${idx}" source="${esc(e.source)}" target="${esc(e.target)}">`);
      lines.push(`      <data key="relationship">${esc(e.relationship)}</data>`);
      lines.push(`      <data key="weight">${e.weight || 1.0}</data>`);
      lines.push('    </edge>');
    });

    lines.push('  </graph>');
    lines.push('</graphml>');

    const blob = new Blob([lines.join('\n')], { type: 'application/graphml+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `argos_grafo_${this.graphData.target || 'osint'}.graphml`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }

  exportPng(): void {
    const canvas = this.canvasRef.nativeElement;
    const link = document.createElement('a');
    link.download = `argos_grafo_${this.graphData?.target || 'analise'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  exportJson(): void {
    if (!this.graphData) return;
    const blob = new Blob([JSON.stringify(this.graphData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `argos_grafo_${this.graphData.target}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }
}
