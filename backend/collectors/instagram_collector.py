"""Adaptador do Instagram para o Contrato Canônico Multiplataforma.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

import collector_apify as ca
from collectors.base import MediaType, PlatformType, UnifiedPost, UnifiedProfile

logger = logging.getLogger("argos.collectors.instagram")


class InstagramCollector:
    """Integra a infraestrutura existente do Instagram ao pipeline unificado."""
    platform = PlatformType.INSTAGRAM

    @classmethod
    async def search_topic(cls, query: str, limit: int = 25, token: str = "") -> list[UnifiedPost]:
        """Busca posts no Instagram por hashtag ou termo."""
        clean_tag = query.lstrip("#").strip()
        apify_token = token.strip() or os.getenv("APIFY_TOKEN", "")
        if not apify_token:
            return []

        try:
            logger.info(f"[Instagram] Buscando posts para #{clean_tag}...")
            # Usa o pipeline assíncrono do coletor Apify com busca de hashtag
            info, posts, _, _ = await ca.run_pipeline_async(
                token=apify_token,
                username=clean_tag,
                max_posts=limit,
                with_comments=False,
            )
            return [cls._convert_insta_post(p, username=info.get("username", clean_tag)) for p in posts]
        except Exception as exc:
            logger.error(f"[Instagram] Erro ao buscar posts: {exc}")
            return []

    @classmethod
    async def get_profile(cls, username: str, max_posts: int = 25, token: str = "") -> tuple[UnifiedProfile, list[UnifiedPost]]:
        """Extrai perfil completo e posts do Instagram."""
        clean_user = ca._clean_username(username)
        apify_token = token.strip() or os.getenv("APIFY_TOKEN", "")

        try:
            info, raw_posts, _, extra = await ca.run_pipeline_async(
                token=apify_token,
                username=clean_user,
                max_posts=max_posts,
                with_comments=False,
            )
            posts = [cls._convert_insta_post(p, username=clean_user) for p in raw_posts]

            followers = int(info.get("followers", 0) or 0)
            following = int(info.get("following", 0) or 0)
            total_views = sum(p.views for p in posts)
            avg_eng = sum(p.engagement_rate for p in posts) / len(posts) if posts else 0.0

            profile = UnifiedProfile(
                platform=PlatformType.INSTAGRAM,
                username=clean_user,
                full_name=info.get("full_name") or clean_user,
                bio=info.get("biography") or "",
                avatar_url=info.get("profile_pic_url"),
                url=f"https://www.instagram.com/{clean_user}/",
                verified=bool(info.get("is_verified", False)),
                followers=followers,
                following=following,
                posts_count=int(info.get("posts_count", len(posts))),
                total_views=total_views,
                avg_engagement_rate=round(avg_eng, 2),
                extra=extra,
            )
            return profile, posts
        except Exception as exc:
            logger.error(f"[Instagram] Erro na coleta do perfil @{clean_user}: {exc}")
            return UnifiedProfile(platform=PlatformType.INSTAGRAM, username=clean_user), []

    @classmethod
    def _convert_insta_post(cls, p: dict, username: str = "") -> UnifiedPost:
        post_id = str(p.get("id") or p.get("shortcode") or "")
        shortcode = p.get("shortcode") or post_id
        url = p.get("url") or f"https://www.instagram.com/p/{shortcode}/"
        caption = p.get("caption") or ""
        p_type = str(p.get("type") or "").lower()

        if "video" in p_type or "reel" in p_type:
            media_type = MediaType.SHORT_VIDEO
        elif "sidecar" in p_type or "carousel" in p_type:
            media_type = MediaType.CAROUSEL
        else:
            media_type = MediaType.IMAGE

        likes = int(p.get("likes") or 0)
        comments = int(p.get("comments") or 0)
        views = int(p.get("video_play_count") or p.get("video_view_count") or 0)
        if views == 0:
            views = max((likes + comments) * 12, 100)

        eng = round(((likes + comments) / views * 100), 2) if views > 0 else 0.0

        return UnifiedPost(
            id=f"ig_{post_id}",
            platform=PlatformType.INSTAGRAM,
            url=url,
            author_username=username or p.get("owner_username", "instagram_user"),
            author_name=username,
            author_avatar=None,
            title=caption[:60] + ("..." if len(caption) > 60 else "") if caption else "Instagram Post",
            content=caption,
            media_type=media_type,
            thumbnail_url=p.get("display_url"),
            published_at=str(p.get("timestamp") or ""),
            views=views,
            likes=likes,
            comments_count=comments,
            shares_count=0,
            engagement_rate=eng,
            extra={
                "shortcode": shortcode,
                "type": p_type,
            },
        )
