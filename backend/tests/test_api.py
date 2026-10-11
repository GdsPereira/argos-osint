"""Testes de integração para a API do FastAPI (main.py)."""
import asyncio
from unittest.mock import AsyncMock, patch
import pytest
from fastapi.testclient import TestClient

import main


@pytest.fixture
def client():
    return TestClient(main.app)


def test_config_endpoint(client):
    response = client.get("/api/config")
    assert response.status_code == 200
    data = response.json()
    assert "env" in data
    assert "apify_config" in data
    assert "actor_main" in data["apify_config"]
    assert "actor_comments" in data["apify_config"]
    assert "actor_stories" in data["apify_config"]


def test_analyze_validation_missing_token(client, monkeypatch):
    monkeypatch.delenv("APIFY_TOKEN", raising=False)
    response = client.post(
        "/api/analyze",
        json={"source": "apify", "username": "usuario_teste", "token": ""},
    )
    assert response.status_code == 400
    assert "Informe o token" in response.json()["detail"]


def test_analyze_validation_missing_username(client):
    response = client.post(
        "/api/analyze",
        json={"source": "apify", "username": "", "token": "test_token"},
    )
    assert response.status_code == 400
    assert "Informe o perfil" in response.json()["detail"]


def test_analyze_apify_success(client):
    fake_info = {
        "username": "brand_test",
        "user_id": "123",
        "nome_completo": "Brand Test",
        "bio": "Bio oficial",
        "link_externo": None,
        "seguidores": 5000,
        "seguindo": 100,
        "posts": 10,
        "igtv": 0,
        "privado": False,
        "verificado": True,
        "conta_business": True,
        "categoria_business": "Retail",
        "foto_perfil": "https://img.jpg",
        "bio_hashtags": [],
        "bio_mencoes": [],
    }
    fake_posts = [
        {
            "shortcode": "ABC1",
            "url": "https://instagram.com/p/ABC1/",
            "data": "2026-03-01T12:00:00Z",
            "tipo": "GraphImage",
            "is_video": False,
            "visualizacoes_video": None,
            "duracao_video": None,
            "curtidas": 200,
            "comentarios": 10,
            "legenda": "Super post",
            "hashtags": ["promo"],
            "mencoes": [],
            "marcados": [],
            "local": None,
            "patrocinado": False,
            "n_midias": 1,
            "fixado": False,
        }
    ]
    fake_comments = [
        {
            "shortcode": "ABC1",
            "autor": "fan1",
            "texto": "Amei!",
            "data": "2026-03-01T12:05:00Z",
            "curtidas": 1,
        }
    ]
    fake_extra = {
        "stories": [
            {
                "id": "ST1",
                "shortcode": "ST1",
                "url": "https://story.jpg",
                "tipo": "GraphImage",
                "is_video": False,
                "data": "2026-03-01T13:00:00Z",
                "expira_em": "2026-03-02T13:00:00Z",
                "visualizacoes": 150,
                "mentions": [],
                "hashtags": [],
            }
        ],
        "stories_count": 1,
    }

    with patch("collector_apify.run_pipeline_async", new=AsyncMock(return_value=(fake_info, fake_posts, fake_comments, fake_extra))):
        payload = {
            "source": "apify",
            "username": "brand_test",
            "token": "apify_token_test",
            "max_posts": 10,
            "with_comments": True,
            "with_stories": True,
        }
        response = client.post("/api/analyze", json=payload)
        assert response.status_code == 200
        res = response.json()

        # Modelo do frontend:
        assert res["source"] == "apify"
        assert res["info"]["username"] == "brand_test"
        assert "summary" in res
        assert "charts" in res
        assert "hashtags" in res
        assert "comments" in res
        assert "audience" in res
        assert "extra" in res
        assert res["extra"]["stories_count"] == 1
        assert len(res["extra"]["stories"]) == 1


def test_analyze_apify_timeout_returns_504(client):
    async def timeout_runner(*args, **kwargs):
        raise TimeoutError("Actor instagram-scraper excedeu tempo limite")

    with patch("collector_apify.run_pipeline_async", new=timeout_runner):
        payload = {
            "source": "apify",
            "username": "brand_test",
            "token": "apify_token_test",
        }
        response = client.post("/api/analyze", json=payload)
        assert response.status_code == 504
        assert "Tempo limite excedido" in response.json()["detail"]


def test_async_jobs_flow(client):
    fake_info = {
        "username": "job_user",
        "followersCount": 100,
        "seguidores": 100,
        "seguindo": 10,
        "posts": 1,
        "privado": False,
    }
    fake_posts = []
    fake_comments = []
    fake_extra = {"stories": [], "stories_count": 0}

    with patch("collector_apify.run_pipeline_async", new=AsyncMock(return_value=(fake_info, fake_posts, fake_comments, fake_extra))):
        payload = {
            "source": "apify",
            "username": "job_user",
            "token": "apify_token_test",
        }
        # Iniciar job
        resp_start = client.post("/api/analyze/async", json=payload)
        assert resp_start.status_code == 202
        start_data = resp_start.json()
        job_id = start_data["job_id"]
        assert job_id.startswith("job_")
        assert "status_url" in start_data

        # Consultar status do job
        resp_status = client.get(f"/api/jobs/{job_id}")
        assert resp_status.status_code == 200
        status_data = resp_status.json()
        assert status_data["job_id"] == job_id
        assert status_data["status"] in ("pending", "running", "completed")


def test_cancel_nonexistent_job_returns_404(client):
    response = client.delete("/api/jobs/job_inexistente_999")
    assert response.status_code == 404


def test_async_jobs_failure_flow(client):
    async def failing_runner(*args, **kwargs):
        raise ValueError("Simulated failure")

    with patch("collector_apify.run_pipeline_async", new=failing_runner):
        payload = {
            "source": "apify",
            "username": "failing_user",
            "token": "apify_token_test",
        }
        resp_start = client.post("/api/analyze/async", json=payload)
        assert resp_start.status_code == 202
        job_id = resp_start.json()["job_id"]

        resp_status = client.get(f"/api/jobs/{job_id}")
        assert resp_status.status_code == 200
        # Wait a moment for background runner to complete
        import time
        time.sleep(0.1)
        resp_status = client.get(f"/api/jobs/{job_id}")
        status_data = resp_status.json()
        assert status_data["status"] in ("running", "failed")


def test_insta_source_error_hint(client):
    def fake_insta_error(*args, **kwargs):
        raise RuntimeError("429 Too Many Requests")

    with patch("collector.get_loader", side_effect=fake_insta_error):
        payload = {
            "source": "insta",
            "username": "blocked_user",
        }
        response = client.post("/api/analyze", json=payload)
        assert response.status_code == 502
        assert "401/429 = bloqueio do Instagram" in response.json()["detail"]


def test_analyze_username_url_cleaned_correctly(client):
    fake_info = {
        "username": "natgeo",
        "seguidores": 100,
        "seguindo": 10,
        "posts": 1,
        "privado": False,
    }
    with patch("collector_apify.run_pipeline_async", new=AsyncMock(return_value=(fake_info, [], [], {}))) as mock_run:
        payload = {
            "source": "apify",
            "username": "https://www.instagram.com/natgeo/",
            "token": "tok123",
        }
        resp = client.post("/api/analyze", json=payload)
        assert resp.status_code == 200
        # Confirma que a URL foi convertida para username limpo
        assert mock_run.call_args.kwargs["username"] == "natgeo"


def test_cancel_active_job_flow(client):
    async def slow_runner(*args, **kwargs):
        await asyncio.sleep(5)
        return {}, [], [], {}

    with patch("collector_apify.run_pipeline_async", new=slow_runner):
        payload = {
            "source": "apify",
            "username": "cancel_target",
            "token": "apify_token_test",
        }
        resp_start = client.post("/api/analyze/async", json=payload)
        assert resp_start.status_code == 202
        job_id = resp_start.json()["job_id"]

        # Cancela o job
        resp_cancel = client.delete(f"/api/jobs/{job_id}")
        assert resp_cancel.status_code == 200
        assert resp_cancel.json()["status"] == "cancelled"

        # Consulta status após cancelamento
        resp_status = client.get(f"/api/jobs/{job_id}")
        assert resp_status.status_code == 200
        data = resp_status.json()
        assert data["status"] == "cancelled"
        assert "Cancelado pelo usuário" in data["progress"]


def test_job_logs_and_terminal_state_protection(client):
    from jobs import JobStatus, job_manager
    import pytest

    # Testa que jobs possuem histórico estruturado de logs
    fake_info = {"username": "log_test", "seguidores": 50, "posts": 1}
    with patch("collector_apify.run_pipeline_async", new=AsyncMock(return_value=(fake_info, [], [], {}))):
        payload = {"source": "apify", "username": "log_test", "token": "tok"}
        resp_start = client.post("/api/analyze/async", json=payload)
        job_id = resp_start.json()["job_id"]

        import time
        for _ in range(20):
            time.sleep(0.05)
            if client.get(f"/api/jobs/{job_id}").json().get("status") == "completed":
                break

        resp_status = client.get(f"/api/jobs/{job_id}")
        data = resp_status.json()
        assert "logs" in data
        assert isinstance(data["logs"], list)
        assert len(data["logs"]) > 0
        assert "timestamp" in data["logs"][0]
        assert "message" in data["logs"][0]
        assert "level" in data["logs"][0]

        # Verifica proteção: atualização tardia para RUNNING não deve reverter COMPLETED
        async def _test_no_overwrite():
            await job_manager.update_status(job_id, JobStatus.COMPLETED, "Concluído com sucesso", result={"status": "ok"})
            await job_manager.update_status(job_id, JobStatus.RUNNING, "Progresso tardio...")
            j = await job_manager.get_job(job_id)
            assert j.status == JobStatus.COMPLETED

        asyncio.run(_test_no_overwrite())


def test_proxy_image_and_video_validation_and_ssrf(client):
    # Missing parameters
    resp = client.get("/api/proxy-image")
    assert resp.status_code == 422

    resp = client.get("/api/proxy-video")
    assert resp.status_code == 422

    # SSRF / invalid URLs blocked
    resp = client.get("/api/proxy-image?url=http://127.0.0.1:8000/secret")
    assert resp.status_code == 400

    resp = client.get("/api/proxy-video?url=http://localhost:8000/secret")
    assert resp.status_code == 400

    resp = client.get("/api/proxy-video?url=ftp://example.com/video.mp4")
    assert resp.status_code == 400


def test_proxy_video_streaming_mocked(client):
    from unittest.mock import MagicMock

    class MockAsyncStreamResponse:
        status_code = 206
        headers = {
            "content-type": "video/mp4",
            "content-range": "bytes 0-100/1000",
            "content-length": "101",
            "accept-ranges": "bytes",
        }

        async def aiter_bytes(self, chunk_size=65536):
            yield b"fake_video_bytes_chunk_1"
            yield b"fake_video_bytes_chunk_2"

        async def aclose(self):
            pass

    async def mock_send(request, **kwargs):
        return MockAsyncStreamResponse()

    mock_client_instance = MagicMock()
    mock_client_instance.build_request.return_value = MagicMock()
    mock_client_instance.send = mock_send
    mock_client_instance.aclose = AsyncMock()

    with patch("httpx.AsyncClient", return_value=mock_client_instance):
        resp = client.get(
            "/api/proxy-video?url=https://scontent.cdninstagram.com/v/t50.1234/vid.mp4",
            headers={"Range": "bytes=0-100"},
        )
        assert resp.status_code == 206
        assert resp.headers.get("content-type") == "video/mp4"
        assert resp.headers.get("access-control-allow-origin") == "*"
        assert resp.headers.get("accept-ranges") == "bytes"
        assert resp.content == b"fake_video_bytes_chunk_1fake_video_bytes_chunk_2"

