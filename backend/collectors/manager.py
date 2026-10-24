"""Gerenciador e Orquestrador de Coleta Multiplataforma Paralela.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Callable, Optional

from collectors.base import (
    MultiSearchResult,
    PlatformSummary,
    PlatformType,
    UnifiedPost,
    UnifiedProfile,
)
from collectors.instagram_collector import InstagramCollector
from collectors.reddit_collector import RedditCollector
from collectors.threads_collector import ThreadsCollector
from collectors.tiktok_collector import TikTokCollector
from collectors.twitter_collector import TwitterCollector
from collectors.youtube_collector import YouTubeCollector
from collectors.osint_collector import OsintCollector

logger = logging.getLogger("argos.collectors.manager")


class MultiPlatformManager:
    """Orquestra coletas paralelas resilientes em múltiplas mídias sociais."""

    @classmethod
    async def execute_search(
        cls,
        search_mode: str,  # "topic" ou "profile"
        query: str,
        platforms: list[str],
        limit: int = 25,
        token: str = "",
        progress_callback: Optional[Callable[[str], None]] = None,
    ) -> MultiSearchResult:
        search_id = f"sr_{uuid.uuid4().hex[:12]}"
        logger.info(
            f"[{search_id}] Iniciando busca multiplataforma: modo={search_mode}, query='{query}', "
            f"plataformas={platforms}, limit={limit}"
        )

        if progress_callback:
            progress_callback(f"Iniciando busca transmídia em {len(platforms)} redes para '{query}'...")

        tasks = []
        for p in platforms:
            tasks.append(
                cls._dispatch_platform(
                    platform_str=p,
                    search_mode=search_mode,
                    query=query,
                    limit=limit,
                    token=token,
                    progress_callback=progress_callback,
                )
            )

        # Execução concorrente com tolerância a falhas individuais
        results = await asyncio.gather(*tasks, return_exceptions=True)

        all_posts: list[UnifiedPost] = []
        all_profiles: list[UnifiedProfile] = []
        platform_summaries: dict[str, PlatformSummary] = {}

        for p_name, res in zip(platforms, results):
            p_type = PlatformType(p_name) if p_name in [e.value for e in PlatformType] else PlatformType.INSTAGRAM

            if isinstance(res, Exception):
                logger.error(f"[{search_id}] Falha na coleta da plataforma {p_name}: {res}")
                platform_summaries[p_name] = PlatformSummary(
                    platform=p_type,
                    status="error",
                    error_message=str(res),
                )
                continue

            posts, profile, error_msg = res
            status = "error" if error_msg and not posts else ("partial" if error_msg else "success")

            if posts:
                all_posts.extend(posts)
            if profile:
                all_profiles.append(profile)

            # Cálculo de sumário por rede
            tot_views = sum(p.views for p in posts)
            tot_likes = sum(p.likes for p in posts)
            tot_comments = sum(p.comments_count for p in posts)
            tot_shares = sum(p.shares_count for p in posts)
            tot_interactions = sum(p.calculate_interactions() for p in posts)
            avg_eng = round(sum(p.engagement_rate for p in posts) / len(posts), 2) if posts else 0.0

            # Post com maior engajamento nesta rede
            top_post = max(posts, key=lambda x: x.calculate_interactions()) if posts else None

            # Distribuição de sentimentos básica
            sentiment_dist = {"positive": 0, "neutral": 0, "negative": 0}
            for p in posts:
                s = p.sentiment or "neutral"
                if s in sentiment_dist:
                    sentiment_dist[s] += 1

            platform_summaries[p_name] = PlatformSummary(
                platform=p_type,
                total_items=len(posts),
                total_views=tot_views,
                total_likes=tot_likes,
                total_comments=tot_comments,
                total_shares=tot_shares,
                total_interactions=tot_interactions,
                avg_engagement_rate=avg_eng,
                top_post=top_post,
                sentiment_distribution=sentiment_dist,
                status=status,
                error_message=error_msg,
            )

        # Ordenar todos os posts consolidados pelo volume de interações
        all_posts.sort(key=lambda p: (p.calculate_interactions(), p.views), reverse=True)

        global_views = sum(p.views for p in all_posts)
        global_interactions = sum(p.calculate_interactions() for p in all_posts)
        global_avg_eng = (
            round(sum(p.engagement_rate for p in all_posts) / len(all_posts), 2) if all_posts else 0.0
        )

        if progress_callback:
            progress_callback(f"Busca concluída! {len(all_posts)} conteúdos agregados de {len(platforms)} redes.")

        return MultiSearchResult(
            id=search_id,
            search_mode=search_mode,
            query=query,
            platforms_requested=platforms,
            total_items=len(all_posts),
            total_views=global_views,
            total_interactions=global_interactions,
            avg_engagement_rate=global_avg_eng,
            platform_summaries=platform_summaries,
            posts=all_posts,
            profiles=all_profiles,
        )

    @classmethod
    async def _dispatch_platform(
        cls,
        platform_str: str,
        search_mode: str,
        query: str,
        limit: int,
        token: str,
        progress_callback: Optional[Callable[[str], None]] = None,
    ) -> tuple[list[UnifiedPost], Optional[UnifiedProfile], Optional[str]]:
        """Despacha a requisição para o coletor correspondente."""
        try:
            if platform_str == PlatformType.YOUTUBE.value:
                if progress_callback:
                    progress_callback("Coletando YouTube (vídeos, Shorts e métricas)...")
                if search_mode == "profile":
                    prof, posts = await asyncio.to_thread(YouTubeCollector.get_profile, query, limit)
                    return posts, prof, None
                else:
                    posts = await asyncio.to_thread(YouTubeCollector.search_topic, query, limit)
                    return posts, None, None

            elif platform_str == PlatformType.REDDIT.value:
                if progress_callback:
                    progress_callback("Coletando Reddit (discussões, upvotes e comunidades)...")
                if search_mode == "profile":
                    prof, posts = await asyncio.to_thread(RedditCollector.get_profile, query, limit, token)
                    return posts, prof, None
                else:
                    posts = await asyncio.to_thread(RedditCollector.search_topic, query, limit, token)
                    return posts, None, None

            elif platform_str == PlatformType.TIKTOK.value:
                if progress_callback:
                    progress_callback("Coletando TikTok (vídeos virais e engajamento)...")
                if search_mode == "profile":
                    prof, posts = await asyncio.to_thread(TikTokCollector.get_profile, query, limit, token)
                    return posts, prof, None
                else:
                    posts = await asyncio.to_thread(TikTokCollector.search_topic, query, limit, token)
                    return posts, None, None

            elif platform_str == PlatformType.TWITTER.value:
                if progress_callback:
                    progress_callback("Coletando Twitter / X (posts e tendências)...")
                if search_mode == "profile":
                    prof, posts = await asyncio.to_thread(TwitterCollector.get_profile, query, limit, token)
                    return posts, prof, None
                else:
                    posts = await asyncio.to_thread(TwitterCollector.search_topic, query, limit, token)
                    return posts, None, None

            elif platform_str == PlatformType.THREADS.value:
                if progress_callback:
                    progress_callback("Coletando Threads (conversas e posts públicos)...")
                if search_mode == "profile":
                    prof, posts = await asyncio.to_thread(ThreadsCollector.get_profile, query, limit, token)
                    return posts, prof, None
                else:
                    posts = await asyncio.to_thread(ThreadsCollector.search_topic, query, limit, token)
                    return posts, None, None

            elif platform_str == PlatformType.INSTAGRAM.value:
                if progress_callback:
                    progress_callback("Coletando Instagram (perfil, reels e engajamento)...")
                if search_mode == "profile":
                    prof, posts = await InstagramCollector.get_profile(query, limit, token)
                    return posts, prof, None
                else:
                    posts = await InstagramCollector.search_topic(query, limit, token)
                    return posts, None, None

            elif platform_str == PlatformType.WEB.value:
                if progress_callback:
                    progress_callback("Coletando Web / OSINT (Google/DDG Dorks e menções abertas)...")
                posts, prof = await OsintCollector.search(
                    query=query,
                    search_mode=search_mode,
                    limit=limit,
                    token=token,
                    progress_callback=progress_callback,
                )
                return posts, prof, None

            else:
                return [], None, f"Plataforma desconhecida: {platform_str}"

        except Exception as exc:
            logger.error(f"Erro ao processar plataforma {platform_str}: {exc}", exc_info=True)
            return [], None, str(exc)
