"""Coleta otimizada via Apify com Pipeline Multi-Actor Assíncrono.

Recursos:
  - Paralelismo entre extração de perfil e postagens (reduz latência pela metade).
  - Actors complementares para stories e aprofundamento de comentários.
  - Proteção estrita contra timeouts HTTP 504 (timeouts granulares por actor).
  - Degradação graciosa em falhas de actors não-críticos (stories/comentários profundos).
  - 100% de compatibilidade com os modelos e interfaces do frontend.
"""
from __future__ import annotations

import asyncio
import logging
import os
import re
import time
from datetime import timedelta
from typing import Any, Callable, Optional

from apify_client import ApifyClient, ApifyClientAsync

logger = logging.getLogger("insta_analyzer")

ACTOR_PROFILE_POSTS = os.getenv("APIFY_ACTOR", "apify/instagram-scraper")
ACTOR_COMMENTS = os.getenv("APIFY_COMMENTS_ACTOR", "apify/instagram-comments-scraper")
ACTOR_STORIES = os.getenv("APIFY_STORIES_ACTOR", "goat255/instagram-stories-highlights-scraper")
ACTOR_HIGHLIGHTS = os.getenv("APIFY_HIGHLIGHTS_ACTOR", "goat255/instagram-stories-highlights-scraper")

DEFAULT_PER_ACTOR_TIMEOUT_SECS = int(os.getenv("APIFY_ACTOR_TIMEOUT_SECS", "90"))
DEFAULT_PIPELINE_TIMEOUT_SECS = int(os.getenv("APIFY_TIMEOUT_SECS", "120"))

TIPOS = {
    "Image": "GraphImage",
    "Video": "GraphVideo",
    "Sidecar": "GraphSidecar",
    "Story": "GraphStory",
}


def _clean_username(username: str) -> str:
    s = (username or "").strip()
    m = re.search(r"(?:https?://)?(?:www\.)?instagram\.com/([A-Za-z0-9_.]+)", s)
    if m:
        return m.group(1).strip("/@")
    return s.lstrip("@").strip("/")


def _url(username: str) -> str:
    clean = _clean_username(username)
    return f"https://www.instagram.com/{clean}/"


def _hashtags(text: str) -> list[str]:
    return [h.lower() for h in re.findall(r"#(\w+)", text or "")]


def _mentions(text: str) -> list[str]:
    return [m.lower() for m in re.findall(r"@([\w.]+)", text or "")]


def _parse_profile(d: dict, fallback_username: str) -> dict:
    bio = d.get("biography") or ""
    # Múltiplos links externos ou link único
    ext_urls = []
    for u in d.get("externalUrls") or []:
        if isinstance(u, dict) and u.get("url"):
            ext_urls.append(u.get("url"))
        elif isinstance(u, str) and u.strip():
            ext_urls.append(u.strip())
    if not ext_urls and (d.get("externalUrl") or d.get("external_url")):
        ext_urls.append(d.get("externalUrl") or d.get("external_url"))

    # Perfis similares sugeridos pelo Instagram
    similares = []
    for s in d.get("relatedProfiles") or d.get("similarAccounts") or []:
        u_name = s.get("username") if isinstance(s, dict) else s
        if u_name and isinstance(u_name, str) and u_name not in similares:
            similares.append(u_name.lstrip("@"))

    # Contatos públicos comerciais
    email = d.get("publicEmail") or d.get("businessEmail") or d.get("email")
    telefone = d.get("publicPhoneNumber") or d.get("businessPhoneNumber") or d.get("contactPhoneNumber")
    endereco = d.get("businessAddressJson") or d.get("businessAddress")

    return {
        "username": d.get("username") or fallback_username,
        "user_id": d.get("id") or d.get("pk"),
        "nome_completo": d.get("fullName") or d.get("full_name"),
        "bio": bio,
        "link_externo": ext_urls[0] if ext_urls else None,
        "links_externos": ext_urls,
        "seguidores": d.get("followersCount") or d.get("followers") or 0,
        "seguindo": d.get("followsCount") or d.get("following") or 0,
        "posts": d.get("postsCount") or d.get("posts_count") or d.get("mediaCount") or 0,
        "igtv": d.get("igtvVideoCount") or d.get("igtv_count") or 0,
        "privado": bool(
            d.get("private")
            if d.get("private") is not None
            else (d.get("isPrivate") if d.get("isPrivate") is not None else d.get("is_private"))
        ),
        "verificado": bool(
            d.get("verified")
            if d.get("verified") is not None
            else (d.get("isVerified") if d.get("isVerified") is not None else d.get("is_verified"))
        ),
        "conta_business": bool(
            d.get("isBusinessAccount")
            if d.get("isBusinessAccount") is not None
            else (d.get("is_business_account") if d.get("is_business_account") is not None else d.get("isBusiness"))
        ),
        "categoria_business": (
            d.get("businessCategoryName")
            or d.get("business_category_name")
            or d.get("categoryName")
            or d.get("category_name")
        ),
        "foto_perfil": (
            d.get("profilePicUrlHD")
            or d.get("profile_pic_url_hd")
            or d.get("profilePicUrl")
            or d.get("profile_pic_url")
            or (d.get("owner", {}).get("profile_pic_url") if isinstance(d.get("owner"), dict) else None)
        ),
        "bio_hashtags": _hashtags(bio),
        "bio_mencoes": _mentions(bio),
        "email": email.strip() if isinstance(email, str) and email.strip() else None,
        "telefone": telefone.strip() if isinstance(telefone, str) and telefone.strip() else None,
        "endereco": endereco if isinstance(endereco, (str, dict)) else None,
        "perfis_similares": similares[:10],
        "destaques_count": d.get("highlightReelCount") or len(d.get("highlights") or []) or 0,
    }


def _parse_post(p: dict) -> dict:
    code = p.get("shortCode") or p.get("shortcode") or p.get("code") or ""
    typ = p.get("type") or ""
    likes = p.get("likesCount") if p.get("likesCount") is not None else p.get("likes")
    caption = p.get("caption") or ""
    tags = p.get("hashtags") or _hashtags(caption)
    mentions = p.get("mentions") or _mentions(caption)
    tagged = [
        t.get("username") if isinstance(t, dict) else t
        for t in (p.get("taggedUsers") or p.get("tagged_users") or [])
    ]
    
    # Extração de trilha sonora / áudio de Reels
    music_info = p.get("musicInfo") or p.get("music_info") or {}
    if not isinstance(music_info, dict):
        music_info = {}
    song_name = (
        music_info.get("songName")
        or music_info.get("song_name")
        or music_info.get("title")
        or p.get("songName")
        or p.get("song_name")
    )
    artist_name = (
        music_info.get("artistName")
        or music_info.get("artist_name")
        or music_info.get("artist")
        or p.get("artistName")
        or p.get("artist_name")
    )

    # Colaboradores / Co-autores
    colabs = [
        c.get("username") if isinstance(c, dict) else c
        for c in (p.get("coauthorProducers") or [])
        if c
    ]

    plays = p.get("videoPlayCount") or p.get("videoViewCount") or p.get("viewCount")

    return {
        "shortcode": code,
        "url": p.get("url") or f"https://www.instagram.com/p/{code}/",
        "data": p.get("timestamp") or p.get("takenAt") or p.get("date"),
        "tipo": TIPOS.get(typ, typ),
        "is_video": typ == "Video" or bool(p.get("videoUrl") or p.get("video_url") or p.get("isVideo")),
        "visualizacoes_video": p.get("videoViewCount") or plays,
        "plays_video": plays,
        "duracao_video": p.get("videoDuration") or p.get("video_duration"),
        "curtidas": likes if likes is not None else -1,
        "comentarios": p.get("commentsCount") or p.get("comments") or 0,
        "legenda": caption,
        "hashtags": tags,
        "mencoes": mentions,
        "marcados": tagged,
        "local": p.get("locationName") or p.get("location_name"),
        "patrocinado": p.get("paidPartnership") or p.get("is_paid_partnership"),
        "n_midias": len(p.get("childPosts") or p.get("images") or p.get("carousel_media") or []) or 1,
        "fixado": bool(p.get("isPinned") or p.get("is_pinned")),
        "musica": song_name,
        "artista": artist_name,
        "colabs": colabs,
    }


def _parse_comment(c: dict, shortcode: str = "") -> Optional[dict]:
    text = c.get("text") or c.get("caption") or ""
    if not text.strip():
        return None
    code = shortcode or c.get("shortCode") or c.get("postCode") or c.get("code") or ""
    if not code and c.get("postUrl"):
        m = re.search(r"/(?:p|reel|reels)/([^/?#]+)", c.get("postUrl", ""))
        if m:
            code = m.group(1)
    author = (
        c.get("ownerUsername")
        or (c.get("owner") or {}).get("username")
        or c.get("username")
        or c.get("user")
        or ""
    )
    return {
        "shortcode": code,
        "autor": author,
        "texto": text,
        "data": c.get("timestamp") or c.get("created_at"),
        "curtidas": c.get("likesCount") or c.get("like_count") or 0,
    }


def _parse_story(s: dict) -> dict:
    typ = s.get("type") or "Story"
    return {
        "id": s.get("id"),
        "shortcode": s.get("shortCode") or s.get("shortcode") or s.get("id") or "",
        "url": s.get("url") or s.get("displayUrl") or s.get("display_url") or s.get("mediaUrl") or s.get("imageUrl"),
        "video_url": s.get("videoUrl") or s.get("video_url"),
        "data": s.get("timestamp") or s.get("takenAt") or s.get("created_at"),
        "tipo": TIPOS.get(typ, typ),
        "is_video": typ == "Video" or bool(s.get("videoUrl") or s.get("video_url") or s.get("isVideo")),
        "expira_em": s.get("expiringAt") or s.get("expiring_at") or s.get("expiresAt"),
        "visualizacoes": s.get("viewCount") or s.get("viewsCount") or s.get("view_count"),
        "mentions": s.get("mentions") or [],
        "hashtags": s.get("hashtags") or [],
    }


def _parse_highlight_item(s: dict, hl_id: str = "", hl_title: str = "") -> dict:
    """Extrai e normaliza uma mídia individual (story) contida dentro de um destaque."""
    if not isinstance(s, dict):
        return {}
    typ = s.get("type") or s.get("mediaType") or ("Video" if s.get("videoUrl") or s.get("video_url") or s.get("isVideo") else "Image")
    is_vid = typ in ("Video", "GraphVideo") or bool(s.get("videoUrl") or s.get("video_url") or s.get("isVideo"))

    media_url = (
        s.get("videoUrl")
        or s.get("video_url")
        or s.get("mediaUrl")
        or s.get("media")
        or s.get("displayUrl")
        or s.get("display_url")
        or s.get("imageUrl")
        or s.get("url")
        or s.get("downloadUrl")
        or ""
    )
    thumb_url = (
        s.get("thumbnail")
        or s.get("thumbnailUrl")
        or s.get("thumbnail_url")
        or s.get("displayUrl")
        or s.get("display_url")
        or s.get("coverUrl")
        or s.get("coverImageUrl")
        or media_url
    )

    # Extrai link de figurinha / sticker se houver
    link_sticker = ""
    sticker_info = s.get("storyLink") or s.get("linkSticker") or s.get("link_sticker") or s.get("link")
    if isinstance(sticker_info, dict):
        link_sticker = sticker_info.get("url") or sticker_info.get("link") or ""
    elif isinstance(sticker_info, str):
        link_sticker = sticker_info
    elif isinstance(s.get("story_link_stickers"), list) and s.get("story_link_stickers"):
        first_sticker = s["story_link_stickers"][0]
        if isinstance(first_sticker, dict):
            link_sticker = first_sticker.get("story_link", {}).get("url") or first_sticker.get("url") or ""

    ts = s.get("timestamp") or s.get("takenAt") or s.get("taken_at") or s.get("date") or s.get("created_at")
    caption = s.get("caption") or s.get("text") or s.get("captionText") or ""

    return {
        "id": str(s.get("id") or s.get("pk") or s.get("storyId") or s.get("shortcode") or "").strip(),
        "type": "video" if is_vid else "photo",
        "tipo": "GraphVideo" if is_vid else "GraphImage",
        "is_video": is_vid,
        "media_url": media_url,
        "video_url": s.get("videoUrl") or s.get("video_url") or (media_url if is_vid else None),
        "thumbnail_url": thumb_url,
        "timestamp": ts,
        "data": ts,
        "caption": caption,
        "legenda": caption,
        "link_sticker": link_sticker,
        "highlight_id": hl_id,
        "highlight_title": hl_title,
    }


async def _run_actor_async(
    client: ApifyClientAsync,
    actor_id: str,
    run_input: dict,
    timeout_secs: int = DEFAULT_PER_ACTOR_TIMEOUT_SECS,
    actor_label: str = "",
) -> list[dict]:
    """Executa um actor de forma assíncrona com controle rigoroso de timeout."""
    logger.info(f"[Apify] Chamando actor '{actor_id}' ({actor_label}) com timeout de {timeout_secs}s...")
    t0 = time.time()
    try:
        run = await asyncio.wait_for(
            client.actor(actor_id).call(
                run_input=run_input,
                wait_duration=timedelta(seconds=timeout_secs),
            ),
            timeout=timeout_secs + 5,
        )
    except asyncio.TimeoutError:
        logger.error(f"[Apify] Timeout de {timeout_secs}s excedido no actor '{actor_id}' ({actor_label}).")
        raise TimeoutError(
            f"Timeout de {timeout_secs}s excedido aguardando actor '{actor_id}' ({actor_label})."
        )
    except Exception as e:
        logger.error(f"[Apify] Falha na chamada do actor '{actor_id}' ({actor_label}): {e}")
        raise RuntimeError(
            f"Falha na chamada do actor '{actor_id}' ({actor_label}): {e}"
        ) from e

    if run is None:
        logger.error(f"[Apify] Actor '{actor_id}' ({actor_label}) não retornou execução (None).")
        raise TimeoutError(
            f"Timeout de {timeout_secs}s excedido: Actor '{actor_id}' ({actor_label}) não concluiu dentro do tempo limite."
        )

    run_status = getattr(run, "status", None) or (run.get("status") if isinstance(run, dict) else None)
    if run_status in ("READY", "RUNNING", "TIMING-OUT", "TIMED-OUT"):
        logger.error(f"[Apify] Actor '{actor_id}' ({actor_label}) não concluiu a tempo (status: {run_status}).")
        raise TimeoutError(
            f"Timeout de {timeout_secs}s excedido: Actor '{actor_id}' ({actor_label}) não concluiu a tempo (status: {run_status})."
        )
    if run_status in ("FAILED", "ABORTED"):
        status_msg = getattr(run, "status_message", "") or (run.get("status_message", "") if isinstance(run, dict) else "")
        logger.error(f"[Apify] Actor '{actor_id}' ({actor_label}) falhou: {status_msg}")
        raise RuntimeError(
            f"Actor '{actor_id}' ({actor_label}) finalizou com falha ({run_status}): {status_msg}"
        )

    dataset_id = (
        getattr(run, "default_dataset_id", None)
        or (run.get("default_dataset_id") if isinstance(run, dict) else None)
        or (run.get("defaultDatasetId") if isinstance(run, dict) else None)
    )
    if not dataset_id:
        logger.error(f"[Apify] Actor '{actor_id}' ({actor_label}) sem dataset associado.")
        raise RuntimeError(f"Actor '{actor_id}' ({actor_label}) sem dataset associado: {run!r}")

    items = []
    try:
        async for item in client.dataset(dataset_id).iterate_items():
            if isinstance(item, dict):
                items.append(item)
    except Exception as e:
        logger.error(f"[Apify] Erro ao iterar itens do dataset '{dataset_id}': {e}")
        raise RuntimeError(
            f"Erro ao ler dataset '{dataset_id}' do actor '{actor_id}' ({actor_label}): {e}"
        ) from e

    elapsed = time.time() - t0
    logger.info(
        f"[Apify] Actor '{actor_id}' ({actor_label}) concluído com sucesso em {elapsed:.1f}s. {len(items)} itens recebidos."
    )
    return items


def _run_coroutine_sync(coro):
    """Executa corrotina em contexto síncrono com segurança para loops existentes."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            return pool.submit(lambda: asyncio.run(coro)).result()
    else:
        return asyncio.run(coro)


class ApifyPipeline:
    """Orquestrador do pipeline de múltiplos actors assíncronos da Apify."""

    def __init__(
        self,
        token: str,
        actor_profile_posts: str = ACTOR_PROFILE_POSTS,
        actor_comments: str = ACTOR_COMMENTS,
        actor_stories: str = ACTOR_STORIES,
        actor_highlights: str = ACTOR_HIGHLIGHTS,
        actor_timeout_secs: int = DEFAULT_PER_ACTOR_TIMEOUT_SECS,
        pipeline_timeout_secs: int = DEFAULT_PIPELINE_TIMEOUT_SECS,
    ):
        self.token = token.strip()
        self.actor_profile_posts = actor_profile_posts
        self.actor_comments = actor_comments
        self.actor_stories = actor_stories
        self.actor_highlights = actor_highlights
        self.actor_timeout_secs = actor_timeout_secs
        self.pipeline_timeout_secs = pipeline_timeout_secs

    async def fetch_profile_async(
        self, client: Optional[ApifyClientAsync] = None, username: str = ""
    ) -> dict:
        clean = _clean_username(username)
        if not clean:
            raise ValueError("Informe o perfil (@usuario).")
        cli = client or ApifyClientAsync(self.token)
        items = await _run_actor_async(
            cli,
            self.actor_profile_posts,
            run_input={
                "directUrls": [_url(clean)],
                "resultsType": "details",
                "resultsLimit": 1,
                "addParentData": False,
            },
            timeout_secs=self.actor_timeout_secs,
            actor_label="Profile",
        )
        if not items or items[0].get("error"):
            detalhe = items[0].get("errorDescription") if items else ""
            raise ValueError(f"Perfil não encontrado: {clean} ({detalhe})")
        return _parse_profile(items[0], clean)

    async def fetch_posts_async(
        self, client: Optional[ApifyClientAsync] = None, username: str = "", max_posts: int = 50
    ) -> tuple[list[dict], list[dict]]:
        clean = _clean_username(username)
        cli = client or ApifyClientAsync(self.token)
        items = await _run_actor_async(
            cli,
            self.actor_profile_posts,
            run_input={
                "directUrls": [_url(clean)],
                "resultsType": "posts",
                "resultsLimit": max_posts,
                "addParentData": False,
            },
            timeout_secs=self.actor_timeout_secs,
            actor_label="Posts",
        )
        posts: list[dict] = []
        latest_comments: list[dict] = []
        for p in items[:max_posts]:
            post_item = _parse_post(p)
            posts.append(post_item)
            for c in (p.get("latestComments") or []):
                parsed_c = _parse_comment(c, post_item["shortcode"])
                if parsed_c:
                    latest_comments.append(parsed_c)
        return posts, latest_comments

    async def fetch_stories_async(
        self, client: Optional[ApifyClientAsync] = None, username: str = ""
    ) -> list[dict]:
        """Extrai stories usando o actor complementar configurado com fallback gracioso."""
        clean = _clean_username(username)
        cli = client or ApifyClientAsync(self.token)
        try:
            items = await _run_actor_async(
                cli,
                self.actor_stories,
                run_input={
                    "usernames": [clean],
                    "includeStories": True,
                    "includeHighlights": False,
                },
                timeout_secs=min(self.actor_timeout_secs, 45),
                actor_label="Stories",
            )
            out = []
            for s in items:
                if isinstance(s, dict) and not s.get("error"):
                    sub_stories = s.get("stories")
                    if isinstance(sub_stories, list):
                        for sub_s in sub_stories:
                            if isinstance(sub_s, dict):
                                out.append(_parse_story(sub_s))
                    else:
                        out.append(_parse_story(s))
            return out
        except Exception:
            return []

    async def fetch_comments_complementary_async(
        self,
        client: Optional[ApifyClientAsync] = None,
        post_urls: Optional[list[str]] = None,
        max_comments_total: int = 100,
    ) -> list[dict]:
        """Extrai comentários mais profundos via actor complementar de comentários."""
        if not post_urls:
            return []
        cli = client or ApifyClientAsync(self.token)
        urls_to_scrape = post_urls[:10]
        try:
            items = await _run_actor_async(
                cli,
                self.actor_comments,
                run_input={
                    "directUrls": urls_to_scrape,
                    "resultsLimit": max_comments_total,
                },
                timeout_secs=min(self.actor_timeout_secs, 45),
                actor_label="Comments",
            )
            parsed: list[dict] = []
            for c in items:
                if isinstance(c, dict) and not c.get("error"):
                    item = _parse_comment(c)
                    if item:
                        parsed.append(item)
            return parsed
        except Exception:
            if self.actor_comments != self.actor_profile_posts:
                try:
                    items = await _run_actor_async(
                        cli,
                        self.actor_profile_posts,
                        run_input={
                            "directUrls": urls_to_scrape,
                            "resultsType": "comments",
                            "resultsLimit": max_comments_total,
                        },
                        timeout_secs=min(self.actor_timeout_secs, 45),
                        actor_label="Comments-Fallback",
                    )
                    parsed = []
                    for c in items:
                        if isinstance(c, dict) and not c.get("error"):
                            item = _parse_comment(c)
                            if item:
                                parsed.append(item)
                    return parsed
                except Exception:
                    return []
    async def fetch_tagged_async(
        self, client: Optional[ApifyClientAsync] = None, username: str = "", limit: int = 15
    ) -> list[dict]:
        """Extrai posts onde o perfil foi marcado por terceiros / clientes (fallback gracioso)."""
        clean = _clean_username(username)
        cli = client or ApifyClientAsync(self.token)
        try:
            items = await _run_actor_async(
                cli,
                self.actor_profile_posts,
                run_input={
                    "directUrls": [f"https://www.instagram.com/{clean}/tagged/"],
                    "resultsType": "tagged",
                    "resultsLimit": limit,
                    "addParentData": False,
                },
                timeout_secs=min(self.actor_timeout_secs, 45),
                actor_label="Tagged",
            )
            return [_parse_post(p) for p in items if isinstance(p, dict) and not p.get("error")]
        except Exception as e:
            logger.info(f"[Apify] Tagged posts indisponíveis ou vazios para @{clean}: {e}")
            return []

    async def fetch_highlights_async(
        self, client: Optional[ApifyClientAsync] = None, username: str = "", limit: int = 20
    ) -> list[dict]:
        """Extrai destaques (highlights) do perfil com todos os conteúdos internos (mídias, vídeos, fotos)."""
        clean = _clean_username(username)
        cli = client or ApifyClientAsync(self.token)
        try:
            items = await _run_actor_async(
                cli,
                self.actor_highlights,
                run_input={
                    "usernames": [clean],
                    "includeStories": False,
                    "includeHighlights": True,
                    "expandHighlightItems": True,
                    "maxHighlightsPerUser": limit,
                },
                timeout_secs=min(self.actor_timeout_secs, 60),
                actor_label="Highlights",
            )
            out_by_id: dict[str, dict] = {}
            for item in items:
                if not isinstance(item, dict) or item.get("error"):
                    continue

                # Se o actor devolver a lista aninhada em 'highlights' (ex: goat255)
                h_list = item.get("highlights")
                if isinstance(h_list, list) and h_list:
                    for h in h_list:
                        if not isinstance(h, dict):
                            continue
                        raw_id = str(h.get("highlightId") or h.get("id") or "")
                        clean_id = raw_id.replace("highlight:", "").strip()
                        title = h.get("title") or h.get("highlightTitle") or ""
                        cover_url = (
                            h.get("coverImageUrl")
                            or h.get("coverUrl")
                            or (h.get("coverMedia", {}) or {}).get("displayUrl")
                        )
                        raw_stories = h.get("stories") or h.get("items") or h.get("media") or []
                        parsed_stories = []
                        if isinstance(raw_stories, list):
                            for s in raw_stories:
                                ps = _parse_highlight_item(s, hl_id=clean_id, hl_title=title)
                                if ps.get("media_url") or ps.get("id"):
                                    parsed_stories.append(ps)

                        m_count = h.get("mediaCount") or len(parsed_stories) or 0
                        h_url = f"https://www.instagram.com/stories/highlights/{clean_id}/" if clean_id else ""

                        if clean_id not in out_by_id:
                            out_by_id[clean_id] = {
                                "id": clean_id,
                                "title": title,
                                "cover": cover_url,
                                "coverImageUrl": cover_url,
                                "media_count": max(m_count, len(parsed_stories)),
                                "mediaCount": max(m_count, len(parsed_stories)),
                                "url": h_url,
                                "items": parsed_stories,
                            }
                        else:
                            if parsed_stories:
                                existing_ids = {x.get("id") for x in out_by_id[clean_id]["items"] if x.get("id")}
                                for ps in parsed_stories:
                                    if not ps.get("id") or ps.get("id") not in existing_ids:
                                        out_by_id[clean_id]["items"].append(ps)
                                total_items = len(out_by_id[clean_id]["items"])
                                out_by_id[clean_id]["media_count"] = max(out_by_id[clean_id]["media_count"], total_items)
                                out_by_id[clean_id]["mediaCount"] = out_by_id[clean_id]["media_count"]

                # Caso o actor devolva diretamente um highlight por item ou itens individuais de story
                elif item.get("highlightId") or item.get("highlightTitle") or item.get("coverUrl") or item.get("coverImageUrl"):
                    raw_id = str(item.get("highlightId") or item.get("id") or "")
                    clean_id = raw_id.replace("highlight:", "").strip()
                    title = item.get("title") or item.get("highlightTitle") or ""
                    cover_url = (
                        item.get("coverImageUrl")
                        or item.get("coverUrl")
                        or (item.get("coverMedia", {}) or {}).get("displayUrl")
                    )
                    h_url = f"https://www.instagram.com/stories/highlights/{clean_id}/" if clean_id else ""

                    if clean_id not in out_by_id:
                        out_by_id[clean_id] = {
                            "id": clean_id,
                            "title": title,
                            "cover": cover_url,
                            "coverImageUrl": cover_url,
                            "media_count": 0,
                            "mediaCount": 0,
                            "url": h_url,
                            "items": [],
                        }

                    # Verifica se o item possui stories aninhados
                    raw_stories = item.get("stories") or item.get("items") or item.get("media") or []
                    if isinstance(raw_stories, list) and raw_stories:
                        existing_ids = {x.get("id") for x in out_by_id[clean_id]["items"] if x.get("id")}
                        for s in raw_stories:
                            ps = _parse_highlight_item(s, hl_id=clean_id, hl_title=title)
                            if ps.get("media_url") or ps.get("id"):
                                if not ps.get("id") or ps.get("id") not in existing_ids:
                                    out_by_id[clean_id]["items"].append(ps)
                    else:
                        # O próprio item é um story individual com mídia
                        ps = _parse_highlight_item(item, hl_id=clean_id, hl_title=title)
                        if ps.get("media_url") or ps.get("id"):
                            existing_ids = {x.get("id") for x in out_by_id[clean_id]["items"] if x.get("id")}
                            if not ps.get("id") or ps.get("id") not in existing_ids:
                                out_by_id[clean_id]["items"].append(ps)

                    m_count = item.get("mediaCount") or len(out_by_id[clean_id]["items"]) or 0
                    out_by_id[clean_id]["media_count"] = max(out_by_id[clean_id]["media_count"], m_count, len(out_by_id[clean_id]["items"]))
                    out_by_id[clean_id]["mediaCount"] = out_by_id[clean_id]["media_count"]
                    if not out_by_id[clean_id]["cover"] and cover_url:
                        out_by_id[clean_id]["cover"] = cover_url
                        out_by_id[clean_id]["coverImageUrl"] = cover_url

            out = list(out_by_id.values())
            for h in out:
                total_items = len(h.get("items", []))
                if total_items > 0:
                    h["media_count"] = max(h.get("media_count", 0), total_items)
                    h["mediaCount"] = h["media_count"]
            return out
        except Exception as e:
            logger.warning(f"[Apify] Falha ao extrair highlights para @{clean}: {e}")
            return []

    async def execute_pipeline(
        self,
        username: str,
        max_posts: int = 50,
        with_comments: bool = False,
        comments_per_post: int = 50,
        with_stories: bool = False,
        with_tagged: bool = False,
        with_highlights: bool = False,
        progress: Optional[Callable[[str], None]] = None,
    ) -> tuple[dict, list[dict], list[dict], dict]:
        clean_user = _clean_username(username)
        if not clean_user:
            raise ValueError("Informe o perfil (@usuario).")

        async def _core() -> tuple[dict, list[dict], list[dict], dict]:
            client = ApifyClientAsync(self.token)
            logger.info(f"[Apify] Iniciando pipeline multi-actor assíncrono para @{clean_user} (max_posts={max_posts})...")
            if progress:
                progress(f"Disparando scrapers Apify em paralelo para @{clean_user} (perfil e {max_posts} posts)...")

            profile_task = asyncio.create_task(self.fetch_profile_async(client, clean_user))
            posts_task = asyncio.create_task(self.fetch_posts_async(client, clean_user, max_posts))

            stories_task = None
            if with_stories:
                logger.info(f"[Apify] Disparando actor de stories em paralelo para @{clean_user}...")
                stories_task = asyncio.create_task(self.fetch_stories_async(client, clean_user))

            tagged_task = None
            if with_tagged:
                logger.info(f"[Apify] Disparando raspagem de posts marcados para @{clean_user}...")
                tagged_task = asyncio.create_task(self.fetch_tagged_async(client, clean_user))

            highlights_task = None
            if with_highlights:
                logger.info(f"[Apify] Disparando raspagem de destaques (highlights) para @{clean_user}...")
                highlights_task = asyncio.create_task(self.fetch_highlights_async(client, clean_user))

            try:
                profile_info, (posts, latest_comments) = await asyncio.gather(profile_task, posts_task)
            except BaseException as exc:
                logger.error(f"[Apify] Falha durante extração de perfil/posts: {exc}")
                for t in (profile_task, posts_task, stories_task, tagged_task, highlights_task):
                    if t and not t.done():
                        t.cancel()
                raise

            logger.info(
                f"[Apify] Perfil @{clean_user} extraído: {profile_info.get('nome_completo')} "
                f"({profile_info.get('seguidores', 0)} seguidores, {profile_info.get('posts', 0)} posts)."
            )

            if progress:
                progress(
                    f"Perfil @{clean_user} e {len(posts)} posts carregados com sucesso. "
                    f"({profile_info.get('seguidores', 0):,} seguidores)."
                )

            if profile_info.get("privado"):
                for t in (stories_task, tagged_task, highlights_task):
                    if t and not t.done():
                        t.cancel()
                raise ValueError("Perfil privado: só é possível analisar perfis abertos.")

            # Coleta de Stories
            stories_data = []
            if stories_task:
                try:
                    stories_data = await stories_task
                except Exception as e:
                    logger.warning(f"[Apify] Falha nos stories: {e}")

            # Coleta de Tagged Posts
            tagged_data = []
            if tagged_task:
                try:
                    tagged_data = await tagged_task
                except Exception as e:
                    logger.warning(f"[Apify] Falha nos posts marcados: {e}")

            # Coleta de Highlights
            highlights_data = []
            if highlights_task:
                try:
                    highlights_data = await highlights_task
                except Exception as e:
                    logger.warning(f"[Apify] Falha nos destaques: {e}")

            # Coleta de Comentários
            final_comments = []
            if with_comments:
                seen_keys = set()
                for c in latest_comments[: max_posts * comments_per_post]:
                    k = (c.get("shortcode"), c.get("autor"), c.get("texto"))
                    if k not in seen_keys:
                        seen_keys.add(k)
                        final_comments.append(c)

                if (comments_per_post > 15 or len(final_comments) == 0) and posts:
                    all_post_urls = [p["url"] for p in posts if p.get("url")]
                    if all_post_urls:
                        if progress:
                            progress(f"Expandindo comentários via actor complementar ({len(all_post_urls[:10])} posts)...")
                        try:
                            deep_comments = await self.fetch_comments_complementary_async(
                                client,
                                all_post_urls,
                                max_comments_total=min(len(posts) * comments_per_post, 300),
                            )
                            for c in deep_comments:
                                k = (c.get("shortcode"), c.get("autor"), c.get("texto"))
                                if k not in seen_keys:
                                    seen_keys.add(k)
                                    final_comments.append(c)
                        except Exception as e:
                            logger.warning(f"[Apify] Falha no scraper complementar de comentários: {e}")

                if progress:
                    progress(f"Comentários consolidados: {len(final_comments)} comentários para análise.")

            extra = {
                "stories": stories_data,
                "stories_count": len(stories_data),
                "tagged_posts": tagged_data,
                "tagged_count": len(tagged_data),
                "highlights": highlights_data,
                "highlights_count": len(highlights_data),
                "highlight_media_count": sum(len(h.get("items", [])) for h in highlights_data),
                "contato": {
                    "email": profile_info.get("email"),
                    "telefone": profile_info.get("telefone"),
                    "endereco": profile_info.get("endereco"),
                },
                "perfis_similares": profile_info.get("perfis_similares", []),
            }

            return profile_info, posts, final_comments, extra

        try:
            return await asyncio.wait_for(_core(), timeout=self.pipeline_timeout_secs)
        except asyncio.TimeoutError:
            raise TimeoutError(
                f"Timeout do pipeline de {self.pipeline_timeout_secs}s excedido ao processar @{clean_user}."
            )

    def run_profile_sync(self, username: str) -> tuple[str, dict]:
        info = _run_coroutine_sync(self.fetch_profile_async(username=username))
        return info["username"], info

    def run_posts_sync(
        self,
        username: str,
        max_posts: int = 50,
        with_comments: bool = False,
        max_comments_per_post: int = 50,
        progress: Optional[Callable[[str], None]] = None,
    ) -> tuple[list[dict], list[dict]]:
        if progress:
            progress("Coletando posts na Apify...")
        posts, comments = _run_coroutine_sync(
            self.fetch_posts_async(username=username, max_posts=max_posts)
        )
        if not with_comments:
            comments = []
        else:
            comments = comments[: max_posts * max_comments_per_post]
        return posts, comments

    def run_pipeline_sync(
        self,
        username: str,
        max_posts: int = 50,
        with_comments: bool = False,
        comments_per_post: int = 50,
        with_stories: bool = False,
        with_tagged: bool = False,
        with_highlights: bool = False,
        progress: Optional[Callable[[str], None]] = None,
    ) -> tuple[dict, list[dict], list[dict], dict]:
        return _run_coroutine_sync(
            self.execute_pipeline(
                username=username,
                max_posts=max_posts,
                with_comments=with_comments,
                comments_per_post=comments_per_post,
                with_stories=with_stories,
                with_tagged=with_tagged,
                with_highlights=with_highlights,
                progress=progress,
            )
        )


# Funções de compatibilidade direta
def fetch_profile(token: str, username: str) -> tuple[str, dict]:
    pipeline = ApifyPipeline(token)
    return pipeline.run_profile_sync(username)


def fetch_posts(
    token: str,
    username: str,
    max_posts: int = 50,
    with_comments: bool = False,
    max_comments_per_post: int = 50,
    progress: Optional[Callable[[str], None]] = None,
) -> tuple[list[dict], list[dict]]:
    pipeline = ApifyPipeline(token)
    return pipeline.run_posts_sync(
        username=username,
        max_posts=max_posts,
        with_comments=with_comments,
        max_comments_per_post=max_comments_per_post,
        progress=progress,
    )


def run_pipeline(
    token: str,
    username: str,
    max_posts: int = 50,
    with_comments: bool = False,
    comments_per_post: int = 50,
    with_stories: bool = False,
    with_tagged: bool = False,
    with_highlights: bool = False,
    progress: Optional[Callable[[str], None]] = None,
) -> tuple[dict, list[dict], list[dict], dict]:
    pipeline = ApifyPipeline(token)
    return pipeline.run_pipeline_sync(
        username=username,
        max_posts=max_posts,
        with_comments=with_comments,
        comments_per_post=comments_per_post,
        with_stories=with_stories,
        with_tagged=with_tagged,
        with_highlights=with_highlights,
        progress=progress,
    )


async def run_pipeline_async(
    token: str,
    username: str,
    max_posts: int = 50,
    with_comments: bool = False,
    comments_per_post: int = 50,
    with_stories: bool = False,
    with_tagged: bool = False,
    with_highlights: bool = False,
    progress: Optional[Callable[[str], None]] = None,
    pipeline_timeout_secs: int = DEFAULT_PIPELINE_TIMEOUT_SECS,
) -> tuple[dict, list[dict], list[dict], dict]:
    pipeline = ApifyPipeline(token, pipeline_timeout_secs=pipeline_timeout_secs)
    return await pipeline.execute_pipeline(
        username=username,
        max_posts=max_posts,
        with_comments=with_comments,
        comments_per_post=comments_per_post,
        with_stories=with_stories,
        with_tagged=with_tagged,
        with_highlights=with_highlights,
        progress=progress,
    )
