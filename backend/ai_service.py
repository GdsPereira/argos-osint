"""Módulo de Inteligência Artificial para Diagnóstico e Consultoria Estratégica do Instagram.

Suporta Google Gemini, OpenAI e provedores compatíveis com a API OpenAI (Groq, Ollama, DeepSeek).
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Optional

import httpx

from pathlib import Path

logger = logging.getLogger("insta_analyzer.ai")

DEFAULT_GEMINI_MODEL = "gemma-4-31b-it"
DEFAULT_OPENAI_MODEL = "gpt-4o-mini"
DEFAULT_OPENROUTER_MODEL = "google/gemini-2.0-flash-001"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


def _ensure_env() -> None:
    """Carrega .env da pasta raiz e backend com fallback puro."""
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


def detect_provider_from_key(key: str) -> Optional[str]:
    """Detecta automaticamente o provedor com base no prefixo do token."""
    k = key.strip()
    if not k:
        return None
    # Google Gemini: novo formato AQ.Ab8... ou legado AIzaSy...
    if k.startswith("AQ.") or k.startswith("AIzaSy"):
        return "gemini"
    # OpenRouter: sk-or-v1-... ou sk-or-...
    if k.startswith("sk-or-"):
        return "openrouter"
    # OpenAI: sk-...
    if k.startswith("sk-"):
        return "openai"
    return None


def get_ai_config() -> dict[str, Any]:
    """Retorna o status de configuração de IA do servidor."""
    _ensure_env()
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    openrouter_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    custom_key = os.getenv("AI_API_KEY", "").strip()
    provider = os.getenv("AI_PROVIDER", "").strip().lower()

    # Se uma chave foi colocada na variável errada, auto-corrige:
    if openai_key and detect_provider_from_key(openai_key) == "gemini":
        gemini_key = openai_key
        openai_key = ""
        provider = "gemini"
    elif openai_key and detect_provider_from_key(openai_key) == "openrouter":
        openrouter_key = openai_key
        openai_key = ""
        if not provider:
            provider = "openrouter"
    elif custom_key and detect_provider_from_key(custom_key) == "gemini":
        gemini_key = custom_key
        custom_key = ""
        provider = "gemini"
    elif custom_key and detect_provider_from_key(custom_key) == "openrouter":
        openrouter_key = custom_key
        custom_key = ""
        if not provider:
            provider = "openrouter"
    elif gemini_key and detect_provider_from_key(gemini_key) == "openrouter":
        openrouter_key = gemini_key
        gemini_key = ""
        if not provider:
            provider = "openrouter"
    elif gemini_key and detect_provider_from_key(gemini_key) == "openai":
        openai_key = gemini_key
        gemini_key = ""
        provider = "openai"

    if not provider or provider == "none":
        if gemini_key:
            provider = "gemini"
        elif openai_key or custom_key:
            provider = "openai"
        elif openrouter_key:
            provider = "openrouter"
        else:
            provider = "none"

    is_configured = bool(gemini_key or openai_key or openrouter_key or custom_key or provider == "ollama")

    active_model = os.getenv("AI_MODEL", "").strip()
    if not active_model:
        if provider == "gemini":
            active_model = DEFAULT_GEMINI_MODEL
        elif provider == "openrouter":
            active_model = os.getenv("OPENROUTER_MODEL", "").strip() or DEFAULT_OPENROUTER_MODEL
        else:
            active_model = DEFAULT_OPENAI_MODEL

    openrouter_model = os.getenv("OPENROUTER_MODEL", "").strip() or DEFAULT_OPENROUTER_MODEL
    fallback_available = bool(openrouter_key)

    return {
        "configured": is_configured,
        "provider": provider if is_configured else "gemini",
        "model": active_model,
        "fallback_available": fallback_available,
        "fallback_provider": "openrouter" if fallback_available else None,
        "fallback_model": openrouter_model if fallback_available else None,
        "providers_available": {
            "gemini": bool(gemini_key),
            "openai": bool(openai_key),
            "openrouter": bool(openrouter_key),
            "custom": bool(custom_key or os.getenv("AI_BASE_URL")),
        },
    }


def distill_analysis(data: dict[str, Any]) -> dict[str, Any]:
    """Extrai e condensa as métricas e dados essenciais para o contexto da IA.
    
    Isso economiza tokens e acelera a resposta, mantendo precisão analítica.
    """
    info = data.get("info", {}) or {}
    summary = data.get("summary", {}) or {}
    posts = data.get("posts", []) or []
    hashtags = data.get("hashtags", {}) or {}
    charts = data.get("charts", {}) or {}
    comments_data = data.get("comments", {}) or {}

    # Ordenar posts por engajamento/interações
    valid_posts = sorted(
        posts,
        key=lambda p: (p.get("interacoes") or 0),
        reverse=True,
    )

    extra_data = data.get("extra", {}) or {}

    def _format_post(p: dict[str, Any]) -> dict[str, Any]:
        legenda = (p.get("legenda") or "").strip()
        preview = (legenda[:200] + "...") if len(legenda) > 200 else legenda
        return {
            "shortcode": p.get("shortcode"),
            "data": p.get("data"),
            "tipo": p.get("tipo"),
            "curtidas": p.get("curtidas"),
            "comentarios": p.get("comentarios"),
            "interacoes": p.get("interacoes"),
            "plays_video": p.get("plays_video"),
            "musica": f"{p.get('musica')} ({p.get('artista')})" if p.get("musica") else None,
            "colabs": p.get("colabs") or [],
            "fixado": p.get("fixado"),
            "taxa_engajamento": p.get("taxa_engajamento"),
            "preview_legenda": preview,
            "hashtags": (p.get("hashtags") or [])[:5],
        }

    top_posts = [_format_post(p) for p in valid_posts[:5]]
    bottom_posts = [_format_post(p) for p in valid_posts[-3:]] if len(valid_posts) > 5 else []

    # Amostra de comentários relevantes (priorizando textos mais longos ou perguntas)
    raw_comments = comments_data.get("items", []) or []
    sample_comments = []
    for c in raw_comments:
        txt = (c.get("texto") or "").strip()
        if len(txt) >= 8 and len(sample_comments) < 20:
            sample_comments.append({
                "autor": c.get("autor"),
                "texto": txt[:150],
                "sentimento": c.get("sentimento"),
            })

    # Amostra de posts marcados (tagged posts por clientes/terceiros)
    raw_tagged = extra_data.get("tagged_posts", []) or []
    sample_tagged = []
    for tp in raw_tagged[:5]:
        sample_tagged.append({
            "shortcode": tp.get("shortcode"),
            "curtidas": tp.get("curtidas"),
            "comentarios": tp.get("comentarios"),
            "preview_legenda": (tp.get("legenda") or "")[:120],
        })

    # Mapeamento de inteligência OSINT: colaboradores, locais e trilhas
    unique_colabs = set()
    unique_locations = set()
    unique_audios = set()
    for p in posts:
        for c in (p.get("colabs") or []):
            if c:
                unique_colabs.add(c)
        if p.get("local"):
            unique_locations.add(p.get("local"))
        if p.get("musica"):
            unique_audios.add(f"{p.get('musica')} ({p.get('artista')})" if p.get("artista") else p.get("musica"))

    mentions_top = [m.get("item") for m in (data.get("mentions", []) or [])[:10]]
    tagged_top = [t.get("item") for t in (data.get("tagged", []) or [])[:10]]
    locations_top = [l.get("item") for l in (data.get("locations", []) or [])[:10]]
    top_commenters = [a.get("item") for a in (comments_data.get("top_authors", []) or [])[:10]]

    return {
        "perfil": {
            "username": info.get("username"),
            "user_id": info.get("user_id"),
            "nome_completo": info.get("nome_completo"),
            "biografia": info.get("biografia") or info.get("bio"),
            "bio_mencoes": info.get("bio_mencoes") or [],
            "bio_hashtags": info.get("bio_hashtags") or [],
            "seguidores": info.get("seguidores"),
            "seguindo": info.get("seguindo"),
            "ratio_seguidores_seguindo": summary.get("seguidores_por_seguindo"),
            "total_posts": info.get("posts"),
            "verificado": info.get("verificado"),
            "conta_business": info.get("conta_business"),
            "categoria": info.get("categoria_business"),
            "email_comercial": info.get("email") or (extra_data.get("contato") or {}).get("email"),
            "telefone_comercial": info.get("telefone") or (extra_data.get("contato") or {}).get("telefone"),
            "endereco_comercial": info.get("endereco") or (extra_data.get("contato") or {}).get("endereco"),
            "link_bio_principal": info.get("link_externo"),
            "todos_links_externos": info.get("links_externos") or (extra_data.get("contato") or {}).get("links_externos", []),
            "destaques_count": info.get("destaques_count"),
            "concorrentes_similares_sugeridos": info.get("perfis_similares") or extra_data.get("perfis_similares", []),
        },
        "kpis": {
            "posts_analisados": summary.get("posts_analisados"),
            "taxa_engajamento_media": summary.get("taxa_engajamento"),
            "media_curtidas": summary.get("media_curtidas"),
            "mediana_curtidas": summary.get("mediana_curtidas"),
            "media_comentarios": summary.get("media_comentarios"),
            "curtidas_ocultas": summary.get("curtidas_ocultas"),
            "posts_por_semana": summary.get("posts_por_semana"),
            "melhor_hora": summary.get("melhor_hora"),
            "melhor_dia": summary.get("melhor_dia"),
            "total_interacoes": summary.get("total_interacoes"),
        },
        "grafo_de_rede_e_conexoes_osint": {
            "concorrentes_e_perfis_similares": info.get("perfis_similares") or extra_data.get("perfis_similares", []),
            "colaboradores_coautores_recorrentes": list(unique_colabs)[:10],
            "contas_mencionadas_nas_legendas": mentions_top,
            "contas_marcadas_nas_midias": tagged_top,
            "principais_autores_comentarios": top_commenters,
            "posts_marcados_por_terceiros_ugc": sample_tagged,
        },
        "padrao_de_vida_rotina_e_geolocalizacao_osint": {
            "locais_e_checkins_frequentes": locations_top or list(unique_locations)[:10],
            "pico_horario_atividade": summary.get("melhor_hora"),
            "dia_da_semana_mais_ativo": summary.get("melhor_dia"),
            "cadencia_posts_por_semana": summary.get("posts_por_semana"),
        },
        "formatos_performance": charts.get("by_type", []),
        "top_posts_alta_performance": top_posts,
        "posts_baixa_performance": bottom_posts,
        "posts_marcados_por_clientes": sample_tagged,
        "destaques_do_perfil": [h.get("title") for h in (extra_data.get("highlights", []) or [])[:10] if isinstance(h, dict)],
        "trilhas_sonoras_utilizadas": list(unique_audios)[:10],
        "top_hashtags_eficientes": (hashtags.get("performance", []) or [])[:10],
        "comentarios_resumo": {
            "sentimentos": comments_data.get("sentiment", {}),
            "palavras_frequentes": [w.get("item") for w in (comments_data.get("words", []) or [])[:15]],
            "amostra_comentarios": sample_comments,
        },
    }


def _clean_json_response(raw_text: str) -> dict[str, Any]:
    """Extrai e decodifica JSON válido de respostas que podem conter blocos markdown."""
    text = raw_text.strip()
    # Remove cercas ```json ou ```
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if match:
        text = match.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        logger.warning(f"Falha ao decodificar JSON direto: {exc}. Tentando extrair chaves principais...")
        # Tenta extrair primeiro '{' até último '}'
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            return json.loads(text[start : end + 1])
        raise


async def _call_gemini(
    prompt: str,
    system_instruction: str,
    api_key: str,
    model: str = DEFAULT_GEMINI_MODEL,
    json_mode: bool = True,
) -> str:
    """Invoca a API do Google Gemini via REST assíncrono com fallback automático de modelos."""
    fallback_chain = [model]
    for alt in ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite"]:
        if alt not in fallback_chain:
            fallback_chain.append(alt)

    payload: dict[str, Any] = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}],
            }
        ],
        "systemInstruction": {
            "parts": [{"text": system_instruction}]
        },
        "generationConfig": {
            "temperature": 0.4,
            "maxOutputTokens": 4096,
        },
    }

    if json_mode:
        payload["generationConfig"]["responseMimeType"] = "application/json"

    last_error = None
    async with httpx.AsyncClient(timeout=90.0) as client:
        for current_model in fallback_chain:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{current_model}:generateContent?key={api_key}"
            try:
                resp = await client.post(url, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            # Filtra tokens de raciocínio intermediário (thought: true) para modelos thinking (ex: Gemma 4 31B)
                            non_thought_parts = [p.get("text", "") for p in parts if not p.get("thought", False)]
                            result_text = "".join(non_thought_parts).strip() if non_thought_parts else parts[-1].get("text", "").strip()
                            if result_text:
                                return result_text

                # Se for 500, 502, 503 (alta demanda/erro interno), 429 (cota) ou 404 (indisponível), tenta próximo da lista
                if resp.status_code in (500, 502, 503, 504, 404, 429):
                    logger.warning(f"Modelo Gemini {current_model} retornou status {resp.status_code}. Tentando modelo alternativo...")
                    last_error = f"Erro da API Gemini ({resp.status_code}): {resp.text}"
                    continue
                else:
                    err_msg = f"Erro da API Gemini ({resp.status_code}): {resp.text}"
                    logger.error(err_msg)
                    raise RuntimeError(err_msg)
            except (httpx.ConnectError, httpx.ReadTimeout) as e:
                logger.warning(f"Timeout/Conexão com {current_model}: {e}. Tentando fallback...")
                last_error = str(e)
                continue

    raise RuntimeError(last_error or "Nenhum modelo Gemini respondeu com sucesso.")


async def _call_openai(
    messages: list[dict[str, str]],
    api_key: str,
    model: str = DEFAULT_OPENAI_MODEL,
    base_url: Optional[str] = None,
    json_mode: bool = True,
) -> str:
    """Invoca a API da OpenAI (ou compatível como Groq, Ollama, DeepSeek) via REST assíncrono."""
    url = (base_url.rstrip("/") if base_url else "https://api.openai.com/v1") + "/chat/completions"

    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": 0.4,
    }

    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    timeout_secs = float(os.getenv("AI_TIMEOUT_SECS", "90.0"))

    async with httpx.AsyncClient(timeout=timeout_secs) as client:
        resp = await client.post(url, json=payload, headers=headers)
        if resp.status_code != 200:
            err_msg = f"Erro da API OpenAI ({resp.status_code}): {resp.text}"
            logger.error(err_msg)
            raise RuntimeError(err_msg)
        
        data = resp.json()
        choices = data.get("choices", [])
        if not choices:
            raise RuntimeError("API OpenAI não retornou escolhas de resposta.")
        
        return choices[0].get("message", {}).get("content", "")


async def _call_openrouter(
    messages: list[dict[str, str]],
    api_key: str,
    model: str = DEFAULT_OPENROUTER_MODEL,
    base_url: Optional[str] = None,
    json_mode: bool = True,
) -> str:
    """Invoca a API do OpenRouter via REST assíncrono (compatível com OpenAI) com suporte a múltiplos modelos e fallback."""
    url = (base_url.rstrip("/") if base_url else OPENROUTER_BASE_URL) + "/chat/completions"

    payload: dict[str, Any] = {
        "model": model or DEFAULT_OPENROUTER_MODEL,
        "messages": messages,
        "temperature": 0.4,
    }

    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    headers = {
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "https://instagram-analytics-pro.local",
        "X-Title": "Instagram Analytics Pro",
        "Content-Type": "application/json",
    }

    timeout_secs = float(os.getenv("AI_TIMEOUT_SECS", "90.0"))

    async with httpx.AsyncClient(timeout=timeout_secs) as client:
        resp = await client.post(url, json=payload, headers=headers)

        # Se 400 por incompatibilidade com response_format em algum modelo específico do OpenRouter, retenta sem o campo:
        if resp.status_code == 400 and json_mode and "response_format" in resp.text:
            logger.warning(
                f"Modelo OpenRouter '{model}' não aceitou response_format json_object. Retentando chamada padrão..."
            )
            payload.pop("response_format", None)
            resp = await client.post(url, json=payload, headers=headers)

        if resp.status_code != 200:
            err_msg = f"Erro da API OpenRouter ({resp.status_code}): {resp.text}"
            logger.error(err_msg)
            raise RuntimeError(err_msg)

        data = resp.json()
        choices = data.get("choices", [])
        if not choices:
            raise RuntimeError("API OpenRouter não retornou escolhas de resposta.")

        return choices[0].get("message", {}).get("content", "")


def _resolve_credentials(
    token: str = "",
    provider: str = "",
    model: str = "",
) -> tuple[str, str, str, Optional[str]]:
    """Determina credenciais, provedor, modelo e base_url a serem utilizados."""
    _ensure_env()
    cfg = get_ai_config()

    # 1. Verifica se veio token direto na requisição
    final_token = token.strip()
    
    # 2. Se não veio token, busca do .env
    if not final_token:
        gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
        openai_key = os.getenv("OPENAI_API_KEY", "").strip() or os.getenv("AI_API_KEY", "").strip()
        openrouter_key = os.getenv("OPENROUTER_API_KEY", "").strip()

        req_prov = provider.strip().lower() if (provider and provider != "none") else cfg["provider"]
        if req_prov == "openrouter":
            final_token = openrouter_key
        elif req_prov == "openai":
            final_token = openai_key or gemini_key or openrouter_key
        elif req_prov == "gemini":
            final_token = gemini_key or openai_key or openrouter_key
        else:
            final_token = gemini_key or openai_key or openrouter_key

    # 3. Detecta o provedor automaticamente pela chave
    detected_prov = detect_provider_from_key(final_token) if final_token else None

    if detected_prov:
        final_provider = detected_prov
    elif provider.strip().lower() and provider.strip().lower() != "none":
        final_provider = provider.strip().lower()
    elif cfg["provider"] and cfg["provider"] != "none":
        final_provider = cfg["provider"]
    else:
        final_provider = "gemini"

    # Se ainda faltar token, tenta mais uma vez pegar do .env
    if not final_token:
        if final_provider == "gemini":
            final_token = os.getenv("GEMINI_API_KEY", "").strip()
        elif final_provider == "openrouter":
            final_token = os.getenv("OPENROUTER_API_KEY", "").strip()
        else:
            final_token = os.getenv("OPENAI_API_KEY", "").strip() or os.getenv("AI_API_KEY", "").strip()

    final_model = model.strip() or os.getenv("AI_MODEL", "").strip()
    if not final_model:
        if final_provider == "gemini":
            final_model = DEFAULT_GEMINI_MODEL
        elif final_provider == "openrouter":
            final_model = os.getenv("OPENROUTER_MODEL", "").strip() or DEFAULT_OPENROUTER_MODEL
        else:
            final_model = DEFAULT_OPENAI_MODEL

    if final_provider == "openrouter":
        base_url = os.getenv("OPENROUTER_BASE_URL", "").strip() or OPENROUTER_BASE_URL
    else:
        base_url = os.getenv("AI_BASE_URL", "").strip() or None

    return final_provider, final_token, final_model, base_url


async def _dispatch_ai_call(
    provider: str,
    token: str,
    model: str,
    base_url: Optional[str],
    system_instruction: str,
    prompt: Optional[str] = None,
    chat_messages: Optional[list[dict[str, str]]] = None,
    json_mode: bool = True,
) -> str:
    """Executa a chamada HTTP/REST para o provedor selecionado."""
    if provider == "gemini":
        if chat_messages is not None:
            last_user_query = chat_messages[-1]["content"] if chat_messages else "Resuma as principais observações"
            history_context = "\n".join([f"{m.get('role', 'user').upper()}: {m.get('content', '')}" for m in chat_messages[:-1]])
            combined_prompt = (
                f"Histórico anterior:\n{history_context}\n\nNova consulta:\n{last_user_query}"
                if history_context
                else last_user_query
            )
            gemini_prompt = combined_prompt
        else:
            gemini_prompt = prompt or ""

        return await _call_gemini(
            prompt=gemini_prompt,
            system_instruction=system_instruction,
            api_key=token,
            model=model or DEFAULT_GEMINI_MODEL,
            json_mode=json_mode,
        )

    elif provider == "openrouter":
        if chat_messages is not None:
            messages = [{"role": "system", "content": system_instruction}] + [
                {"role": m.get("role", "user"), "content": m.get("content", "")} for m in chat_messages
            ]
        else:
            messages = [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": prompt or ""},
            ]

        return await _call_openrouter(
            messages=messages,
            api_key=token,
            model=model or DEFAULT_OPENROUTER_MODEL,
            base_url=base_url,
            json_mode=json_mode,
        )

    else:  # openai, ollama, custom
        if chat_messages is not None:
            messages = [{"role": "system", "content": system_instruction}] + [
                {"role": m.get("role", "user"), "content": m.get("content", "")} for m in chat_messages
            ]
        else:
            messages = [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": prompt or ""},
            ]

        return await _call_openai(
            messages=messages,
            api_key=token,
            model=model or DEFAULT_OPENAI_MODEL,
            base_url=base_url,
            json_mode=json_mode,
        )


async def _execute_llm(
    system_instruction: str,
    prompt: Optional[str] = None,
    chat_messages: Optional[list[dict[str, str]]] = None,
    provider: str = "gemini",
    token: str = "",
    model: str = "",
    base_url: Optional[str] = None,
    json_mode: bool = True,
    fallback_token: str = "",
    fallback_model: Optional[str] = None,
) -> tuple[str, dict[str, Any]]:
    """Executa a invocação da IA com tolerância a falhas e fallback automático para OpenRouter."""
    _ensure_env()

    # Prepara credenciais de fallback do OpenRouter
    or_key = fallback_token.strip() or os.getenv("OPENROUTER_API_KEY", "").strip()
    if not or_key and token.strip().startswith("sk-or-"):
        or_key = token.strip()

    or_model = (
        fallback_model
        or os.getenv("OPENROUTER_MODEL", "").strip()
        or os.getenv("AI_FALLBACK_MODEL", "").strip()
        or DEFAULT_OPENROUTER_MODEL
    )
    or_base_url = os.getenv("OPENROUTER_BASE_URL", "").strip() or OPENROUTER_BASE_URL
    fallback_available = bool(or_key and provider != "openrouter")

    # 1. Se não tiver chave para o provedor principal e ele não for Ollama
    if not token and provider != "ollama":
        if fallback_available:
            logger.warning(
                f"Chave do provedor principal '{provider}' ausente. "
                f"Ativando fallback imediato para OpenRouter (modelo: {or_model})..."
            )
            raw_text = await _dispatch_ai_call(
                provider="openrouter",
                token=or_key,
                model=or_model,
                base_url=or_base_url,
                system_instruction=system_instruction,
                prompt=prompt,
                chat_messages=chat_messages,
                json_mode=json_mode,
            )
            meta = {
                "provider": "openrouter",
                "model": or_model,
                "fallback_triggered": True,
                "original_provider": provider,
                "original_model": model,
                "fallback_reason": f"Chave de API não informada para o provedor '{provider}'",
            }
            return raw_text, meta
        else:
            raise ValueError(
                f"Chave de API não informada para o provedor '{provider}'. "
                f"Defina GEMINI_API_KEY, OPENAI_API_KEY ou OPENROUTER_API_KEY no arquivo .env ou forneça na requisição."
            )

    # 2. Tenta executar no provedor principal
    try:
        raw_text = await _dispatch_ai_call(
            provider=provider,
            token=token,
            model=model,
            base_url=base_url,
            system_instruction=system_instruction,
            prompt=prompt,
            chat_messages=chat_messages,
            json_mode=json_mode,
        )

        if json_mode:
            _ = _clean_json_response(raw_text)

        meta = {
            "provider": provider,
            "model": model,
            "fallback_triggered": False,
        }
        return raw_text, meta

    except Exception as primary_exc:
        logger.warning(
            f"Falha na resposta da IA principal ({provider}/{model}): {primary_exc}."
        )

        if not fallback_available:
            logger.info("Fallback para OpenRouter não está configurado (OPENROUTER_API_KEY ausente).")
            raise primary_exc

        # 3. Executa fallback no OpenRouter
        logger.warning(
            f"Acionando fallback de resiliência para OpenRouter (modelo: {or_model}) após falha em '{provider}'..."
        )
        try:
            raw_text = await _dispatch_ai_call(
                provider="openrouter",
                token=or_key,
                model=or_model,
                base_url=or_base_url,
                system_instruction=system_instruction,
                prompt=prompt,
                chat_messages=chat_messages,
                json_mode=json_mode,
            )

            if json_mode:
                _ = _clean_json_response(raw_text)

            meta = {
                "provider": "openrouter",
                "model": or_model,
                "fallback_triggered": True,
                "original_provider": provider,
                "original_model": model,
                "fallback_reason": str(primary_exc),
            }
            logger.info(f"Fallback para OpenRouter executado com sucesso (modelo: {or_model})!")
            return raw_text, meta

        except Exception as or_exc:
            logger.error(f"Fallback para OpenRouter também falhou: {or_exc}")
            raise RuntimeError(
                f"Falha na IA principal ({provider}: {primary_exc}) e no fallback OpenRouter ({or_exc})"
            ) from or_exc


DIAGNOSIS_SYSTEM_PROMPT = """Você é um Analista Sênior de Inteligência de Fontes Abertas (OSINT / SOCMINT) e Perfilamento Digital.
Sua missão é processar todos os metadados, vetores de contato, conexões e evidências públicas extraídas de um perfil do Instagram e produzir um DOSSIÊ CONSOLIDADO DE INTELIGÊNCIA OSINT de alto rigor analítico.

Você DEVE responder ESTRITAMENTE em formato JSON com a seguinte estrutura:
{
  "health_score": <número inteiro de 0 a 100 avaliando o Nível de Integridade, Autenticidade e Exposição de OPSEC do Alvo, onde 100 indica perfil com alta transparência, baixa manipulação de bots e OPSEC controlada>,
  "executive_summary": "<dossiê executivo de inteligência em 3 parágrafos aprofundados contendo: (1) Perfilamento e atribuição de identidade digital do alvo, (2) Análise de conexões, colaboradores, modus operandi e padrão de vida (Pattern of Life), (3) Avaliação de anomalias de engajamento, superfície de exposição e vulnerabilidades identificadas>",
  "swot": {
    "strengths": ["<ativo de inteligência ou força de presença/influência 1>", "<ativo 2>", "<ativo 3>"],
    "weaknesses": ["<vulnerabilidade de OPSEC, vazamento de dados de contato ou incoerência 1>", "<vulnerabilidade 2>", "<vulnerabilidade 3>"],
    "opportunities": ["<vetor de pivô investigativo / oportunidade de aprofundamento OSINT 1>", "<vetor 2>"],
    "threats": ["<risco de engenharia social, botting/fraude ou concorrência direta mapeada 1>", "<ameaça 2>"]
  },
  "content_strategy": {
    "format_verdict": "<Modus Operandi de Mídia: como o alvo estrutura seus formatos de vídeo/reels, álbuns e imagens para propagar sua mensagem e narrativas>",
    "copywriting_and_hooks": "<Análise Narrativa e Psicológica: discurso, ganchos de persuasão, gatilhos emocionais e temas centrais empregados pelo alvo>",
    "timing_and_cadence": "<Pattern of Life (Padrão de Vida e Rotina): mapeamento dos picos de atividade, fuso horário presumido, horários recorrentes de publicação e ritmo semanal>"
  },
  "audience_insights": {
    "sentiment_verdict": "<Clima Social e Percepção Pública: sentimento predominante, receptividade real, indícios de apoio autêntico vs polarização ou críticas>",
    "key_interests": ["<esfera temática dominante 1>", "<tema 2>", "<tema 3>"],
    "unmet_needs_or_questions": ["<reclamações, denúncias, solicitações de clientes ou falhas operacionais expostas nos comentários>"]
  },
  "recommended_posts": [
    {
      "title": "<Vetor de Investigação / Pivô OSINT 1 (ex: Pivô em Domínios e Infraestrutura Externa)>",
      "format": "<Vetor: Contatos & Domínios / Rede & Afiliados / Geolocalização & Rotina / Integridade de Audiência / UGC & Terceiros>",
      "hook": "<Dado Crítico Identificado de Entrada para o Pivô>",
      "concept": "<Metodologia e fontes externas recomendadas para aprofundar esse vetor investigativo>",
      "cta": "<Ação de Inteligência Imediata Recomendada>"
    },
    {
      "title": "<Vetor de Investigação / Pivô OSINT 2>",
      "format": "<Categoria do Vetor>",
      "hook": "<Dado Crítico Identificado>",
      "concept": "<Metodologia Investigativa>",
      "cta": "<Ação de Inteligência>"
    },
    {
      "title": "<Vetor de Investigação / Pivô OSINT 3>",
      "format": "<Categoria do Vetor>",
      "hook": "<Dado Crítico Identificado>",
      "concept": "<Metodologia Investigativa>",
      "cta": "<Ação de Inteligência>"
    },
    {
      "title": "<Vetor de Investigação / Pivô OSINT 4>",
      "format": "<Categoria do Vetor>",
      "hook": "<Dado Crítico Identificado>",
      "concept": "<Metodologia Investigativa>",
      "cta": "<Ação de Inteligência>"
    },
    {
      "title": "<Vetor de Investigação / Pivô OSINT 5>",
      "format": "<Categoria do Vetor>",
      "hook": "<Dado Crítico Identificado>",
      "concept": "<Metodologia Investigativa>",
      "cta": "<Ação de Inteligência>"
    }
  ],
  "quick_wins": [
    "<Alerta Crítico / Descoberta de Inteligência Imediata 1>",
    "<Alerta Crítico 2>",
    "<Alerta Crítico 3>"
  ]
}

Diretrizes Críticas de Inteligência:
1. Adote estritamente tom analítico, investigativo e imparcial de um oficial de inteligência OSINT / SOCMINT.
2. Analise a fundo a superfície de ataque e exposição de dados (e-mails públicos, telefones, cidades/endereços, links externos, domínios, UTMs).
3. Avalie anomalias estatísticas: verifique se a taxa de engajamento condiz com o volume de seguidores ou se há indícios de bots/compra de seguidores.
4. Mapeie a rede de associações: concorrentes sugeridos, colaboradores de postagens, pessoas marcadas e contas mais ativas comentando.
5. Responda ESTRITAMENTE em formato JSON válido, sem caracteres ou textos antes ou depois."""


async def generate_diagnosis(
    analysis_data: dict[str, Any],
    focus: str = "general",
    token: str = "",
    provider: str = "",
    model: str = "",
    fallback_token: str = "",
) -> dict[str, Any]:
    """Gera diagnóstico completo e estruturado sobre o perfil analisado sob a ótica OSINT."""
    final_provider, final_token, final_model, base_url = _resolve_credentials(token, provider, model)

    distilled = distill_analysis(analysis_data)
    prompt = f"""Foco Investigativo OSINT: {focus}
Evidências e metadados consolidados do alvo:
{json.dumps(distilled, ensure_ascii=False, indent=2)}

Analise meticulosamente esses dados sob a ótica de inteligência de fontes abertas (OSINT/SOCMINT) e retorne o Dossiê Executivo completo no schema JSON solicitado."""

    logger.info(f"Gerando dossiê OSINT com IA: provedor={final_provider}, modelo={final_model}, foco={focus}")

    raw_output, meta = await _execute_llm(
        system_instruction=DIAGNOSIS_SYSTEM_PROMPT,
        prompt=prompt,
        provider=final_provider,
        token=final_token,
        model=final_model,
        base_url=base_url,
        json_mode=True,
        fallback_token=fallback_token,
    )

    parsed = _clean_json_response(raw_output)
    meta["focus"] = focus
    parsed["meta"] = meta
    return parsed


async def chat_with_profile(
    analysis_data: dict[str, Any],
    messages: list[dict[str, str]],
    token: str = "",
    provider: str = "",
    model: str = "",
    fallback_token: str = "",
) -> dict[str, Any]:
    """Responde a perguntas e investigações do usuário contextualizado nos dados do alvo (Analista OSINT)."""
    final_provider, final_token, final_model, base_url = _resolve_credentials(token, provider, model)

    distilled = distill_analysis(analysis_data)
    username = distilled.get("perfil", {}).get("username", "perfil")

    system_instruction = f"""Você é um Analista Sênior de Inteligência de Fontes Abertas (OSINT / SOCMINT) especializado em investigação digital, perfilamento e engenharia reversa de perfis no Instagram.
Você está prestando consultoria de inteligência sobre o alvo @{username}.

Dados consolidados e inteligência coletada sobre o alvo:
{json.dumps(distilled, ensure_ascii=False, indent=2)}

Diretrizes Investigativas:
1. Responda em Português técnico, profissional, direto e fundamentado como um relatório de inteligência.
2. Analise conexões, vetores de contato expostos (emails, telefones, endereços, links), padrões de rotina temporal (Pattern of Life), locais marcados e possíveis anomalias/inconsistências de audiência.
3. Forneça vetores práticos de pivô (ex: cruzamento com bases externas, Whois, Google Dorks, análise de concorrência) e hipóteses de inteligência acionáveis."""

    logger.info(f"Chat OSINT IA com alvo @{username}: provedor={final_provider}, modelo={final_model}")

    reply, meta = await _execute_llm(
        system_instruction=system_instruction,
        chat_messages=messages,
        provider=final_provider,
        token=final_token,
        model=final_model,
        base_url=base_url,
        json_mode=False,
        fallback_token=fallback_token,
    )

    return {
        "reply": reply,
        "meta": meta,
    }


def _resolve_provider_and_model(
    provider: Optional[str] = None,
    model: Optional[str] = None,
    token: Optional[str] = None,
) -> tuple[str, str, str, Optional[str]]:
    """Determina credenciais, provedor, modelo e base_url para operações omnichannel.
    
    Retorna: (final_provider, final_model, final_token, base_url)
    """
    final_provider, final_token, final_model, base_url = _resolve_credentials(
        token=token or "",
        provider=provider or "",
        model=model or "",
    )
    return final_provider, final_model, final_token, base_url


def _extract_json_block(raw_text: str) -> dict[str, Any]:
    """Extrai e decodifica bloco JSON válido de respostas textuais da IA."""
    return _clean_json_response(raw_text)


async def generate_omnichannel_audit(
    search_data: dict[str, Any],
    provider: Optional[str] = None,
    model: Optional[str] = None,
    token: Optional[str] = None,
    fallback_token: Optional[str] = None,
) -> dict[str, Any]:
    """Gera diagnóstico e estratégia transmídia comparativa (360°) usando IA."""
    _ensure_env()
    final_provider, final_model, final_token, base_url = _resolve_provider_and_model(provider, model, token)

    query = search_data.get("query", "")
    mode = search_data.get("search_mode", "topic")
    platforms = search_data.get("platforms_requested", [])
    summaries = search_data.get("platform_summaries", {})
    posts = search_data.get("posts", [])[:15]  # Top 15 posts para contexto
    total_views = search_data.get("total_views", 0)
    total_inter = search_data.get("total_interactions", 0)

    # Destilação de contexto dos posts
    distilled_posts = [
        {
            "platform": p.get("platform"),
            "author": p.get("author_username"),
            "title_or_text": (p.get("title") or p.get("content", ""))[:120],
            "views": p.get("views"),
            "likes": p.get("likes"),
            "comments": p.get("comments_count"),
            "engagement_rate": p.get("engagement_rate"),
        }
        for p in posts
    ]

    prompt = f"""Você é o Estrategista-Chefe de Inteligência Transmídia e Crescimento Omnichannel da plataforma.
Realize uma auditoria analítica profunda sobre a busca realizada:

[Dados da Consulta]
- Modo: {'Análise de Perfil / Criador' if mode == 'profile' else 'Social Listening / Palavra-Chave'}
- Termo / Alvo: {query}
- Redes Analisadas: {', '.join(platforms)}
- Volume Total Agregado: {total_views:,} visualizações estimadas e {total_inter:,} interações diretas.

[Resumo por Plataforma]
{json.dumps(summaries, ensure_ascii=False, indent=2)}

[Amostra dos Principais Conteúdos Encontrados]
{json.dumps(distilled_posts, ensure_ascii=False, indent=2)}

Retorne um JSON ESTRUTURADO rigoroso com o seguinte schema exato:
{{
  "omnichannel_score": 85,
  "score_rationale": "Justificativa analítica da nota de 0 a 100 com base em ressonância e autoridade",
  "executive_summary": "Resumo executivo de alto impacto em 2 parágrafos sobre a presença e percepção pública",
  "cross_platform_comparison": [
    {{
      "platform": "nome_da_rede",
      "resonance": "Alta / Média / Baixa",
      "audience_sentiment": "Positivo / Crítico / Curioso",
      "key_strength": "Principal ponto forte identificado",
      "main_bottleneck": "Gargalo ou oportunidade perdida"
    }}
  ],
  "content_repurpose_ideas": [
    {{
      "source_platform": "rede de origem (ex: Reddit)",
      "target_platform": "rede de destino (ex: TikTok / Reels)",
      "concept": "Conceito criativo de adaptação",
      "hook_3s": "Gancho magnético de abertura para prender atenção",
      "cta": "Chamada para ação de alta conversão"
    }}
  ],
  "strategic_recommendations": [
    "Recomendação prioritária 1",
    "Recomendação prioritária 2",
    "Recomendação prioritária 3"
  ]
}}"""

    system_instruction = (
        "Você é um consultor executivo sênior de inteligência em mídias sociais e growth transmídia. "
        "Forneça análises de alto nível, fundamentadas e diretamente acionáveis em Português."
    )

    raw_output, meta = await _execute_llm(
        system_instruction=system_instruction,
        prompt=prompt,
        provider=final_provider,
        token=final_token,
        model=final_model,
        base_url=base_url,
        json_mode=True,
        fallback_token=fallback_token or "",
    )

    parsed = _extract_json_block(raw_output)
    meta["query"] = query
    meta["search_mode"] = mode
    return {
        "report": parsed,
        "meta": meta,
    }


async def chat_omnichannel(
    search_data: dict[str, Any],
    messages: list[dict[str, str]],
    provider: Optional[str] = None,
    model: Optional[str] = None,
    token: Optional[str] = None,
    fallback_token: Optional[str] = None,
) -> dict[str, Any]:
    """Chat consultor interativo contextualizado com dados da busca multiplataforma."""
    _ensure_env()
    final_provider, final_model, final_token, base_url = _resolve_provider_and_model(provider, model, token)

    query = search_data.get("query", "")
    mode = search_data.get("search_mode", "topic")
    summaries = search_data.get("platform_summaries", {})
    posts_sample = search_data.get("posts", [])[:8]

    system_instruction = f"""Você é o Consultor Estratégico Omnichannel da plataforma.
Você tem acesso aos dados consolidados de uma busca multiplataforma para o termo/perfil '{query}' (modo={mode}).

Métricas por plataforma:
{json.dumps(summaries, ensure_ascii=False, indent=2)}

Amostra de posts relevantes:
{json.dumps([{'p': p.get('platform'), 'auth': p.get('author_username'), 'text': p.get('content')[:80], 'views': p.get('views'), 'likes': p.get('likes')} for p in posts_sample], ensure_ascii=False)}

Diretrizes:
- Responda em Português de forma perspicaz, direta e prática.
- Sugira táticas concretas de conteúdo, cruzamento de públicos entre redes e mitigação de crises."""

    reply, meta = await _execute_llm(
        system_instruction=system_instruction,
        chat_messages=messages,
        provider=final_provider,
        token=final_token,
        model=final_model,
        base_url=base_url,
        json_mode=False,
        fallback_token=fallback_token or "",
    )

    return {
        "reply": reply,
        "meta": meta,
    }

