"""Coletor Multi-Estratégia para Threads (Meta).

Suporta:
- Monitoramento de conversas públicas e menções.
- Análise de perfis de criadores integrados ao ecossistema Meta.
- Integração via Apify Actor (barvian/threads-scraper).
"""
from __future__ import annotations

import logging
import os
from typing import Any, Optional

from collectors.base import MediaType, PlatformType, UnifiedPost, UnifiedProfile

logger = logging.getLogger("argos.collectors.threads")

APIFY_ACTOR_THREADS = os.getenv("APIFY_THREADS_ACTOR", "barvian/threads-scraper")


class ThreadsCollector:
    """Coletor da rede social Threads da Meta."""
    platform = PlatformType.THREADS

    @classmethod
    def search_topic(cls, query: str, limit: int = 25, token: str = "") -> list[UnifiedPost]:
        """Busca threads públicas por palavra-chave ou termo."""
        logger.info(f"[Threads] Buscando posts para '{query}' (limit={limit})")
        apify_token = token.strip() or os.getenv("APIFY_TOKEN", "")
        if not apify_token:
            return []

        try:
            from apify_client import ApifyClient
            client = ApifyClient(apify_token)

            run_input = {
                "search": query,
                "maxPosts": min(limit, 50),
            }

            run = client.actor(APIFY_ACTOR_THREADS).call(run_input=run_input, timeout_secs=90)
            items = list(client.dataset(run["defaultDatasetId"]).iterate_items()) if run else []

            posts: list[UnifiedPost] = []
            for item in items:
                p = cls._convert_threads_item(item)
                if p:
                    posts.append(p)
            return posts
        except Exception as exc:
            logger.error(f"[Threads] Erro na coleta do Threads: {exc}", exc_info=True)
            return []

    @classmethod
    def get_profile(cls, username: str, max_posts: int = 25, token: str = "") -> tuple[UnifiedProfile, list[UnifiedPost]]:
        """Busca histórico de threads e perfil de usuário."""
        clean_user = username.strip().lstrip("@")
        apify_token = token.strip() or os.getenv("APIFY_TOKEN", "")
        if not apify_token:
            return UnifiedProfile(platform=PlatformType.THREADS, username=clean_user), []

        try:
            from apify_client import ApifyClient
            client = ApifyClient(apify_token)

            run_input = {
                "profiles": [clean_user],
                "maxPosts": min(max_posts, 50),
            }

            run = client.actor(APIFY_ACTOR_THREADS).call(run_input=run_input, timeout_secs=90)
            items = list(client.dataset(run["defaultDatasetId"]).iterate_items()) if run else []

            posts: list[UnifiedPost] = []
            for item in items:
                p = cls._convert_threads_item(item)
                if p:
                    posts.append(p)

            author_name = posts[0].author_name if posts else clean_user
            author_avatar = posts[0].author_avatar if posts else None

            total_views = sum(p.views for p in posts)
            avg_eng = sum(p.engagement_rate for p in posts) / len(posts) if posts else 0.0

            profile = UnifiedProfile(
                platform=PlatformType.THREADS,
                username=clean_user,
                full_name=author_name,
                avatar_url=author_avatar,
                url=f"https://www.threads.net/@{clean_user}",
                posts_count=len(posts),
                total_views=total_views,
                avg_engagement_rate=round(avg_eng, 2),
            )
            return profile, posts
        except Exception as exc:
            logger.error(f"[Threads] Erro ao buscar perfil Threads: {exc}")
            return UnifiedProfile(platform=PlatformType.THREADS, username=clean_user), []

    @classmethod
    def _convert_threads_item(cls, item: dict[str, Any]) -> Optional[UnifiedPost]:
        post_id = str(item.get("id") or item.get("pk") or "")
        text = item.get("text") or item.get("caption") or ""
        url = item.get("url") or f"https://www.threads.net/t/{post_id}"

        user = item.get("user") or {}
        author_user = user.get("username") or "threads_user"
        author_name = user.get("full_name") or author_user
        author_avatar = user.get("profile_pic_url")

        likes = int(item.get("like_count") or item.get("likes") or 0)
        replies = int(item.get("reply_count") or item.get("replies") or 0)
        reposts = int(item.get("repost_count") or 0)
        views = max((likes + replies) * 18, 100)

        interactions = likes + replies + reposts
        engagement = round((interactions / views * 100), 2) if views > 0 else 0.0

        return UnifiedPost(
            id=f"th_{post_id}" if post_id else f"th_{hash(url)}",
            platform=PlatformType.THREADS,
            url=url,
            author_username=author_user,
            author_name=author_name,
            author_avatar=author_avatar,
            title=text[:60] + ("..." if len(text) > 60 else ""),
            content=text,
            media_type=MediaType.TEXT,
            published_at=str(item.get("published_on") or item.get("created_at") or ""),
            views=views,
            likes=likes,
            comments_count=replies,
            shares_count=reposts,
            engagement_rate=engagement,
            extra={
                "likes": likes,
                "replies": replies,
            },
        )
