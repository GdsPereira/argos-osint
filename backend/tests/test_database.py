"""Testes automatizados para a persistência e resiliência no banco de dados (database, models, repository e rotas de relatórios)."""
import asyncio
import os
import pytest
from fastapi.testclient import TestClient

import database
import main
import repository
from jobs import JobStatus, job_manager


@pytest.fixture
def client():
    return TestClient(main.app)


@pytest.mark.asyncio
async def test_database_init_and_health():
    """Valida inicialização e checagem de saúde do banco de dados."""
    success = await database.init_db()
    assert success is True

    health = await database.check_db_health()
    assert health["status"] == "healthy"
    assert health["connected"] is True


@pytest.mark.asyncio
async def test_save_and_retrieve_analysis():
    """Valida persistência completa e recuperação de análise."""
    sample_data = {
        "info": {
            "username": "nike_brasil",
            "nome_completo": "Nike Brasil Oficial",
            "seguidores": 1500000,
            "seguindo": 200,
            "posts": 550,
        },
        "summary": {
            "taxa_engajamento": 3.45,
            "media_curtidas": 45000.0,
            "media_comentarios": 1200.0,
            "total_interacoes": 2500000,
            "posts_analisados": 50,
        },
        "posts": [{"shortcode": "xyz123", "curtidas": 5000, "comentarios": 100}],
        "comments": {"total": 1, "items": []},
        "source": "apify",
    }

    analysis_id = await repository.save_analysis(sample_data, job_id="job_test_123")
    assert analysis_id is not None
    assert analysis_id.startswith("anl_")

    retrieved = await repository.get_analysis_by_id(analysis_id)
    assert retrieved is not None
    assert retrieved["info"]["username"] == "nike_brasil"
    assert retrieved["summary"]["taxa_engajamento"] == 3.45
    assert retrieved["db_id"] == analysis_id
    assert len(retrieved["posts"]) == 1


@pytest.mark.asyncio
async def test_list_and_filter_analyses():
    """Valida listagem e filtros por usuário."""
    data_a = {
        "info": {"username": "adidas_br", "seguidores": 800000},
        "summary": {"taxa_engajamento": 2.1},
        "source": "apify",
    }
    data_b = {
        "info": {"username": "puma_br", "seguidores": 400000},
        "summary": {"taxa_engajamento": 1.8},
        "source": "apify",
    }

    id_a = await repository.save_analysis(data_a)
    id_b = await repository.save_analysis(data_b)

    # Lista todos
    all_reports = await repository.list_analyses(limit=10)
    usernames = [r["username"] for r in all_reports]
    assert "adidas_br" in usernames
    assert "puma_br" in usernames

    # Filtra por username
    filtered = await repository.list_analyses(username="adidas_br")
    assert len(filtered) >= 1
    assert all(r["username"] == "adidas_br" for r in filtered)


@pytest.mark.asyncio
async def test_delete_analysis():
    """Valida remoção de relatórios e integridade."""
    data = {
        "info": {"username": "temp_user", "seguidores": 10},
        "summary": {"taxa_engajamento": 0.5},
        "source": "insta",
    }
    aid = await repository.save_analysis(data)
    assert aid is not None

    deleted = await repository.delete_analysis(aid)
    assert deleted is True

    # Verifica se realmente sumiu
    not_found = await repository.get_analysis_by_id(aid)
    assert not_found is None


@pytest.mark.asyncio
async def test_save_and_list_ai_reports():
    """Valida persistência de relatórios de IA vinculados à análise."""
    data = {
        "info": {"username": "target_account", "seguidores": 50000},
        "summary": {"taxa_engajamento": 4.0},
        "source": "apify",
    }
    aid = await repository.save_analysis(data)

    diagnosis_payload = {
        "overview": "Perfil com alto engajamento orgânico",
        "score": 85,
        "recommendations": ["Aumentar postagens em vídeo"],
    }

    rep_id = await repository.save_ai_report(
        username="target_account",
        focus="opsec",
        provider="gemini",
        model="gemini-3.8-flash",
        diagnosis_data=diagnosis_payload,
        analysis_id=aid,
    )
    assert rep_id is not None
    assert rep_id.startswith("rep_")

    reports = await repository.list_ai_reports_for_analysis(aid)
    assert len(reports) == 1
    assert reports[0]["focus"] == "opsec"
    assert reports[0]["provider"] == "gemini"
    assert reports[0]["diagnosis"]["score"] == 85


@pytest.mark.asyncio
async def test_job_persistence_and_cache_recovery():
    """Valida resiliência de jobs mesmo se o cache em memória for limpo (reinício do servidor)."""
    req_data = {"username": "resilience_test", "max_posts": 10}
    job = await job_manager.create_job(req_data)

    await job_manager.update_status(
        job.id,
        JobStatus.RUNNING,
        progress="Executando teste de resiliência...",
        log_level="info",
    )

    # Simula reinicialização do container esvaziando o cache em memória
    job_manager._jobs.clear()
    assert job.id not in job_manager._jobs

    # Recupera o job diretamente do banco
    recovered = await job_manager.get_job(job.id)
    assert recovered is not None
    assert recovered.id == job.id
    assert recovered.status == JobStatus.RUNNING
    assert recovered.progress == "Executando teste de resiliência..."


def test_reports_api_endpoints(client):
    """Testa os endpoints HTTP /api/reports e /api/health/db."""
    # 1. Health DB
    resp_health = client.get("/api/health/db")
    assert resp_health.status_code == 200
    assert resp_health.json()["status"] == "healthy"

    # 2. Config com status do banco
    resp_cfg = client.get("/api/config")
    assert resp_cfg.status_code == 200
    cfg_data = resp_cfg.json()
    assert "database" in cfg_data
    assert cfg_data["database"]["connected"] is True

    # 3. Lista relatórios
    resp_list = client.get("/api/reports")
    assert resp_list.status_code == 200
    assert isinstance(resp_list.json(), list)

    # 4. 404 para ID inexistente
    resp_not_found = client.get("/api/reports/non_existent_id")
    assert resp_not_found.status_code == 404
