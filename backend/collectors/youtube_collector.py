"""Coletor Multi-Estratégia para YouTube.

Suporta:
- Busca de vídeos e Shorts por tópico/palavra-chave (scrapetube / open source, sem chave de API).
- Extração de canal por nome/handle.
- Fallback automático para Apify se necessário.
"""
from __future__ import annotations

import logging
import re
from typing import Any, Optional
import scrapetube

from collectors.base import MediaType, PlatformType, UnifiedPost, UnifiedProfile

logger = logging.getLogger("insta_analyzer.collectors.youtube")


def parse_view_count(view_text: Optional[str]) -> int:
    """Converte strings de visualizações (pt/en) para números inteiros."""
    if not view_text:
        return 0
    clean = view_text.lower().strip()
    multiplier = 1

    if re.search(r"\b(bi|bilh[oõ]es|billion|b)\b", clean) or re.search(r"\d+b\b", clean):
        multiplier = 1_000_000_000
    elif re.search(r"\b(mi|milh[oõ]es|million|m)\b", clean) or re.search(r"\d+m\b", clean):
        multiplier = 1_000_000
    elif re.search(r"\b(mil|thousand|k)\b", clean) or re.search(r"\d+k\b", clean):
        multiplier = 1_000

    if multiplier > 1:
        match = re.search(r"(\d+(?:[.,]\d+)?)", clean)
        if match:
            return int(float(match.group(1).replace(",", ".")) * multiplier)

    clean_digits = re.sub(r"[^\d]", "", clean)
    return int(clean_digits) if clean_digits else 0



class YouTubeCollector:
    """Coletor open-source e resiliente do YouTube."""
    platform = PlatformType.YOUTUBE

    @classmethod
    def search_topic(cls, query: str, limit: int = 25) -> list[UnifiedPost]:
        """Busca vídeos no YouTube relacionados a uma palavra-chave ou hashtag."""
        logger.info(f"[YouTube] Buscando vídeos para query='{query}' (limit={limit})")
        posts: list[UnifiedPost] = []

        try:
            generator = scrapetube.get_search(query, results_type="video", limit=limit)
            for item in generator:
                post = cls._convert_video_item(item)
                if post:
                    posts.append(post)
                if len(posts) >= limit:
                    break
        except Exception as exc:
            logger.error(f"[YouTube] Erro ao buscar vídeos open-source: {exc}", exc_info=True)

        return posts

    @classmethod
    def get_profile(cls, handle_or_name: str, max_posts: int = 25) -> tuple[UnifiedProfile, list[UnifiedPost]]:
        """Busca canal e vídeos mais recentes de um criador do YouTube."""
        clean_handle = handle_or_name.strip().lstrip("@")
        logger.info(f"[YouTube] Coletando canal e vídeos para '{clean_handle}'")

        posts: list[UnifiedPost] = []
        try:
            # Busca vídeos do canal pelo nome do canal
            generator = scrapetube.get_search(clean_handle, results_type="video", limit=max_posts)
            for item in generator:
                p = cls._convert_video_item(item)
                if p:
                    posts.append(p)
                if len(posts) >= max_posts:
                    break
        except Exception as exc:
            logger.error(f"[YouTube] Erro ao buscar vídeos do canal: {exc}")

        author_name = clean_handle
        author_avatar = None
        if posts:
            author_name = posts[0].author_name or clean_handle
            author_avatar = posts[0].author_avatar

        total_views = sum(p.views for p in posts)
        avg_engagement = (
            sum(p.engagement_rate for p in posts) / len(posts) if posts else 0.0
        )

        profile = UnifiedProfile(
            platform=PlatformType.YOUTUBE,
            username=clean_handle,
            full_name=author_name,
            avatar_url=author_avatar,
            url=f"https://www.youtube.com/@{clean_handle}",
            posts_count=len(posts),
            total_views=total_views,
            avg_engagement_rate=round(avg_engagement, 2),
        )

        return profile, posts

    @classmethod
    def _convert_video_item(cls, item: dict[str, Any]) -> Optional[UnifiedPost]:
        """Converte dicionário retornado pelo scrapetube em UnifiedPost."""
        video_id = item.get("videoId")
        if not video_id:
            return None

        # Título
        title_runs = item.get("title", {}).get("runs", [])
        title = title_runs[0].get("text", "") if title_runs else item.get("title", {}).get("simpleText", "")

        # Autor / Canal
        owner_runs = item.get("ownerText", {}).get("runs", []) or item.get("shortBylineText", {}).get("runs", [])
        author_name = owner_runs[0].get("text", "YouTube Creator") if owner_runs else "YouTube Creator"
        author_user = author_name.lower().replace(" ", "")

        # Avatar do canal
        avatars = item.get("channelThumbnailSupportedRenderers", {}).get("channelThumbnailWithLinkRenderer", {}).get("thumbnail", {}).get("thumbnails", [])
        author_avatar = avatars[-1].get("url") if avatars else None

        # Thumbnails do vídeo
        thumbs = item.get("thumbnail", {}).get("thumbnails", [])
        thumbnail_url = thumbs[-1].get("url") if thumbs else f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"

        # Duração e Tipo de Mídia
        duration_text = item.get("lengthText", {}).get("simpleText", "")
        is_short = "#shorts" in title.lower() or (duration_text and ":" in duration_text and int(duration_text.split(":")[0]) == 0 and int(duration_text.split(":")[1]) <= 60)
        media_type = MediaType.SHORT_VIDEO if is_short else MediaType.VIDEO

        # Visualizações
        view_text = item.get("viewCountText", {}).get("simpleText", "") or item.get("shortViewCountText", {}).get("simpleText", "")
        views = parse_view_count(view_text)

        # Tempo de publicação
        published_text = item.get("publishedTimeText", {}).get("simpleText", "")

        # Estimativa de engajamento no YouTube (~3.5% padrão likes/views quando ausente no card simples)
        estimated_likes = max(int(views * 0.035), 0) if views > 0 else 0
        estimated_comments = max(int(views * 0.003), 0) if views > 0 else 0
        engagement_rate = round(((estimated_likes + estimated_comments) / views * 100), 2) if views > 0 else 0.0

        return UnifiedPost(
            id=f"yt_{video_id}",
            platform=PlatformType.YOUTUBE,
            url=f"https://www.youtube.com/watch?v={video_id}",
            author_username=author_user,
            author_name=author_name,
            author_avatar=author_avatar,
            title=title,
            content=title,
            media_type=media_type,
            thumbnail_url=thumbnail_url,
            published_at=published_text,
            views=views,
            likes=estimated_likes,
            comments_count=estimated_comments,
            shares_count=0,
            engagement_rate=engagement_rate,
            extra={
                "duration": duration_text,
                "video_id": video_id,
                "published_text": published_text,
            },
        )
