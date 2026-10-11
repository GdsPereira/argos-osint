"""Testes unitários e de integração para o serviço e endpoints de IA."""
from unittest.mock import AsyncMock, patch
import pytest
from fastapi.testclient import TestClient

import ai_service
import main


@pytest.fixture
def client():
    return TestClient(main.app)


def test_config_returns_ai_config(client):
    res = client.get("/api/config")
    assert res.status_code == 200
    data = res.json()
    assert "ai_config" in data
    assert "configured" in data["ai_config"]
    assert "provider" in data["ai_config"]
    assert "model" in data["ai_config"]


def test_distill_analysis_compacts_data():
    sample_analysis = {
        "info": {
            "username": "tester",
            "seguidores": 1000,
            "seguindo": 100,
            "posts": 50,
            "biografia": "Test bio",
        },
        "summary": {
            "posts_analisados": 10,
            "taxa_engajamento": 3.5,
            "media_curtidas": 150,
            "melhor_hora": 18,
            "melhor_dia": "Qua",
        },
        "posts": [
            {
                "shortcode": "ABC",
                "curtidas": 200,
                "comentarios": 10,
                "interacoes": 210,
                "tipo": "GraphVideo",
                "legenda": "Uma legenda de teste muito relevante para engajamento",
            },
            {
                "shortcode": "DEF",
                "curtidas": 50,
                "comentarios": 2,
                "interacoes": 52,
                "tipo": "GraphImage",
                "legenda": "Outra foto comum",
            },
        ],
        "comments": {
            "total": 1,
            "sentiment": {"positivo": 1, "neutro": 0, "negativo": 0},
            "items": [{"autor": "user1", "texto": "Adorei o produto, onde compro?", "sentimento": "positivo"}],
            "words": [{"item": "produto", "usos": 1}],
        },
    }

    distilled = ai_service.distill_analysis(sample_analysis)
    assert distilled["perfil"]["username"] == "tester"
    assert distilled["kpis"]["taxa_engajamento_media"] == 3.5
    assert len(distilled["top_posts_alta_performance"]) > 0
    assert distilled["top_posts_alta_performance"][0]["shortcode"] == "ABC"
    assert len(distilled["comentarios_resumo"]["amostra_comentarios"]) == 1


def test_ai_diagnose_requires_token_when_none_configured(client):
    with patch("ai_service._ensure_env", lambda: None), patch.dict("os.environ", {}, clear=True):
        res = client.post(
            "/api/ai/diagnose",
            json={"analysis": {"info": {"username": "tester"}}, "token": "", "provider": "gemini"},
        )
        assert res.status_code == 400
        assert "Chave de API não informada" in res.json()["detail"]


def test_ai_diagnose_success_mocked(client):
    fake_response = {
        "health_score": 85,
        "executive_summary": "Excelente perfil com forte engajamento em vídeos.",
        "swot": {
            "strengths": ["Forte retenção em Reels"],
            "weaknesses": ["Pouca constância nos fins de semana"],
            "opportunities": ["Explorar carrosséis educativos"],
            "threats": ["Saturação de temas repetidos"],
        },
        "content_strategy": {
            "format_verdict": "Reels geram 3x mais engajamento.",
            "copywriting_and_hooks": "Ganchos interrogativos funcionam melhor.",
            "timing_and_cadence": "Postagens às 18h têm pico de interações.",
        },
        "audience_insights": {
            "sentiment_verdict": "Sentimento 90% positivo.",
            "key_interests": ["Dicas de growth", "Marketing"],
            "unmet_needs_or_questions": ["Preço e onde comprar"],
        },
        "recommended_posts": [
            {
                "title": "3 Erros que Flopam seus Posts",
                "format": "Reels",
                "hook": "Pare de postar isso se quiser crescer...",
                "concept": "Demonstrar 3 erros práticos de copywriting",
                "cta": "Comente 'GUIA' para receber o PDF gratuito",
            }
        ],
        "quick_wins": ["Ajustar horário para 18h", "Fixar os 3 melhores posts no feed"],
        "meta": {"provider": "gemini", "model": "gemini-2.5-flash", "focus": "general"},
    }

    with patch("ai_service.generate_diagnosis", new_callable=AsyncMock) as mock_diag:
        mock_diag.return_value = fake_response
        res = client.post(
            "/api/ai/diagnose",
            json={"analysis": {"info": {"username": "tester"}}, "token": "test-key", "provider": "gemini"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["health_score"] == 85
        assert len(data["recommended_posts"]) == 1
        assert data["recommended_posts"][0]["format"] == "Reels"


def test_ai_chat_success_mocked(client):
    fake_chat = {
        "reply": "O post com melhor engajamento foi o shortcode ABC com 210 interações.",
        "meta": {"provider": "gemini", "model": "gemini-2.5-flash"},
    }

    with patch("ai_service.chat_with_profile", new_callable=AsyncMock) as mock_chat:
        mock_chat.return_value = fake_chat
        res = client.post(
            "/api/ai/chat",
            json={
                "analysis": {"info": {"username": "tester"}},
                "messages": [{"role": "user", "content": "Qual foi o melhor post?"}],
                "token": "test-key",
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert "ABC" in data["reply"]


def test_detect_provider_from_key_openrouter():
    assert ai_service.detect_provider_from_key("sk-or-v1-abcdef123456") == "openrouter"
    assert ai_service.detect_provider_from_key("sk-abcdef123456") == "openai"
    assert ai_service.detect_provider_from_key("AQ.Ab8xyz") == "gemini"
    assert ai_service.detect_provider_from_key("AIzaSyTestKey") == "gemini"
    assert ai_service.detect_provider_from_key("") is None


def test_get_ai_config_detects_openrouter_fallback():
    with patch("ai_service._ensure_env", lambda: None), patch.dict(
        "os.environ",
        {
            "GEMINI_API_KEY": "AIzaSyTestKey",
            "OPENROUTER_API_KEY": "sk-or-v1-my-openrouter-key",
            "OPENROUTER_MODEL": "google/gemini-2.0-flash-001",
        },
        clear=True,
    ):
        cfg = ai_service.get_ai_config()
        assert cfg["configured"] is True
        assert cfg["provider"] == "gemini"
        assert cfg["fallback_available"] is True
        assert cfg["fallback_provider"] == "openrouter"
        assert cfg["fallback_model"] == "google/gemini-2.0-flash-001"
        assert cfg["providers_available"]["openrouter"] is True


@pytest.mark.asyncio
async def test_fallback_to_openrouter_when_primary_fails():
    import json
    sample_analysis = {
        "info": {"username": "target_user"},
        "summary": {"posts_analisados": 5},
    }
    openrouter_json = json.dumps({
        "health_score": 90,
        "executive_summary": "Dossiê processado via fallback do OpenRouter com sucesso.",
        "swot": {"strengths": ["Engajamento"], "weaknesses": [], "opportunities": [], "threats": []},
        "content_strategy": {"format_verdict": "Reels", "copywriting_and_hooks": "Direto", "timing_and_cadence": "Noite"},
        "audience_insights": {"sentiment_verdict": "Positivo", "key_interests": ["Tech"], "unmet_needs_or_questions": []},
        "recommended_posts": [],
        "quick_wins": ["Otimizar bio"],
    })

    with patch("ai_service._ensure_env", lambda: None), patch.dict(
        "os.environ",
        {
            "GEMINI_API_KEY": "AIzaSyPrimary",
            "OPENROUTER_API_KEY": "sk-or-v1-fallback-key",
            "OPENROUTER_MODEL": "google/gemini-2.0-flash-001",
        },
        clear=True,
    ):
        with patch("ai_service._call_gemini", side_effect=RuntimeError("Google API 503 Service Unavailable")), \
             patch("ai_service._call_openrouter", new_callable=AsyncMock) as mock_or:
            mock_or.return_value = openrouter_json

            result = await ai_service.generate_diagnosis(
                analysis_data=sample_analysis,
                provider="gemini",
                token="AIzaSyPrimary",
            )

            assert mock_or.called
            assert result["health_score"] == 90
            assert result["meta"]["provider"] == "openrouter"
            assert result["meta"]["fallback_triggered"] is True
            assert result["meta"]["original_provider"] == "gemini"
            assert "503" in result["meta"]["fallback_reason"]


@pytest.mark.asyncio
async def test_openrouter_as_direct_primary_provider():
    import json
    sample_analysis = {
        "info": {"username": "target_user"},
        "summary": {"posts_analisados": 5},
    }
    openrouter_json = json.dumps({
        "health_score": 92,
        "executive_summary": "Dossiê direto do OpenRouter.",
        "swot": {"strengths": [], "weaknesses": [], "opportunities": [], "threats": []},
        "content_strategy": {"format_verdict": "", "copywriting_and_hooks": "", "timing_and_cadence": ""},
        "audience_insights": {"sentiment_verdict": "", "key_interests": [], "unmet_needs_or_questions": []},
        "recommended_posts": [],
        "quick_wins": [],
    })

    with patch("ai_service._ensure_env", lambda: None), patch.dict(
        "os.environ",
        {
            "OPENROUTER_API_KEY": "sk-or-v1-direct-key",
            "OPENROUTER_MODEL": "google/gemini-2.0-flash-001",
        },
        clear=True,
    ):
        with patch("ai_service._call_openrouter", new_callable=AsyncMock) as mock_or:
            mock_or.return_value = openrouter_json

            result = await ai_service.generate_diagnosis(
                analysis_data=sample_analysis,
                provider="openrouter",
            )

            assert mock_or.called
            assert result["health_score"] == 92
            assert result["meta"]["provider"] == "openrouter"
            assert result["meta"]["fallback_triggered"] is False


@pytest.mark.asyncio
async def test_chat_with_profile_fallback_to_openrouter():
    sample_analysis = {"info": {"username": "target_user"}}
    messages = [{"role": "user", "content": "Quem é o alvo?"}]

    with patch("ai_service._ensure_env", lambda: None), patch.dict(
        "os.environ",
        {
            "GEMINI_API_KEY": "AIzaSyPrimary",
            "OPENROUTER_API_KEY": "sk-or-v1-fallback-key",
        },
        clear=True,
    ):
        with patch("ai_service._call_gemini", side_effect=RuntimeError("Timeout")), \
             patch("ai_service._call_openrouter", new_callable=AsyncMock) as mock_or:
            mock_or.return_value = "Resposta obtida via fallback do OpenRouter."

            result = await ai_service.chat_with_profile(
                analysis_data=sample_analysis,
                messages=messages,
                provider="gemini",
                token="AIzaSyPrimary",
            )

            assert mock_or.called
            assert "OpenRouter" in result["reply"]
            assert result["meta"]["fallback_triggered"] is True
            assert result["meta"]["provider"] == "openrouter"


@pytest.mark.asyncio
async def test_call_gemini_strips_thinking_parts_for_gemma():
    """Valida que _call_gemini ignora tokens com thought: true e extrai o JSON final."""
    fake_api_response = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {"thought": True, "text": "Analisando prompt do usuário e gerando raciocínio..."},
                        {"thought": True, "text": "Etapa 2 do pensamento interno."},
                        {"thought": False, "text": '{"status": "ok", "model": "gemma-4-31b-it"}'},
                    ],
                    "role": "model",
                }
            }
        ]
    }

    mock_resp = AsyncMock()
    mock_resp.status_code = 200
    mock_resp.json = lambda: fake_api_response

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp

        res = await ai_service._call_gemini(
            prompt="Teste",
            system_instruction="Instruções",
            api_key="AQ.fake_key",
            model="gemma-4-31b-it",
        )

        assert '{"status": "ok", "model": "gemma-4-31b-it"}' in res
        assert "raciocínio" not in res

