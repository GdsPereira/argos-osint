"""Coletor Multi-Estratégia para Twitter / X.

Suporta:
- Monitoramento de tópicos em tempo real, menções e sentimentos de marca.
- Análise de perfis e histórico de tweets.
- Integração resiliente via Apify Actor (apidojo/tweet-scraper).
"""
from __future__ import annotations

import logging
import os
from typing import Any, Optional

from collectors.base import MediaType, PlatformType, UnifiedPost, UnifiedProfile

logger = logging.getLogger("argos.collectors.twitter")

APIFY_ACTOR_TWITTER = os.getenv("APIFY_TWITTER_ACTOR", "apidojo/tweet-scraper")


class TwitterCollector:
    """Coletor de microblogging, tendências e discussões em tempo real do Twitter/X."""
    platform = PlatformType.TWITTER

    @classmethod
    def search_topic(cls, query: str, limit: int = 25, token: str = "") -> list[UnifiedPost]:
        """Busca tweets sobre um tópico ou hashtag."""
        logger.info(f"[Twitter/X] Buscando tweets para '{query}' (limit={limit})")
        apify_token = token.strip() or os.getenv("APIFY_TOKEN", "")
        if not apify_token:
            logger.warning("[Twitter/X] Token Apify não informado.")
            return []

        try:
            from apify_client import ApifyClient
            client = ApifyClient(apify_token)

            run_input = {
                "searchTerms": [query],
                "maxTweets": min(limit, 50),
                "sort": "Top",
            }

            run = client.actor(APIFY_ACTOR_TWITTER).call(run_input=run_input, timeout_secs=90)
            items = list(client.dataset(run["defaultDatasetId"]).iterate_items()) if run else []

            posts: list[UnifiedPost] = []
            for item in items:
                p = cls._convert_tweet_item(item)
                if p:
                    posts.append(p)
            return posts
        except Exception as exc:
            logger.error(f"[Twitter/X] Erro na coleta: {exc}", exc_info=True)
            return []

    @classmethod
    def get_profile(cls, username: str, max_posts: int = 25, token: str = "") -> tuple[UnifiedProfile, list[UnifiedPost]]:
        """Busca tweets recentes e dados de um perfil no Twitter/X."""
        clean_user = username.strip().lstrip("@")
        apify_token = token.strip() or os.getenv("APIFY_TOKEN", "")
        if not apify_token:
            return UnifiedProfile(platform=PlatformType.TWITTER, username=clean_user), []

        try:
            from apify_client import ApifyClient
            client = ApifyClient(apify_token)

            run_input = {
                "twitterHandles": [clean_user],
                "maxTweets": min(max_posts, 50),
            }

            run = client.actor(APIFY_ACTOR_TWITTER).call(run_input=run_input, timeout_secs=90)
            items = list(client.dataset(run["defaultDatasetId"]).iterate_items()) if run else []

            posts: list[UnifiedPost] = []
            for item in items:
                p = cls._convert_tweet_item(item)
                if p:
                    posts.append(p)

            author_name = posts[0].author_name if posts else clean_user
            author_avatar = posts[0].author_avatar if posts else None

            total_views = sum(p.views for p in posts)
            avg_eng = sum(p.engagement_rate for p in posts) / len(posts) if posts else 0.0

            profile = UnifiedProfile(
                platform=PlatformType.TWITTER,
                username=clean_user,
                full_name=author_name,
                avatar_url=author_avatar,
                url=f"https://x.com/{clean_user}",
                posts_count=len(posts),
                total_views=total_views,
                avg_engagement_rate=round(avg_eng, 2),
            )
            return profile, posts
        except Exception as exc:
            logger.error(f"[Twitter/X] Erro ao buscar perfil: {exc}")
            return UnifiedProfile(platform=PlatformType.TWITTER, username=clean_user), []

    @classmethod
    def _convert_tweet_item(cls, item: dict[str, Any]) -> Optional[UnifiedPost]:
        tweet_id = str(item.get("id") or item.get("tweetId") or "")
        text = item.get("full_text") or item.get("text") or ""
        url = item.get("url") or item.get("tweetUrl") or f"https://x.com/i/status/{tweet_id}"

        user = item.get("user") or item.get("author") or {}
        author_user = user.get("screen_name") or user.get("userName") or "twitter_user"
        author_name = user.get("name") or author_user
        author_avatar = user.get("profile_image_url_https") or user.get("profilePicture")

        likes = int(item.get("favorite_count") or item.get("likes") or item.get("likeCount") or 0)
        retweets = int(item.get("retweet_count") or item.get("retweets") or item.get("retweetCount") or 0)
        replies = int(item.get("reply_count") or item.get("replies") or item.get("replyCount") or 0)
        views = int(item.get("view_count") or item.get("views") or 0)
        if views == 0:
            views = max((likes + retweets) * 20, 100)

        interactions = likes + retweets + replies
        engagement = round((interactions / views * 100), 2) if views > 0 else 0.0

        return UnifiedPost(
            id=f"tw_{tweet_id}" if tweet_id else f"tw_{hash(url)}",
            platform=PlatformType.TWITTER,
            url=url,
            author_username=author_user,
            author_name=author_name,
            author_avatar=author_avatar,
            title=text[:60] + ("..." if len(text) > 60 else ""),
            content=text,
            media_type=MediaType.TEXT,
            published_at=str(item.get("created_at") or ""),
            views=views,
            likes=likes,
            comments_count=replies,
            shares_count=retweets,
            engagement_rate=engagement,
            extra={
                "retweets": retweets,
                "likes": likes,
            },
        )
