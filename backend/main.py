"""API do Insta Analyzer (FastAPI).

Rodar:  uvicorn main:app --reload --port 8000
"""
from __future__ import annotations

import asyncio
import logging
import os
import sys
import time
from pathlib import Path
from typing import Callable, Literal, Optional

# Configura logging estruturado no console para permitir acompanhamento verbose
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [InstaAnalyzer] %(message)s",
    datefmt="%H:%M:%S",
    stream=sys.stdout,
)
logger = logging.getLogger("insta_analyzer")

backend_dir = str(Path(__file__).resolve().parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from urllib.parse import urlparse
import anyio
import httpx
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from collectors.osint_collector import is_safe_url

def _load_env_files() -> None:
    """Carrega .env da pasta backend e da raiz do projeto com fallback puro."""
    root_dir = Path(__file__).resolve().parent.parent
    backend_dir = Path(__file__).resolve().parent
    env_paths = [backend_dir / ".env", root_dir / ".env"]

    try:
        from dotenv import load_dotenv
        for p in env_paths:
            if p.is_file():
                load_dotenv(p, override=True)
    except ImportError:
        pass

    # Fallback caso alguma variável ainda não esteja no os.environ
    for p in env_paths:
        if p.is_file():
            try:
                for line in p.read_text(encoding="utf-8").splitlines():
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k, v = k.strip(), v.strip().strip("\"'")
                        if k and k not in os.environ:
                            os.environ[k] = v
            except Exception:
                pass

from contextlib import asynccontextmanager

_load_env_files()

import ai_service
import analytics
import collector as co
import collector_apify as ca
import collector_graph as cg
import database
from jobs import JobStatus, job_manager
import repository


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gerencia ciclo de vida da aplicação com inicialização resiliente do banco."""
    logger.info("Inicializando conexão com banco de dados PostgreSQL...")
    await database.init_db()
    yield


app = FastAPI(title="Insta Analyzer API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "http://127.0.0.1:4200"],
    allow_methods=["*"],
    allow_headers=["*"],
)

Source = Literal["apify", "insta", "own", "discovery"]


class AnalyzeRequest(BaseModel):
    source: Source = "apify"
    username: str = ""
    max_posts: int = Field(50, ge=1, le=1000)
    token: str = ""  # Apify / Graph API. Se vazio usa variável de ambiente.
    my_ig_id: str = ""  # Discovery: ID da SUA conta Instagram
    with_comments: bool = False
    comments_per_post: int = Field(50, ge=1, le=500)
    with_insights: bool = True  # Graph API (conta própria)
    login_user: str = ""  # Instaloader
    password: str = ""
    delay: float = Field(1.0, ge=0, le=10)
    with_people: bool = False
    people_limit: int = Field(200, ge=10, le=5000)
    with_stories: bool = False  # Apify: extração de stories complementares
    with_tagged: bool = False  # Apify: extração de posts onde o perfil foi marcado
    with_highlights: bool = False  # Apify: extração de destaques salvos


ENV_TOKEN = {"apify": "APIFY_TOKEN", "own": "IG_TOKEN", "discovery": "FB_TOKEN"}


@app.get("/api/config")
async def config() -> dict:
    """Informa ao front quais credenciais já estão configuradas no servidor e status do banco."""
    db_health = await database.check_db_health()
    return {
        "env": {
            "apify": bool(os.getenv("APIFY_TOKEN")),
            "own": bool(os.getenv("IG_TOKEN")),
            "discovery": bool(os.getenv("FB_TOKEN")),
            "my_ig_id": bool(os.getenv("IG_USER_ID")),
        },
        "apify_config": {
            "actor_main": ca.ACTOR_PROFILE_POSTS,
            "actor_comments": ca.ACTOR_COMMENTS,
            "actor_stories": ca.ACTOR_STORIES,
            "actor_highlights": ca.ACTOR_HIGHLIGHTS,
            "timeout_secs": ca.DEFAULT_PIPELINE_TIMEOUT_SECS,
        },
        "ai_config": ai_service.get_ai_config(),
        "database": db_health,
    }


# Cache simples em memória para imagens de perfis e avatares
_IMAGE_CACHE: dict[str, tuple[float, bytes, str]] = {}
_IMAGE_CACHE_MAX = 500
_IMAGE_CACHE_TTL = 3600 * 6  # 6 horas de retenção


@app.get("/api/proxy-image")
async def proxy_image(url: str):
    """Proxy seguro de imagens para contornar restrições de CORS e Cross-Origin-Resource-Policy
    (CORP: same-origin) de CDNs externas do Instagram (scontent*.cdninstagram.com / *.fbcdn.net).
    """
    if not url:
        raise HTTPException(status_code=400, detail="URL da imagem é obrigatória.")

    clean_url = url.strip()
    if not is_safe_url(clean_url):
        raise HTTPException(status_code=400, detail="URL inválida ou não permitida.")

    # Verifica cache em memória
    now = time.time()
    if clean_url in _IMAGE_CACHE:
        cached_time, data, ctype = _IMAGE_CACHE[clean_url]
        if now - cached_time < _IMAGE_CACHE_TTL:
            return Response(
                content=data,
                media_type=ctype,
                headers={
                    "Cache-Control": "public, max-age=86400",
                    "Access-Control-Allow-Origin": "*",
                },
            )
        else:
            del _IMAGE_CACHE[clean_url]

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(clean_url, headers=headers)
            if resp.status_code != 200:
                logger.warning(
                    f"Falha ao buscar imagem remota no proxy (status {resp.status_code}): {clean_url[:90]}..."
                )
                raise HTTPException(
                    status_code=resp.status_code if resp.status_code in (403, 404) else 502,
                    detail=f"Não foi possível carregar a imagem remota (HTTP {resp.status_code}).",
                )

            ctype = resp.headers.get("content-type", "image/jpeg")
            data = resp.content

            # Salva no cache se tamanho razoável (< 5MB)
            if len(data) < 5 * 1024 * 1024:
                if len(_IMAGE_CACHE) >= _IMAGE_CACHE_MAX:
                    oldest_key = min(_IMAGE_CACHE.keys(), key=lambda k: _IMAGE_CACHE[k][0])
                    _IMAGE_CACHE.pop(oldest_key, None)
                _IMAGE_CACHE[clean_url] = (now, data, ctype)

            return Response(
                content=data,
                media_type=ctype,
                headers={
                    "Cache-Control": "public, max-age=86400",
                    "Access-Control-Allow-Origin": "*",
                },
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Erro ao obter imagem no proxy ({clean_url[:90]}): {exc}")
        raise HTTPException(status_code=502, detail=f"Erro ao carregar imagem: {exc}")


@app.get("/api/proxy-video")
async def proxy_video(request: Request, url: str):
    """Proxy seguro de streaming de vídeos para contornar restrições de CORS e Cross-Origin-Resource-Policy
    (CORP: same-origin) de CDNs externas do Instagram (scontent*.cdninstagram.com / *.fbcdn.net).
    Suporta Range requests (HTTP 206) para scrubbing/seeking fluido no player HTML5.
    """
    if not url:
        raise HTTPException(status_code=400, detail="URL do vídeo é obrigatória.")

    clean_url = url.strip()
    if not is_safe_url(clean_url):
        raise HTTPException(status_code=400, detail="URL inválida ou não permitida.")

    req_headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": "*/*",
        "Accept-Encoding": "identity",
    }

    range_header = request.headers.get("range")
    if range_header:
        req_headers["range"] = range_header

    client = httpx.AsyncClient(timeout=30.0, follow_redirects=True)
    try:
        req = client.build_request("GET", clean_url, headers=req_headers)
        resp = await client.send(req, stream=True)
        if resp.status_code not in (200, 206):
            await resp.aclose()
            await client.aclose()
            raise HTTPException(
                status_code=resp.status_code if resp.status_code in (403, 404) else 502,
                detail=f"Não foi possível carregar o vídeo remoto (HTTP {resp.status_code}).",
            )

        response_headers = {
            "Accept-Ranges": resp.headers.get("accept-ranges", "bytes"),
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Access-Control-Allow-Headers": "Range, Content-Range",
            "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges",
            "Cache-Control": "public, max-age=7200",
        }
        if "content-range" in resp.headers:
            response_headers["Content-Range"] = resp.headers["content-range"]
        if "content-length" in resp.headers:
            response_headers["Content-Length"] = resp.headers["content-length"]

        content_type = resp.headers.get("content-type", "video/mp4")

        async def stream_video():
            try:
                async for chunk in resp.aiter_bytes(chunk_size=65536):
                    yield chunk
            finally:
                await resp.aclose()
                await client.aclose()

        return StreamingResponse(
            stream_video(),
            status_code=resp.status_code,
            media_type=content_type,
            headers=response_headers,
        )
    except HTTPException:
        raise
    except Exception as exc:
        await client.aclose()
        logger.error(f"Erro ao obter vídeo no proxy ({clean_url[:90]}): {exc}")
        raise HTTPException(status_code=502, detail=f"Erro ao transmitir vídeo: {exc}")


_background_tasks: set[asyncio.Task] = set()


def _safe_update_progress(job_id: str, p: str, level: str = "info") -> None:
    logger.info(f"[{job_id}] {p}")
    try:
        loop = asyncio.get_running_loop()
        task = loop.create_task(job_manager.update_status(job_id, JobStatus.RUNNING, p, log_level=level))
        _background_tasks.add(task)
        task.add_done_callback(_background_tasks.discard)
    except RuntimeError:
        pass


async def execute_analysis(
    req: AnalyzeRequest,
    progress_callback: Optional[Callable[[str], None]] = None,
    job_id: Optional[str] = None,
) -> dict:
    """Núcleo de execução da análise para todas as fontes suportadas."""
    username = ca._clean_username(req.username)
    token = req.token.strip() or os.getenv(ENV_TOKEN.get(req.source, ""), "")
    followers: list[dict] = []
    followees: list[dict] = []
    extra: dict = {}

    if req.source in ("apify", "own", "discovery") and not token:
        raise ValueError(f"Informe o token ({ENV_TOKEN[req.source]}).")
    if req.source in ("apify", "insta", "discovery") and not username:
        raise ValueError("Informe o perfil (@usuario).")

    logger.info(
        f"Iniciando coleta para perfil @{username} (fonte={req.source}, max_posts={req.max_posts}, "
        f"comentários={req.with_comments}, stories={req.with_stories}, tagged={req.with_tagged}, highlights={req.with_highlights})"
    )

    if req.source == "apify":
        if progress_callback:
            progress_callback(f"Iniciando pipeline multi-actor Apify para @{username}...")
        info, posts, comments, extra = await ca.run_pipeline_async(
            token=token,
            username=username,
            max_posts=req.max_posts,
            with_comments=req.with_comments,
            comments_per_post=req.comments_per_post,
            with_stories=req.with_stories,
            with_tagged=req.with_tagged,
            with_highlights=req.with_highlights,
            progress=progress_callback,
            pipeline_timeout_secs=ca.DEFAULT_PIPELINE_TIMEOUT_SECS,
        )

    elif req.source == "own":
        if progress_callback:
            progress_callback("Consultando Meta Graph API...")
        info, posts, comments, extra = await anyio.to_thread.run_sync(
            cg.fetch_own,
            token,
            req.max_posts,
            req.with_comments,
            req.comments_per_post,
            req.with_insights,
        )

    elif req.source == "discovery":
        my_id = req.my_ig_id.strip() or os.getenv("IG_USER_ID", "")
        if not my_id:
            raise ValueError("Informe o ID da sua conta Instagram (ig_user_id).")
        if progress_callback:
            progress_callback("Consultando Instagram Business Discovery...")
        info, posts = await anyio.to_thread.run_sync(
            cg.fetch_discovery, token, my_id, username, req.max_posts
        )
        comments = []

    else:  # insta
        if progress_callback:
            progress_callback("Inicializando Instaloader...")

        def _run_insta():
            loader = co.get_loader(req.login_user or None, req.password or None)
            profile, info_dict = co.fetch_profile(loader, username)
            if profile.is_private and not req.login_user:
                raise ValueError("Perfil privado: só é possível analisar perfis abertos.")
            logged = bool(req.login_user)
            posts_list, comments_list = co.fetch_posts(
                profile,
                req.max_posts,
                req.with_comments and logged,
                req.comments_per_post,
                req.delay,
            )
            foll, folw = [], []
            if req.with_people and logged:
                foll = co.fetch_people(profile, "followers", req.people_limit)
                folw = co.fetch_people(profile, "followees", req.people_limit)
            return info_dict, posts_list, comments_list, foll, folw

        info, posts, comments, followers, followees = await anyio.to_thread.run_sync(_run_insta)

    if progress_callback:
        progress_callback("Calculando métricas, engajamento e sentimentos léxicos...")

    result = analytics.analyze(info, posts, comments, followers, followees, extra)
    result["source"] = req.source

    # Resiliência no PostgreSQL: salva a análise automaticamente
    try:
        db_id = await repository.save_analysis(result, job_id=job_id)
        if db_id:
            result["id"] = db_id
            result["db_id"] = db_id
    except Exception as db_err:
        logger.warning(f"Aviso ao persistir análise no banco: {db_err}")

    if progress_callback:
        progress_callback("Dados consolidados e persistidos com sucesso.")

    return result


@app.post("/api/analyze")
async def analyze(req: AnalyzeRequest) -> dict:
    """Endpoint direto síncrono/assíncrono mantendo total compatibilidade com o frontend."""
    logger.info(f"[SYNC] Nova análise síncrona: @{req.username} (fonte={req.source})")
    start_t = time.time()
    try:
        res = await asyncio.wait_for(
            execute_analysis(req, progress_callback=lambda p: logger.info(f"[SYNC] {p}")),
            timeout=ca.DEFAULT_PIPELINE_TIMEOUT_SECS,
        )
        logger.info(f"[SYNC] Análise síncrona concluída em {time.time() - start_t:.1f}s.")
        return res
    except (asyncio.TimeoutError, TimeoutError) as e:
        logger.error(f"[SYNC] Timeout excedido: {e}")
        raise HTTPException(
            status_code=504,
            detail=f"Tempo limite excedido na coleta externa: {e}. Considere utilizar /api/analyze/async para grandes volumes.",
        )
    except ValueError as e:
        logger.warning(f"[SYNC] Parâmetros inválidos: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        hint = ""
        if req.source == "insta":
            hint = " Dica: 401/429 = bloqueio do Instagram. Espere, troque de rede ou use login/Apify."
        logger.error(f"[SYNC] Erro durante análise: {e}", exc_info=True)
        raise HTTPException(status_code=502, detail=f"{type(e).__name__}: {e}.{hint}")


@app.post("/api/analyze/async", status_code=202)
async def analyze_async(req: AnalyzeRequest) -> dict:
    """Inicia a análise em background retornando um job_id para polling (evita 504 Gateway Timeout)."""
    job = await job_manager.create_job(req.model_dump())
    logger.info(
        f"[{job.id}] Novo job registrado para @{req.username} (fonte={req.source}, max_posts={req.max_posts}, "
        f"comentários={req.with_comments}, stories={req.with_stories})"
    )

    async def _runner():
        start_t = time.time()
        await job_manager.update_status(
            job.id, JobStatus.RUNNING, "Análise iniciada via pipeline assíncrono...", log_level="info"
        )
        try:
            res = await execute_analysis(
                req,
                progress_callback=lambda p: _safe_update_progress(job.id, p),
                job_id=job.id,
            )
            job_cur = await job_manager.get_job(job.id)
            if job_cur and job_cur.status != JobStatus.CANCELLED:
                dur = time.time() - start_t
                n_posts = len(res.get("posts", []))
                n_comments = len(res.get("comments", {}).get("items", []))
                success_msg = f"Análise concluída com sucesso ({n_posts} posts, {n_comments} comentários em {dur:.1f}s)."
                logger.info(f"[{job.id}] {success_msg}")
                await job_manager.update_status(
                    job.id, JobStatus.COMPLETED, success_msg, result=res, log_level="success"
                )
        except asyncio.CancelledError:
            logger.warning(f"[{job.id}] Tarefa assíncrona cancelada.")
        except Exception as exc:
            logger.error(f"[{job.id}] Falha na execução da análise: {exc}", exc_info=True)
            job_cur = await job_manager.get_job(job.id)
            if job_cur and job_cur.status != JobStatus.CANCELLED:
                await job_manager.update_status(
                    job.id, JobStatus.FAILED, f"Falha na análise: {exc}", error=str(exc), log_level="error"
                )

    job.task = asyncio.create_task(_runner())
    return {
        "job_id": job.id,
        "status": job.status.value,
        "progress": job.progress,
        "status_url": f"/api/jobs/{job.id}",
    }


@app.get("/api/jobs/{job_id}")
async def get_job(job_id: str) -> dict:
    """Consulta o status e o resultado de um job em background."""
    job = await job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job não encontrado.")
    return job.to_dict()


@app.delete("/api/jobs/{job_id}")
async def cancel_job(job_id: str) -> dict:
    """Cancela um job em execução."""
    logger.info(f"[{job_id}] Cancelamento solicitado.")
    success = await job_manager.cancel_job(job_id)
    if not success:
        raise HTTPException(status_code=404, detail="Job não encontrado ou já finalizado.")
    logger.info(f"[{job_id}] Cancelamento concluído.")
    return {"job_id": job_id, "status": "cancelled"}


# ==========================================
# Rotas de Inteligência Artificial (Diagnóstico & Chat)
# ==========================================

class AiDiagnosisRequest(BaseModel):
    analysis: dict
    focus: str = "general"  # "general", "growth", "sales", "copy"
    token: str = ""  # Token opcional se não estiver no .env
    provider: str = ""  # "gemini", "openai", "openrouter", "ollama", "custom"
    model: str = ""
    fallback_token: str = ""


class AiChatMessage(BaseModel):
    role: str = "user"  # "user" | "assistant"
    content: str


class AiChatRequest(BaseModel):
    analysis: dict
    messages: list[AiChatMessage]
    token: str = ""
    provider: str = ""
    model: str = ""
    fallback_token: str = ""


@app.post("/api/ai/diagnose")
async def ai_diagnose(req: AiDiagnosisRequest) -> dict:
    """Gera diagnóstico estratégico e recomendações de conteúdo via IA."""
    if not req.analysis:
        raise HTTPException(status_code=400, detail="Dados de análise não fornecidos.")
    try:
        diagnosis = await ai_service.generate_diagnosis(
            analysis_data=req.analysis,
            focus=req.focus,
            token=req.token,
            provider=req.provider,
            model=req.model,
            fallback_token=req.fallback_token,
        )

        # Resiliência no PostgreSQL: persiste o dossiê / diagnóstico
        try:
            analysis_id = req.analysis.get("id") or req.analysis.get("db_id")
            username = (req.analysis.get("info", {}) or {}).get("username") or ""
            rep_id = await repository.save_ai_report(
                username=username,
                focus=req.focus,
                provider=diagnosis.get("meta", {}).get("provider") or req.provider or ai_service.get_ai_config().get("provider", ""),
                model=diagnosis.get("meta", {}).get("model") or req.model or ai_service.get_ai_config().get("model", ""),
                diagnosis_data=diagnosis,
                analysis_id=analysis_id,
            )
            if rep_id:
                diagnosis["id"] = rep_id
        except Exception as db_err:
            logger.warning(f"Aviso ao persistir relatório de IA no banco: {db_err}")

        return diagnosis
    except ValueError as e:
        logger.warning(f"Parâmetro inválido na chamada de IA: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Erro ao gerar diagnóstico com IA: {e}", exc_info=True)
        raise HTTPException(status_code=502, detail=f"Erro no processamento da IA: {e}")


@app.post("/api/ai/chat")
async def ai_chat(req: AiChatRequest) -> dict:
    """Chat consultor interativo com IA fundamentado nos dados reais do perfil."""
    if not req.analysis:
        raise HTTPException(status_code=400, detail="Dados de análise não fornecidos.")
    if not req.messages:
        raise HTTPException(status_code=400, detail="Histórico de mensagens vazio.")
    try:
        raw_msgs = [m.model_dump() for m in req.messages]
        return await ai_service.chat_with_profile(
            analysis_data=req.analysis,
            messages=raw_msgs,
            token=req.token,
            provider=req.provider,
            model=req.model,
            fallback_token=req.fallback_token,
        )
    except ValueError as e:
        logger.warning(f"Parâmetro inválido no chat de IA: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Erro no chat da IA: {e}", exc_info=True)
        raise HTTPException(status_code=502, detail=f"Erro no chat da IA: {e}")


# ==========================================
# Rotas de Histórico e Resiliência (PostgreSQL)
# ==========================================

@app.get("/api/reports")
async def list_reports(username: Optional[str] = None, limit: int = 50, offset: int = 0) -> list[dict]:
    """Lista o histórico de relatórios e análises persistidos no PostgreSQL."""
    return await repository.list_analyses(username=username, limit=limit, offset=offset)


@app.get("/api/reports/{report_id}")
async def get_report(report_id: str) -> dict:
    """Recupera a análise e dados completos salvos no PostgreSQL pelo ID."""
    report = await repository.get_analysis_by_id(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Relatório/Análise não encontrado no banco de dados.")
    return report


@app.delete("/api/reports/{report_id}")
async def delete_report(report_id: str) -> dict:
    """Exclui uma análise e relatórios associados do banco de dados."""
    success = await repository.delete_analysis(report_id)
    if not success:
        raise HTTPException(status_code=404, detail="Relatório não encontrado ou já excluído.")
    return {"id": report_id, "deleted": True}


@app.get("/api/reports/{report_id}/ai")
async def get_report_ai_dossiers(report_id: str) -> list[dict]:
    """Lista os relatórios/dossiês de IA gerados para esta análise específica."""
    return await repository.list_ai_reports_for_analysis(report_id)


@app.get("/api/health/db")
async def check_db_health_endpoint() -> dict:
    """Verifica o status e conectividade do banco de dados PostgreSQL."""
    return await database.check_db_health()


# ==========================================
# Rotas de Busca Multiplataforma & Social Listening
# ==========================================

from collectors import MultiPlatformManager


class MultiSearchRequest(BaseModel):
    search_mode: Literal["topic", "profile"] = "topic"
    query: str = Field(..., min_length=1)
    platforms: list[str] = Field(default_factory=lambda: ["youtube", "reddit", "tiktok", "twitter", "threads", "instagram", "web"])
    limit: int = Field(25, ge=1, le=100)
    token: str = ""


async def _run_multi_search_background(job_id: str, req: MultiSearchRequest) -> None:
    """Executa a busca transmídia em segundo plano com acompanhamento em tempo real."""
    def _progress(msg: str) -> None:
        _safe_update_progress(job_id, msg)

    try:
        _progress(f"Iniciando coleta multiplataforma ({req.search_mode}) para '{req.query}'...")
        res = await MultiPlatformManager.execute_search(
            search_mode=req.search_mode,
            query=req.query,
            platforms=req.platforms,
            limit=req.limit,
            token=req.token,
            progress_callback=_progress,
        )

        result_dict = res.model_dump()
        _progress("Persistindo resultados consolidados no PostgreSQL...")
        saved_id = await repository.save_search_run(result_dict, job_id=job_id)
        if saved_id:
            result_dict["db_id"] = saved_id

        await job_manager.finish_job(
            job_id,
            result_id=saved_id or res.id,
            result_data=result_dict,
        )
        logger.info(f"[{job_id}] Busca transmídia concluída com sucesso: ID={res.id}")
    except Exception as exc:
        logger.error(f"[{job_id}] Falha na busca transmídia: {exc}", exc_info=True)
        await job_manager.fail_job(job_id, str(exc))


@app.post("/api/search/multi")
async def search_multi(req: MultiSearchRequest) -> dict:
    """Inicia um job assíncrono para busca transmídia / social listening em tempo real."""
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Termo de busca ou perfil não informado.")
    if not req.platforms:
        raise HTTPException(status_code=400, detail="Selecione pelo menos uma plataforma para busca.")

    job = await job_manager.create_job(req.model_dump())
    task = asyncio.create_task(_run_multi_search_background(job.id, req))
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)

    return {
        "job_id": job.id,
        "status": "pending",
        "search_mode": req.search_mode,
        "query": req.query,
        "platforms": req.platforms,
    }


@app.get("/api/search/runs")
async def list_search_runs(limit: int = 30) -> list[dict]:
    """Lista histórico recente de buscas multiplataforma persistidas no PostgreSQL."""
    return await repository.list_search_runs(limit=limit)


@app.get("/api/search/runs/{search_id}")
async def get_search_run(search_id: str) -> dict:
    """Recupera os resultados completos de uma busca transmídia pelo ID."""
    run = await repository.get_search_run_by_id(search_id)
    if not run:
        raise HTTPException(status_code=404, detail="Busca não encontrada no histórico.")
    return run


@app.delete("/api/search/runs/{search_id}")
async def delete_search_run(search_id: str) -> dict:
    """Exclui uma busca salva do histórico."""
    success = await repository.delete_search_run(search_id)
    if not success:
        raise HTTPException(status_code=404, detail="Busca não encontrada ou já excluída.")
    return {"id": search_id, "deleted": True}


class OmnichannelAiAuditRequest(BaseModel):
    search_data: dict
    provider: str = ""
    model: str = ""
    token: str = ""
    fallback_token: str = ""


@app.post("/api/search/ai/audit")
async def omnichannel_ai_audit(req: OmnichannelAiAuditRequest) -> dict:
    """Gera auditoria transmídia comparativa 360° e ideias de adaptação de formato."""
    if not req.search_data:
        raise HTTPException(status_code=400, detail="Dados de busca não fornecidos.")
    try:
        audit = await ai_service.generate_omnichannel_audit(
            search_data=req.search_data,
            provider=req.provider,
            model=req.model,
            token=req.token,
            fallback_token=req.fallback_token,
        )

        search_id = req.search_data.get("id") or req.search_data.get("db_id")
        query = req.search_data.get("query", "")
        if search_id:
            try:
                rep_id = await repository.save_omnichannel_report(
                    search_run_id=search_id,
                    query=query,
                    provider=audit.get("meta", {}).get("provider", ""),
                    model=audit.get("meta", {}).get("model", ""),
                    executive_summary=audit.get("report", {}).get("executive_summary", ""),
                    report_data=audit.get("report", {}),
                )
                if rep_id:
                    audit["id"] = rep_id
            except Exception as db_err:
                logger.warning(f"Aviso ao persistir relatório omnichannel: {db_err}")

        return audit
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Erro na auditoria omnichannel de IA: {e}", exc_info=True)
        raise HTTPException(status_code=502, detail=f"Erro na IA: {e}")


class OmnichannelAiChatRequest(BaseModel):
    search_data: dict
    messages: list[AiChatMessage]
    provider: str = ""
    model: str = ""
    token: str = ""
    fallback_token: str = ""


@app.post("/api/search/ai/chat")
async def omnichannel_ai_chat(req: OmnichannelAiChatRequest) -> dict:
    """Chat consultor interativo com IA sobre a busca multiplataforma."""
    if not req.search_data or not req.messages:
        raise HTTPException(status_code=400, detail="Dados ou mensagens ausentes.")
    try:
        raw_msgs = [m.model_dump() for m in req.messages]
        return await ai_service.chat_omnichannel(
            search_data=req.search_data,
            messages=raw_msgs,
            provider=req.provider,
            model=req.model,
            token=req.token,
            fallback_token=req.fallback_token,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Erro no chat omnichannel: {e}", exc_info=True)
        raise HTTPException(status_code=502, detail=f"Erro na IA: {e}")


# ==========================================
# Rotas de Inteligência OSINT & Google/DDG Dorking
# ==========================================

from collectors.osint_collector import OsintCollector, is_safe_url


class OsintDorkRequest(BaseModel):
    query: str = Field(..., min_length=1)
    preset: str = Field("reputation", pattern="^(reputation|media_kit|press|transmedia|judicial|custom)$")
    max_results: int = Field(15, ge=1, le=50)
    custom_dork: Optional[str] = None


class BioResolveRequest(BaseModel):
    url: str = Field(..., min_length=4)


class UsernameScanRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=60)
    limit_targets: int = Field(16, ge=1, le=30)


class OsintDossierRequest(BaseModel):
    target: str = Field(..., min_length=1)
    bio_url: Optional[str] = None
    include_reputation: bool = True
    include_press: bool = True
    include_media_kit: bool = True


@app.post("/api/osint/dork")
async def osint_dork_search(req: OsintDorkRequest) -> dict:
    """Executa pesquisa web OSINT com operadores de dorking ou presets especializados."""
    try:
        results = await OsintCollector.search_dork(
            query=req.query,
            preset=req.preset,
            max_results=req.max_results,
            custom_dork=req.custom_dork,
        )
        return {
            "query": req.query,
            "preset": req.preset,
            "dork_used": req.custom_dork or OsintCollector.build_dork(req.query, req.preset),
            "total_found": len(results),
            "results": results,
        }
    except Exception as exc:
        logger.error(f"Erro ao executar busca Dork: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro na pesquisa OSINT: {str(exc)}")


@app.post("/api/osint/bio-resolve")
async def osint_bio_resolve(req: BioResolveRequest) -> dict:
    """Resolve páginas agregadoras de links da bio (Linktree, Beacons, Carrd) com proteção SSRF."""
    if not is_safe_url(req.url):
        raise HTTPException(status_code=400, detail="URL bloqueada por política de segurança SSRF.")
    try:
        return await OsintCollector.resolve_bio_url(req.url)
    except Exception as exc:
        logger.error(f"Erro ao resolver bio URL: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao resolver bio URL: {str(exc)}")


@app.post("/api/osint/username-scan")
async def osint_username_scan(req: UsernameScanRequest) -> dict:
    """Detecta a presença de @username em 20+ plataformas web abertas."""
    try:
        return await OsintCollector.scan_username_footprint(
            username=req.username,
            limit_targets=req.limit_targets,
        )
    except Exception as exc:
        logger.error(f"Erro ao varrer username: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro na varredura OSINT: {str(exc)}")


@app.post("/api/osint/dossier")
async def osint_generate_dossier(req: OsintDossierRequest) -> dict:
    """Consolida um dossiê OSINT completo: Bio Links + Pegada Digital + Menções/Dorks."""
    try:
        return await OsintCollector.generate_dossier(
            username_or_brand=req.target,
            bio_url=req.bio_url,
            include_reputation=req.include_reputation,
            include_press=req.include_press,
            include_media_kit=req.include_media_kit,
        )
    except Exception as exc:
        logger.error(f"Erro ao compilar dossiê OSINT: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao gerar dossiê OSINT: {str(exc)}")



