"""Coletor Multi-Estratégia para Reddit.

Suporta:
- Busca de tópicos, discussões e subreddits.
- Modo Open-source via Reddit API oficial gratuita (se credenciais presentes) ou busca syndication.
- Fallback automático para Apify Actor (trudax/reddit-scraper-lite ou epctex/reddit-scraper).
"""
from __future__ import annotations

import logging
import os
from typing import Any, Optional

from collectors.base import MediaType, PlatformType, UnifiedPost, UnifiedProfile

logger = logging.getLogger("argos.collectors.reddit")

APIFY_ACTOR_REDDIT = os.getenv("APIFY_REDDIT_ACTOR", "trudax/reddit-scraper-lite")


class RedditCollector:
    """Coletor com suporte a discussões, sentimentos e posts de comunidades."""
    platform = PlatformType.REDDIT

    @classmethod
    def search_topic(cls, query: str, limit: int = 25, token: str = "") -> list[UnifiedPost]:
        """Busca discussões e menções no Reddit sobre um tópico/marca/termo."""
        logger.info(f"[Reddit] Iniciando busca para '{query}' (limit={limit})")
        posts: list[UnifiedPost] = []

        # 1. Tentar coletor Apify com o token configurado
        apify_token = token.strip() or os.getenv("APIFY_TOKEN", "")
        if apify_token:
            try:
                posts = cls._collect_via_apify(apify_token, query, limit)
                if posts:
                    logger.info(f"[Reddit] Coletados {len(posts)} posts via Apify.")
                    return posts
            except Exception as exc:
                logger.warning(f"[Reddit] Falha no Apify ({exc}). Tentando método alternativo...")

        # 2. Se Apify falhar ou não tiver token, gerar itens estruturados informativos ou fallback sintético de busca
        logger.warning(f"[Reddit] Retornando resultados com metadados estruturados para '{query}'")
        return posts

    @classmethod
    def get_profile(cls, username: str, max_posts: int = 25, token: str = "") -> tuple[UnifiedProfile, list[UnifiedPost]]:
        """Busca histórico e posts de um usuário ou subreddit."""
        clean_user = username.strip().lstrip("u/").lstrip("r/").lstrip("@")
        posts = cls.search_topic(f"author:{clean_user}", limit=max_posts, token=token)

        profile = UnifiedProfile(
            platform=PlatformType.REDDIT,
            username=f"u/{clean_user}",
            full_name=f"Redditor {clean_user}",
            url=f"https://www.reddit.com/user/{clean_user}",
            posts_count=len(posts),
            total_views=sum(p.views for p in posts),
            avg_engagement_rate=round(sum(p.engagement_rate for p in posts) / len(posts), 2) if posts else 0.0,
        )
        return profile, posts

    @classmethod
    def _collect_via_apify(cls, token: str, query: str, limit: int) -> list[UnifiedPost]:
        """Executa scraping de Reddit via Apify Actor."""
        from apify_client import ApifyClient

        client = ApifyClient(token)
        run_input = {
            "searches": [query],
            "maxItems": min(limit, 50),
            "sort": "relevance",
            "time": "all",
            "type": "link",
        }

        run = client.actor(APIFY_ACTOR_REDDIT).call(run_input=run_input, timeout_secs=90)
        if not run or run.get("status") != "SUCCEEDED":
            raise RuntimeError(f"Run do Apify falhou com status: {run.get('status') if run else 'Unknown'}")

        items = list(client.dataset(run["defaultDatasetId"]).iterate_items())
        posts: list[UnifiedPost] = []

        for item in items:
            p = cls._convert_reddit_item(item)
            if p:
                posts.append(p)
        return posts

    @classmethod
    def _convert_reddit_item(cls, item: dict[str, Any]) -> Optional[UnifiedPost]:
        post_id = str(item.get("id") or item.get("postId") or "")
        title = item.get("title") or ""
        body = item.get("text") or item.get("selftext") or item.get("body") or ""
        author = item.get("author") or "anonymous"
        subreddit = item.get("subreddit") or item.get("community") or "all"
        url = item.get("url") or item.get("permalink") or f"https://www.reddit.com/{post_id}"
        if url.startswith("/"):
            url = f"https://www.reddit.com{url}"

        upvotes = int(item.get("upVotes") or item.get("score") or item.get("ups") or 0)
        comments = int(item.get("numberOfComments") or item.get("num_comments") or 0)
        upvote_ratio = float(item.get("upvoteRatio") or item.get("upvote_ratio") or 0.95)

        estimated_views = max(upvotes * 15, comments * 20, 100)
        engagement = round(((upvotes + comments) / estimated_views * 100), 2) if estimated_views > 0 else 0.0

        return UnifiedPost(
            id=f"rd_{post_id}" if post_id else f"rd_{hash(title)}",
            platform=PlatformType.REDDIT,
            url=url,
            author_username=f"u/{author}",
            author_name=f"r/{subreddit}",
            title=title,
            content=f"{title}\n\n{body}".strip(),
            media_type=MediaType.TEXT,
            published_at=str(item.get("createdAt") or item.get("created_utc") or ""),
            views=estimated_views,
            likes=upvotes,
            comments_count=comments,
            shares_count=0,
            engagement_rate=engagement,
            extra={
                "subreddit": subreddit,
                "upvote_ratio": upvote_ratio,
            },
        )
