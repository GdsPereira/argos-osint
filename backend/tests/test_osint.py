"""Suíte de Testes Automatizados para o Coletor e Rotas OSINT (FastAPI + Pytest).
"""
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from main import app
from collectors.osint_collector import (
    OsintCollector,
    is_safe_url,
    SOCIAL_PATTERNS,
)


@pytest.fixture
def client():
    return TestClient(app)


def test_is_safe_url_validation():
    """Valida que a proteção contra SSRF bloqueia IPs privados e protocolos inválidos."""
    # URLs legítimas
    assert is_safe_url("https://instagram.com/user") is True
    assert is_safe_url("https://linktr.ee/cristiano") is True
    assert is_safe_url("http://beacons.ai/perfil") is True

    # Bloqueios SSRF
    assert is_safe_url("http://localhost/admin") is False
    assert is_safe_url("http://127.0.0.1:8000/internal") is False
    assert is_safe_url("http://0.0.0.0/") is False
    assert is_safe_url("http://192.168.1.1/router") is False
    assert is_safe_url("http://10.0.0.5/") is False
    assert is_safe_url("http://169.254.169.254/latest/meta-data/") is False
    assert is_safe_url("ftp://server.com/file") is False
    assert is_safe_url("") is False


def test_build_dork_presets():
    """Valida a formatação das queries especializadas com operadores booleanos."""
    rep = OsintCollector.build_dork("Empresa X", preset="reputation")
    assert "site:reclameaqui.com.br" in rep
    assert '"Empresa X"' in rep

    pdf = OsintCollector.build_dork("Criador Y", preset="media_kit")
    assert "filetype:pdf" in pdf
    assert '"mídia kit"' in pdf

    press = OsintCollector.build_dork("Marca Z", preset="press")
    assert "-site:instagram.com" in press
    assert "entrevista" in press

    trans = OsintCollector.build_dork("influencer", preset="transmedia")
    assert "site:tiktok.com" in trans
    assert "site:youtube.com" in trans


@pytest.mark.asyncio
async def test_search_dork_mocked():
    """Valida que a busca Dork formata os dados retornados corretamente."""
    mock_results = [
        {"title": "Resultado 1", "href": "https://news.com/artigo", "body": "Snippet sobre o alvo"},
        {"title": "Resultado 2", "href": "https://reclameaqui.com.br/queixa", "body": "Reclamação registrada"},
    ]

    with patch("ddgs.DDGS") as mock_ddgs_cls:
        mock_instance = MagicMock()
        mock_instance.text.return_value = mock_results
        mock_ddgs_cls.return_value.__enter__.return_value = mock_instance

        results = await OsintCollector.search_dork("Alvo", preset="reputation")
        assert len(results) == 2
        assert results[0]["title"] == "Resultado 1"
        assert results[0]["url"] == "https://news.com/artigo"
        assert results[0]["preset"] == "reputation"


@pytest.mark.asyncio
async def test_resolve_bio_url_mocked():
    """Valida a resolução e classificação de redes sociais a partir do HTML."""
    fake_html = """
    <html>
      <head><title>Bio de Teste</title></head>
      <body>
        <a href="https://youtube.com/@CanalOficial">YouTube</a>
        <a href="https://tiktok.com/@tiktok_user">TikTok</a>
        <a href="https://t.me/grupo_vip">Telegram</a>
        <a href="https://meusite.com/produto">Loja</a>
      </body>
    </html>
    """

    class MockResponse:
        status_code = 200
        url = "https://linktr.ee/bio_user"
        text = fake_html

    with patch("httpx.AsyncClient.get", return_value=MockResponse()):
        res = await OsintCollector.resolve_bio_url("https://linktr.ee/bio_user")
        assert res["status"] == "success"
        assert res["title"] == "Bio de Teste"
        assert res["total_socials_found"] == 3

        platforms = [s["platform"] for s in res["socials"]]
        assert "youtube" in platforms
        assert "tiktok" in platforms
        assert "telegram" in platforms
        assert "https://meusite.com/produto" in res["other_links"]


def test_api_osint_dork_endpoint(client):
    """Testa a rota POST /api/osint/dork."""
    mock_results = [{"title": "Artigo", "href": "https://site.com", "body": "Trecho"}]

    with patch.object(OsintCollector, "search_dork", return_value=mock_results):
        resp = client.post("/api/osint/dork", json={"query": "Marca", "preset": "press", "max_results": 5})
        assert resp.status_code == 200
        data = resp.json()
        assert data["query"] == "Marca"
        assert data["preset"] == "press"
        assert data["total_found"] == 1


def test_api_osint_bio_resolve_ssrf_blocked(client):
    """Testa que a rota POST /api/osint/bio-resolve rejeita tentativa de SSRF."""
    resp = client.post("/api/osint/bio-resolve", json={"url": "http://127.0.0.1:8000/secret"})
    assert resp.status_code == 400
    assert "SSRF" in resp.json()["detail"]


def test_api_osint_username_scan_endpoint(client):
    """Testa a rota POST /api/osint/username-scan."""
    mock_scan = {
        "username": "tester",
        "total_checked": 5,
        "total_found": 1,
        "found": [{"platform": "github", "url": "https://github.com/tester", "exists": True}],
        "all_results": [],
    }

    with patch.object(OsintCollector, "scan_username_footprint", return_value=mock_scan):
        resp = client.post("/api/osint/username-scan", json={"username": "tester", "limit_targets": 5})
        assert resp.status_code == 200
        data = resp.json()
        assert data["username"] == "tester"
        assert data["total_found"] == 1


def test_api_osint_dossier_endpoint(client):
    """Testa a rota POST /api/osint/dossier."""
    mock_dossier = {
        "target": "marca_teste",
        "bio_intelligence": {"total_socials_found": 2},
        "digital_footprint": {"total_found": 3},
        "web_mentions": [{"title": "Mídia", "url": "https://noticia.com"}],
        "total_web_mentions": 1,
    }

    with patch.object(OsintCollector, "generate_dossier", return_value=mock_dossier):
        resp = client.post("/api/osint/dossier", json={"target": "marca_teste", "include_reputation": True})
        assert resp.status_code == 200
        data = resp.json()
        assert data["target"] == "marca_teste"
        assert data["total_web_mentions"] == 1
