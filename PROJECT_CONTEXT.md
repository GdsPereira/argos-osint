# 📖 PROJECT_CONTEXT.md - Argos & Social Listening Transmídia

> **Documento de Contexto Vivo e Onboarding Rápido.**
> Use este arquivo como mapa mental e base técnica para entender instantaneamente o funcionamento do projeto e implementar novas funcionalidades com máxima produtividade e zero atrito.

---

## 1. 🎯 Visão Geral do Produto

O **Argos** é uma plataforma analítica e de inteligência OSINT / Social Listening de alto desempenho:
- **Backend:** FastAPI (Python 3.12 assíncrono), AnyIO, Pydantic v2, PostgreSQL (com fallback automático para SQLite) e orquestração de jobs em background.
- **Frontend:** Angular 19 (Standalone Components, Signals, RxJS, Chart.js 4, Dark Theme responsivo com visual gradiente moderno).
- **Motores de Coleta:**
  1. **Instagram Profundo:** Apify Actors (Multi-Actor paralelo para perfil, posts, comentários e stories), Meta Graph API Oficial (métricas privadas de 30 dias e Discovery de concorrentes) e Instaloader.
  2. **Social Listening Transmídia:** YouTube (scrapetube ultrarrápido sem cota de API), Reddit (JSON endpoints sem autenticação), TikTok & Threads (impersonação de TLS Chrome via `curl_cffi` para contornar proteções Cloudflare), Twitter/X e Instagram agregados.
- **Camada de Inteligência Artificial:** Diagnóstico com Health Score (0-100), matriz SWOT, análise profunda de copy e formatos, roteiros de ganchos de 3s e CTAs para Reels/TikTok/Shorts, e Consultor Conversacional Interativo. Suporte a Google Gemini (recomendado), OpenRouter, Groq e Ollama.

---

## 2. 📁 Mapa de Estrutura do Código

```
Insta_poc/
├── .env                       # Variáveis de ambiente locais (tokens, chaves de IA, banco)
├── .env.example               # Template de variáveis
├── docker-compose.yml         # Orquestração do Backend + Frontend + PostgreSQL
├── README.md                  # Documentação de introdução e guia rápido
├── AGENTS.md                  # Definição dos agentes e regras de atuação
├── PROJECT_CONTEXT.md         # [ESTE ARQUIVO] Contexto técnico detalhado e runbook
│
├── backend/                   # 🐍 MÓDULO BACKEND (FastAPI)
│   ├── main.py                # Entrada principal da API, rotas, CORS e lifespan
│   ├── models.py              # Schemas Pydantic v2 (AnalyzeRequest, Profile, Post, etc.)
│   ├── database.py            # Engine SQLAlchemy assíncrona (Postgres + SQLite fallback)
│   ├── repository.py          # Camada de persistência de análises, relatórios e jobs
│   ├── jobs.py                # Gerenciador de jobs assíncronos com polling e status
│   ├── ai_service.py          # Integração de IA (Gemini, OpenRouter, Groq, Ollama)
│   ├── analytics.py           # Cálculos estatísticos, engajamento, sentimento léxico
│   ├── collector.py           # Coleta legada / instaloader
│   ├── collector_apify.py     # Pipeline assíncrono paralelo com Apify Actors
│   ├── collector_graph.py     # Coleta via Meta Graph API Oficial (insights privados e discovery)
│   ├── init.sql               # Script de inicialização do schema PostgreSQL
│   ├── requirements.txt       # Dependências Python
│   ├── Dockerfile             # Container do backend
│   │
│   ├── collectors/            # 🌐 COLETORES MULTI-REDE (Social Listening)
│   │   ├── base.py            # Classe abstrata BaseCollector e UnifiedPost/UnifiedProfile
│   │   ├── manager.py         # MultiPlatformManager (executa buscas em paralelo com timeouts)
│   │   ├── youtube_collector.py  # Coleta YouTube via scrapetube
│   │   ├── reddit_collector.py   # Coleta Reddit via endpoints públicos JSON
│   │   ├── tiktok_collector.py   # Coleta TikTok com curl_cffi (impersonação TLS)
│   │   ├── threads_collector.py  # Coleta Threads Meta
│   │   ├── twitter_collector.py  # Coleta Twitter/X
│   │   └── instagram_collector.py# Coleta Instagram unificada
│   │
│   └── tests/                 # 🧪 SUÍTE DE TESTES (pytest)
│       ├── conftest.py        # Fixtures compartilhadas
│       ├── test_api.py        # Testes de endpoints FastAPI
│       ├── test_ai.py         # Testes do serviço de inteligência artificial
│       ├── test_collector_apify.py # Testes de parsing e pipeline do Apify
│       ├── test_database.py   # Testes de persistência e fallback de banco
│       └── test_multi_platform.py  # Testes dos coletores multi-rede e managers
│
└── frontend/                  # 🅰️ MÓDULO FRONTEND (Angular 19)
    ├── package.json           # Dependências npm (Angular 19, Chart.js, Lucide icons, etc.)
    ├── proxy.conf.json        # Proxy de desenvolvimento (/api -> localhost:8000)
    ├── Dockerfile             # Multi-stage build com Nginx
    ├── nginx.conf             # Configuração Nginx com proxy reverso e SPA routing
    └── src/
        ├── styles.scss        # Design system dark theme global, variáveis e utilitários
        └── app/
            ├── app.component.ts    # Shell principal e chaveamento de abas
            ├── services/
            │   └── api.service.ts  # Cliente HTTP tipado para todos os endpoints do backend
            ├── models/
            │   ├── instagram.model.ts      # Tipos do Instagram (perfil, post, kpis, comentários)
            │   ├── multi-platform.model.ts # Tipos de busca multi-rede e dashboards transmídia
            │   └── ai.model.ts             # Tipos de diagnóstico e chat de IA
            └── components/
                ├── config-sidebar/ # Barra lateral de parâmetros e seleção de coletores
                ├── profile-header/ # Header de perfil Instagram com avatar gradiente e bio
                ├── kpi-summary/    # Cards com métricas principais (Engajamento, Médias, Pico)
                ├── multi-search/   # Dashboard Transmídia e Social Listening multi-rede
                ├── tab-engagement/ # Gráfico temporal e ranking de melhores posts
                ├── tab-content/    # Distribuição de formatos e correlações de texto
                ├── tab-hashtags/   # Nuvem de hashtags e lista de menções
                ├── tab-timing/     # Gráficos de melhores horários e dias da semana
                ├── tab-comments/   # Sentimento léxico, nuvem de palavras e maiores comentaristas
                ├── tab-audience/   # Seguidores mútuos, unfollows e demografia
                ├── tab-ai/         # Diagnóstico executivo, SWOT, roteiros e Chat Consultor
                └── tab-export/     # Exportação em CSV, JSON e relatórios executivos TXT
```

---

## 3. 🔄 Fluxos de Dados e Arquitetura

### 3.1. Análise de Perfil Instagram (Fluxo Assíncrono com Polling)
1. O usuário preenche o nome de usuário ou cola a URL do perfil na `config-sidebar`.
2. A requisição vai para `POST /api/analyze/async`.
3. O `JobManager` em `backend/jobs.py` gera um `job_id`, agenda a execução em segundo plano com `asyncio.create_task` e retorna o ID imediatamente com status `queued`.
4. O frontend faz polling a cada 1.5s em `GET /api/jobs/{job_id}`.
5. A tarefa executa o coletor selecionado (`collector_apify.py`, `collector_graph.py` ou `collector.py`):
   - Extrai perfil, posts, métricas brutas e, opcionalmente, comentários e stories.
6. O pipeline processa os dados em `analytics.py` (calculando taxas, médias, sentimentos, melhores horários).
7. O resultado é persistido no banco (`database.py` / `repository.py`) e armazenado em cache no job.
8. Ao atingir o status `completed`, o frontend recebe o payload completo `AnalysisResult` e renderiza os componentes e gráficos Chart.js.

### 3.2. Social Listening Multi-Rede (Transmídia)
1. O usuário seleciona o modo de busca em `multi-search`:
   - **Palavra-chave / Tendência:** Monitoramento de termos em múltiplos canais simultaneamente.
   - **Perfil / Criador:** Busca cruzada de canais e perfis do mesmo criador em diferentes redes.
2. Requisição para `POST /api/multi-search`.
3. O `MultiPlatformManager` dispara as buscas concorrentes em paralelo para cada plataforma ativa (`Instagram`, `YouTube`, `Reddit`, `TikTok`, `Threads`, `Twitter`) com `asyncio.gather(return_exceptions=True)`.
4. Cada coletor tem seu próprio timeout estrito (15s por padrão) e isolamento contra exceções.
5. Os dados são normalizados para `UnifiedPost` e consolidados em `MultiPlatformSearchRun`:
   - Agrega métricas totais (Total de Posts, Views Acumuladas, Curtidas e Comentários).
   - Calcula métricas individuais por plataforma.
6. A rota opcional `POST /api/multi-search/{run_id}/ai-audit` submete o resumo transmídia ao `ai_service.py` para gerar o **Omnichannel Score 360°**, matriz de ressonância entre redes e roteiros de adaptação de formato.

---

## 4. 🧠 Camada de Inteligência Artificial (`ai_service.py`)

A aplicação suporta múltiplos provedores de LLM configuráveis via `.env`:
- **`gemini` (Padrão e Recomendado):** Utiliza Google Gemini (`gemini-2.5-flash` ou configurado), resposta em milissegundos e sem custo no tier padrão.
- **`groq`:** Resposta ultrarrápida com modelos LLaMA 3.
- **`openrouter`:** Acesso a Claude 3.5 Sonnet, GPT-4o, DeepSeek, etc.
- **`ollama`:** Execução local totalmente privada e offline.

### Capacidades de IA:
1. **Auditoria & Diagnóstico 360°:** Gera nota de saúde (0-100), matriz SWOT (Forças, Fraquezas, Oportunidades, Ameaças), análise da copy e recomendações táticas.
2. **Roteiros Prontos de Conteúdo:** Gera 5 ideias acionáveis com gancho de retenção nos primeiros 3 segundos, estrutura do corpo e Call To Action (CTA).
3. **Chat Consultor de Marketing:** Chat conversacional que mantém o contexto dos dados do perfil para responder perguntas estratégicas como *"Qual produto vender para essa audiência?"* ou *"Por que meus vídeos caíram de engajamento?"*.

---

## 5. 🗄️ Estratégia de Banco de Dados e Cache Resiliente

- **PostgreSQL:** Usado por padrão quando rodando via Docker (`postgres:16-alpine`), com pooling assíncrono via `asyncpg`.
- **SQLite Fallback:** Se a conexão com o PostgreSQL falhar (por exemplo, durante desenvolvimento local rápido sem Docker), o sistema automaticamente inicializa e utiliza `insta_local.db` via `aiosqlite` sem intervenção manual.
- **Tabelas Principais:**
  - `analyses`: Histórico de análises completas de perfil em JSONB/TEXT.
  - `ai_reports`: Diagnósticos de IA salvos associados ao perfil.
  - `jobs`: Estado e logs das tarefas assíncronas.
  - `multi_search_runs`: Execuções salvas de busca transmídia.

---

## 6. 🚀 Runbook: Como Adicionar Novas Funcionalidades (Cookbooks)

### 📘 Cookbook 1: Adicionar uma Nova Rede Social ao Social Listening
1. Crie o arquivo `backend/collectors/nova_rede_collector.py` herdando de `BaseCollector` (`backend/collectors/base.py`).
2. Implemente os métodos `search_keyword(query, limit)` e `get_creator_profile(handle, limit)`.
3. Converta os itens brutos para o modelo padronizado `UnifiedPost` com plataforma `"nova_rede"`.
4. Em `backend/collectors/manager.py`, registre a nova classe no dicionário de coletores suportados.
5. Crie um teste unitário em `backend/tests/test_multi_platform.py` mockando o retorno do coletor.
6. No frontend, adicione o ícone/badge da nova rede em `frontend/src/app/models/multi-platform.model.ts` e no componente `multi-search`.

### 📘 Cookbook 2: Criar um Novo Endpoint no Backend e Integrar no Frontend
1. Defina os schemas de requisição e resposta em `backend/models.py`.
2. Implemente a rota em `backend/main.py` com documentação tipada.
3. Escreva um teste de integração em `backend/tests/test_api.py`.
4. Adicione o método correspondente no serviço Angular `frontend/src/app/services/api.service.ts`.
5. Consuma no componente desejado utilizando Signals ou RxJS observables.

### 📘 Cookbook 3: Adicionar um Novo Gráfico ou Aba no Frontend
1. Crie o componente standalone em `frontend/src/app/components/minha-nova-aba/`.
2. Importe o componente em `frontend/src/app/app.component.ts`.
3. Registre a nova aba na lista de navegação do `app.component.html`.
4. Utilize `Chart.js` via canvas ou elementos HTML com classes do design system (`styles.scss`).
5. Execute `npm run build` na pasta `frontend` para garantir que a tipagem e compilação passem 100%.

---

## 7. 🧪 Comandos de Qualidade e Testes

Para garantir que nenhuma alteração quebre o sistema:
```bash
# Executar todos os 57+ testes do backend:
.\.venv\Scripts\python -m pytest backend/tests -v

# Validar compilação do frontend:
cd frontend && npm run build
```
