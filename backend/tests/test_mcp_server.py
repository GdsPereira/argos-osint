"""Testes Unitários para o Servidor MCP do Argos OSINT (JSON-RPC stdio).
"""
import json
import pytest
from backend.mcp_server import handle_tool_call, TOOLS_CATALOG


def test_mcp_tools_catalog_structure():
    """Valida que todas as ferramentas do catálogo MCP possuem schemas válidos."""
    assert len(TOOLS_CATALOG) >= 8
    names = [t["name"] for t in TOOLS_CATALOG]
    assert "argos_scan_footprint" in names
    assert "argos_dork_search" in names
    assert "argos_resolve_bio" in names
    assert "argos_inspect_domain" in names
    assert "argos_subdomain_enum" in names
    assert "argos_email_footprint" in names
    assert "argos_archive_lookup" in names
    assert "argos_generate_dossier" in names

    for tool in TOOLS_CATALOG:
        assert "name" in tool
        assert "description" in tool
        assert "inputSchema" in tool
        assert tool["inputSchema"]["type"] == "object"


@pytest.mark.asyncio
async def test_mcp_tool_call_dork():
    """Valida invocação direta da ferramenta de dork via MCP."""
    res = await handle_tool_call(
        "argos_dork_search",
        {"query": "TestTarget", "preset": "reputation", "max_results": 2},
    )
    assert res["query"] == "TestTarget"
    assert "reputation" in res["preset"]
    assert "results" in res


@pytest.mark.asyncio
async def test_mcp_tool_call_domain_inspect():
    """Valida invocação da ferramenta de inspeção de domínio via MCP."""
    res = await handle_tool_call(
        "argos_inspect_domain",
        {"domain": "example.com"},
    )
    assert res["domain"] == "example.com"
    assert "dns" in res
    assert "ssl_certificate" in res


@pytest.mark.asyncio
async def test_mcp_tool_call_email_footprint():
    """Valida checagem passiva de e-mail via MCP."""
    res = await handle_tool_call(
        "argos_email_footprint",
        {"email": "security@example.com"},
    )
    assert res["email"] == "security@example.com"
    assert "email_hash_md5" in res
    assert "all_results" in res
