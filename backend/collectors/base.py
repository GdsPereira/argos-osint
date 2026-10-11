"""Contrato Canônico e Modelos Unificados de Dados Multiplataforma.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, Field


class MediaType(str, Enum):
    VIDEO = "video"
    SHORT_VIDEO = "short_video"  # TikTok, Shorts, Reels
    IMAGE = "image"
    CAROUSEL = "carousel"
    TEXT = "text"                # Tweets, Reddit, Threads
    ARTICLE = "article"


class PlatformType(str, Enum):
    INSTAGRAM = "instagram"
    YOUTUBE = "youtube"
    TIKTOK = "tiktok"
    REDDIT = "reddit"
    TWITTER = "twitter"
    THREADS = "threads"
    WEB = "web"


class UnifiedPost(BaseModel):
    """Representação padronizada de um conteúdo de qualquer rede social."""
    id: str
    platform: PlatformType
    url: str
    author_username: str
    author_name: Optional[str] = None
    author_avatar: Optional[str] = None
    title: Optional[str] = None
    content: str = ""                     # Legenda, texto do tweet, selftext do reddit, etc.
    media_type: MediaType = MediaType.TEXT
    thumbnail_url: Optional[str] = None
    published_at: Optional[str] = None
    views: int = 0
    likes: int = 0
    comments_count: int = 0
    shares_count: int = 0
    saves_count: int = 0
    engagement_rate: float = 0.0          # Calculado com base nas interações / alcance ou views
    sentiment: Optional[str] = "neutral"  # positive, neutral, negative
    sentiment_score: float = 0.0
    extra: dict[str, Any] = Field(default_factory=dict)

    def calculate_interactions(self) -> int:
        return self.likes + self.comments_count + self.shares_count + self.saves_count


class UnifiedProfile(BaseModel):
    """Representação unificada do perfil ou canal de um criador."""
    platform: PlatformType
    username: str
    full_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    url: Optional[str] = None
    verified: bool = False
    followers: int = 0                    # Ou inscritos no YouTube, membros no Reddit
    following: int = 0
    posts_count: int = 0
    total_views: int = 0
    avg_engagement_rate: float = 0.0
    extra: dict[str, Any] = Field(default_factory=dict)


class PlatformSummary(BaseModel):
    """Resumo consolidado das métricas de uma plataforma em uma busca."""
    platform: PlatformType
    total_items: int = 0
    total_views: int = 0
    total_likes: int = 0
    total_comments: int = 0
    total_shares: int = 0
    total_interactions: int = 0
    avg_engagement_rate: float = 0.0
    top_post: Optional[UnifiedPost] = None
    sentiment_distribution: dict[str, int] = Field(default_factory=lambda: {"positive": 0, "neutral": 0, "negative": 0})
    status: str = "success"               # "success", "partial", "error"
    error_message: Optional[str] = None


class MultiSearchResult(BaseModel):
    """Resultado unificado consolidado de busca ou auditoria transmídia."""
    id: str
    search_mode: str                      # "topic" ou "profile"
    query: str
    platforms_requested: list[str]
    total_items: int = 0
    total_views: int = 0
    total_interactions: int = 0
    avg_engagement_rate: float = 0.0
    platform_summaries: dict[str, PlatformSummary] = Field(default_factory=dict)
    posts: list[UnifiedPost] = Field(default_factory=list)
    profiles: list[UnifiedProfile] = Field(default_factory=list)
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
