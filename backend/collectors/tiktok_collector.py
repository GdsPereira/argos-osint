"""Coletor Multi-Estratégia para TikTok.

Suporta:
- Análise de criadores de conteúdo (perfil, métricas, vídeos).
- Busca por tópicos, hashtags e tendências em vídeo curto.
- Integração via Apify Actor (clockworks/free-tiktok-scraper ou clockworks/tiktok-profile-scraper).
"""
from __future__ import annotations

import logging
import os
from typing import Any, Optional

from collectors.base import MediaType, PlatformType, UnifiedPost, UnifiedProfile

logger = logging.getLogger("argos.collectors.tiktok")

APIFY_ACTOR_TIKTOK = os.getenv("APIFY_TIKTOK_ACTOR", "clockworks/free-tiktok-scraper")


class TikTokCollector:
    """Coletor de vídeos curtos, engajamento e métricas virais do TikTok."""
    platform = PlatformType.TIKTOK

    @classmethod
    def search_topic(cls, query: str, limit: int = 25, token: str = "") -> list[UnifiedPost]:
        """Busca vídeos virais do TikTok por palavra-chave ou hashtag."""
        logger.info(f"[TikTok] Buscando vídeos para '{query}' (limit={limit})")
        apify_token = token.strip() or os.getenv("APIFY_TOKEN", "")
        if not apify_token:
            logger.warning("[TikTok] Token Apify não informado para busca no TikTok.")
            return []

        try:
            from apify_client import ApifyClient
            client = ApifyClient(apify_token)

            # Tenta busca por hashtag se começar com # ou por query livre
            is_hashtag = query.startswith("#")
            clean_term = query.lstrip("#")

            run_input: dict[str, Any] = {
                "resultsPerPage": min(limit, 50),
            }
            if is_hashtag:
                run_input["hashtags"] = [clean_term]
            else:
                run_input["searchQueries"] = [query]

            run = client.actor(APIFY_ACTOR_TIKTOK).call(run_input=run_input, timeout_secs=100)
            if not run or run.get("status") != "SUCCEEDED":
                logger.warning(f"[TikTok] Execução do ator retornou status: {run.get('status') if run else 'Falha'}")
                return []

            items = list(client.dataset(run["defaultDatasetId"]).iterate_items())
            posts: list[UnifiedPost] = []
            for item in items:
                p = cls._convert_tiktok_item(item)
                if p:
                    posts.append(p)
            return posts
        except Exception as exc:
            logger.error(f"[TikTok] Erro na coleta do TikTok: {exc}", exc_info=True)
            return []

    @classmethod
    def get_profile(cls, username: str, max_posts: int = 25, token: str = "") -> tuple[UnifiedProfile, list[UnifiedPost]]:
        """Busca perfil de criador do TikTok e seus últimos vídeos publicados."""
        clean_user = username.strip().lstrip("@")
        logger.info(f"[TikTok] Coletando perfil de criador: @{clean_user}")

        apify_token = token.strip() or os.getenv("APIFY_TOKEN", "")
        if not apify_token:
            logger.warning("[TikTok] Token Apify não informado.")
            return UnifiedProfile(platform=PlatformType.TIKTOK, username=clean_user), []

        try:
            from apify_client import ApifyClient
            client = ApifyClient(apify_token)

            run_input = {
                "profiles": [clean_user],
                "resultsPerPage": min(max_posts, 50),
            }

            run = client.actor(APIFY_ACTOR_TIKTOK).call(run_input=run_input, timeout_secs=100)
            items = list(client.dataset(run["defaultDatasetId"]).iterate_items()) if run else []

            posts: list[UnifiedPost] = []
            for item in items:
                p = cls._convert_tiktok_item(item)
                if p:
                    posts.append(p)

            author_name = posts[0].author_name if posts else clean_user
            author_avatar = posts[0].author_avatar if posts else None

            total_views = sum(p.views for p in posts)
            avg_eng = sum(p.engagement_rate for p in posts) / len(posts) if posts else 0.0

            profile = UnifiedProfile(
                platform=PlatformType.TIKTOK,
                username=clean_user,
                full_name=author_name,
                avatar_url=author_avatar,
                url=f"https://www.tiktok.com/@{clean_user}",
                posts_count=len(posts),
                total_views=total_views,
                avg_engagement_rate=round(avg_eng, 2),
            )
            return profile, posts
        except Exception as exc:
            logger.error(f"[TikTok] Falha ao coletar perfil: {exc}")
            return UnifiedProfile(platform=PlatformType.TIKTOK, username=clean_user), []

    @classmethod
    def _convert_tiktok_item(cls, item: dict[str, Any]) -> Optional[UnifiedPost]:
        video_id = str(item.get("id") or item.get("videoId") or "")
        url = item.get("webVideoUrl") or item.get("videoUrl") or f"https://www.tiktok.com/video/{video_id}"
        text = item.get("text") or item.get("desc") or ""

        author_meta = item.get("authorMeta") or item.get("author") or {}
        author_user = author_meta.get("name") or author_meta.get("uniqueId") or "tiktok_user"
        author_name = author_meta.get("nickName") or author_meta.get("nickname") or author_user
        author_avatar = author_meta.get("avatar")

        views = int(item.get("playCount") or item.get("views") or 0)
        likes = int(item.get("diggCount") or item.get("likes") or 0)
        comments = int(item.get("commentCount") or item.get("comments") or 0)
        shares = int(item.get("shareCount") or item.get("shares") or 0)
        saves = int(item.get("collectCount") or 0)

        interactions = likes + comments + shares + saves
        engagement_rate = round((interactions / views * 100), 2) if views > 0 else 0.0

        video_meta = item.get("videoMeta") or {}
        thumbnail = video_meta.get("coverUrl") or item.get("cover") or ""

        return UnifiedPost(
            id=f"tt_{video_id}" if video_id else f"tt_{hash(url)}",
            platform=PlatformType.TIKTOK,
            url=url,
            author_username=author_user,
            author_name=author_name,
            author_avatar=author_avatar,
            title=text[:80] + ("..." if len(text) > 80 else ""),
            content=text,
            media_type=MediaType.SHORT_VIDEO,
            thumbnail_url=thumbnail,
            published_at=str(item.get("createTime") or ""),
            views=views,
            likes=likes,
            comments_count=comments,
            shares_count=shares,
            saves_count=saves,
            engagement_rate=engagement_rate,
            extra={
                "music": item.get("musicMeta", {}).get("musicName"),
                "duration": video_meta.get("duration"),
            },
        )
