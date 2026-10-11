"""Módulo de Coletores Multiplataforma.
"""
from collectors.base import (
    MediaType,
    MultiSearchResult,
    PlatformSummary,
    PlatformType,
    UnifiedPost,
    UnifiedProfile,
)
from collectors.manager import MultiPlatformManager
from collectors.osint_collector import OsintCollector

__all__ = [
    "MediaType",
    "PlatformType",
    "UnifiedPost",
    "UnifiedProfile",
    "PlatformSummary",
    "MultiSearchResult",
    "MultiPlatformManager",
    "OsintCollector",
]
