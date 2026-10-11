"""Testes unitários e de integração para a Expansão Multiplataforma e Social Listening.
"""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi.testclient import TestClient

import main
from collectors.base import (
    MediaType,
    MultiSearchResult,
    PlatformType,
    UnifiedPost,
    UnifiedProfile,
)
from collectors.manager import MultiPlatformManager
from collectors.youtube_collector import YouTubeCollector, parse_view_count
from collectors.reddit_collector import RedditCollector
from collectors.tiktok_collector import TikTokCollector


@pytest.fixture
def client():
    return TestClient(main.app)


def test_parse_view_count():
    assert parse_view_count("1,229,888 views") == 1229888
    assert parse_view_count("1.5M visualizações") == 1500000
    assert parse_view_count("25 mil views") == 25000
    assert parse_view_count("10k") == 10000
    assert parse_view_count("500") == 500
    assert parse_view_count("") == 0
    assert parse_view_count(None) == 0


def test_unified_post_model():
    post = UnifiedPost(
        id="yt_123",
        platform=PlatformType.YOUTUBE,
        url="https://youtube.com/watch?v=123",
        author_username="tech_channel",
        title="Python Tutorial",
        content="Learn Python in 10 minutes",
        media_type=MediaType.VIDEO,
        views=10000,
        likes=500,
        comments_count=50,
        shares_count=20,
        engagement_rate=5.7,
    )
    assert post.calculate_interactions() == 570
    assert post.platform == PlatformType.YOUTUBE
    assert post.media_type == MediaType.VIDEO


def test_youtube_collector_convert():
    sample_item = {
        "videoId": "abc999",
        "title": {"runs": [{"text": "Video Incrivel"}]},
        "ownerText": {"runs": [{"text": "Canal Tech"}]},
        "viewCountText": {"simpleText": "100K views"},
        "lengthText": {"simpleText": "12:30"},
    }
    p = YouTubeCollector._convert_video_item(sample_item)
    assert p is not None
    assert p.id == "yt_abc999"
    assert p.title == "Video Incrivel"
    assert p.author_name == "Canal Tech"
    assert p.views == 100000
    assert p.media_type == MediaType.VIDEO


def test_reddit_collector_convert():
    sample_item = {
        "id": "t3_xyz",
        "title": "Discussao sobre IA",
        "text": "O que acham dos novos modelos?",
        "author": "dev_user",
        "subreddit": "tecnologia",
        "upVotes": 150,
        "numberOfComments": 42,
    }
    p = RedditCollector._convert_reddit_item(sample_item)
    assert p is not None
    assert p.id == "rd_t3_xyz"
    assert p.likes == 150
    assert p.comments_count == 42
    assert "Discussao sobre IA" in p.content
    assert p.media_type == MediaType.TEXT


def test_tiktok_collector_convert():
    sample_item = {
        "id": "789456",
        "desc": "Dica rapida de programacao #tech",
        "authorMeta": {"name": "tiktok_dev", "nickName": "Dev Dicas"},
        "playCount": 50000,
        "diggCount": 4200,
        "commentCount": 180,
        "shareCount": 95,
    }
    p = TikTokCollector._convert_tiktok_item(sample_item)
    assert p is not None
    assert p.id == "tt_789456"
    assert p.views == 50000
    assert p.likes == 4200
    assert p.media_type == MediaType.SHORT_VIDEO


@pytest.mark.asyncio
async def test_multi_platform_manager_orchestration():
    mock_post = UnifiedPost(
        id="yt_test",
        platform=PlatformType.YOUTUBE,
        url="https://youtube.com/watch?v=test",
        author_username="test_author",
        title="Test Video",
        content="Video Content",
        views=1000,
        likes=100,
        comments_count=10,
        engagement_rate=11.0,
    )

    with patch.object(YouTubeCollector, "search_topic", return_value=[mock_post]):
        res = await MultiPlatformManager.execute_search(
            search_mode="topic",
            query="python",
            platforms=["youtube"],
            limit=5,
        )

        assert isinstance(res, MultiSearchResult)
        assert res.total_items == 1
        assert res.total_views == 1000
        assert res.total_interactions == 110
        assert "youtube" in res.platform_summaries
        assert res.platform_summaries["youtube"].total_items == 1
        assert res.platform_summaries["youtube"].status == "success"


def test_api_multi_search_endpoint(client):
    req_payload = {
        "search_mode": "topic",
        "query": "programacao",
        "platforms": ["youtube"],
        "limit": 5,
    }
    with patch("main._run_multi_search_background", new_callable=AsyncMock):
        resp = client.post("/api/search/multi", json=req_payload)
        assert resp.status_code == 200
        data = resp.json()
        assert "job_id" in data
        assert data["status"] == "pending"
        assert data["query"] == "programacao"


def test_api_search_runs_list(client):
    resp = client.get("/api/search/runs")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_omnichannel_ai_audit_mock(client):
    mock_audit_res = {
        "omnichannel_score": 92,
        "score_rationale": "Forte presenca e ressonancia",
        "executive_summary": "Excelente percepcao de marca em video e comunidades.",
        "cross_platform_comparison": [
            {
                "platform": "YouTube",
                "resonance": "Alta",
                "audience_sentiment": "Positivo",
                "key_strength": "Retencao",
                "main_bottleneck": "Frequencia"
            }
        ],
        "content_repurpose_ideas": [
            {
                "source_platform": "Reddit",
                "target_platform": "TikTok",
                "concept": "Adaptar debate",
                "hook_3s": "Voce sabia?",
                "cta": "Comente abaixo"
            }
        ],
        "strategic_recommendations": ["Aumentar Shorts no YouTube"]
    }

    with patch("ai_service.generate_omnichannel_audit", new_callable=AsyncMock) as mock_ai:
        mock_ai.return_value = {
            "report": mock_audit_res,
            "meta": {"provider": "gemini", "model": "gemini-3.8-flash"}
        }

        resp = client.post("/api/search/ai/audit", json={
            "search_data": {
                "id": "sr_test_123",
                "query": "tecnologia",
                "search_mode": "topic",
                "platforms_requested": ["youtube"],
                "total_views": 5000,
                "total_interactions": 300,
                "platform_summaries": {},
                "posts": []
            }
        })

        assert resp.status_code == 200
        data = resp.json()
        assert data["report"]["omnichannel_score"] == 92
        assert len(data["report"]["content_repurpose_ideas"]) == 1


@pytest.mark.asyncio
async def test_direct_generate_omnichannel_audit():
    import json
    import ai_service
    mock_json = json.dumps({
        "omnichannel_score": 88,
        "score_rationale": "Boa tração multiplataforma",
        "executive_summary": "Visão geral positiva",
        "cross_platform_comparison": [],
        "content_repurpose_ideas": [],
        "strategic_recommendations": ["Expandir Reels"]
    })

    with patch("ai_service._call_gemini", new_callable=AsyncMock) as mock_call:
        mock_call.return_value = mock_json
        res = await ai_service.generate_omnichannel_audit(
            search_data={"query": "growth", "search_mode": "topic", "platforms_requested": ["youtube"], "posts": []},
            provider="gemini",
            token="AIzaSyTestKey123"
        )
        assert res["report"]["omnichannel_score"] == 88
        assert res["meta"]["provider"] == "gemini"


@pytest.mark.asyncio
async def test_direct_chat_omnichannel():
    import ai_service

    with patch("ai_service._call_gemini", new_callable=AsyncMock) as mock_call:
        mock_call.return_value = "Sugiro focar em vídeos curtos."
        res = await ai_service.chat_omnichannel(
            search_data={"query": "growth", "search_mode": "topic", "posts": []},
            messages=[{"role": "user", "content": "O que fazer?"}],
            provider="gemini",
            token="AIzaSyTestKey123"
        )
        assert res["reply"] == "Sugiro focar em vídeos curtos."
        assert res["meta"]["provider"] == "gemini"


