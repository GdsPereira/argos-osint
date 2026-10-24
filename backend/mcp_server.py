"""Servidor MCP Nativo do Argos OSINT (argos-osint).

Permite que o AGY (Antigravity CLI / IDE / Agentes Autônomos) execute
ferramentas de inteligência em fontes abertas (OSINT) via Model Context Protocol (stdio/JSON-RPC).

Execução:
    python backend/mcp_server.py
"""
from __future__ import annotations

import asyncio
import json
import logging
import sys
from pathlib import Path
from typing import Any, Optional

# Adiciona o diretório backend ao sys.path para importações locais
backend_dir = str(Path(__file__).resolve().parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Configura logger em stderr (stdout é estritamente reservado para o protocolo MCP JSON-RPC)
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [Argos-MCP] %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger("argos_mcp")

from collectors.osint_collector import OsintCollector, ARGOS_USERNAME_TARGETS

SERVER_NAME = "argos-osint"
SERVER_VERSION = "1.0.0"

# Catálogo oficial de ferramentas MCP do Argos OSINT
TOOLS_CATALOG: list[dict[str, Any]] = [
    {
        "name": "argos_scan_footprint",
        "description": "Varre a presença de um @username em mais de 100 plataformas abertas (Dev, Social, Gaming, Cripto, BR) com detecção heurística avançada.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "username": {"type": "string", "description": "Nome de usuário (@handle) do alvo."},
                "limit_targets": {"type": "integer", "description": "Quantidade máxima de plataformas para testar (padrão: 50, máx: 100).", "default": 50},
                "categories": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Filtro opcional de categorias: 'tech', 'social', 'streaming', 'audio', 'gaming', 'design', 'business', 'legal', 'regional'.",
                },
            },
            "required": ["username"],
        },
    },
    {
        "name": "argos_dork_search",
        "description": "Executa pesquisa de inteligência no Google/DuckDuckGo com operadores avançados de dorking (reputação, processos, vazamentos, mídia kits ou dorks livres).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Termo de busca, empresa, marca ou nome da pessoa."},
                "preset": {
                    "type": "string",
                    "enum": ["reputation", "press", "media_kit", "transmedia", "judicial", "custom"],
                    "description": "Preset de inteligência especializado.",
                    "default": "reputation",
                },
                "max_results": {"type": "integer", "description": "Número de resultados retornados (máx 30).", "default": 15},
                "custom_dork": {"type": "string", "description": "Query dork livre (apenas se preset for 'custom')."},
            },
            "required": ["query"],
        },
    },
    {
        "name": "argos_resolve_bio",
        "description": "Resolve e extrai todos os links sociais e canais oficiais de páginas de bio (Linktree, Beacons, Carrd, Bento) com proteção contra SSRF.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "bio_url": {"type": "string", "description": "URL pública do agregador de links da bio."},
            },
            "required": ["bio_url"],
        },
    },
    {
        "name": "argos_inspect_domain",
        "description": "Audita passivamente DNS (A/MX), certificados SSL e SANs (Subject Alternative Names) para descobrir domínios irmãos do mesmo proprietário.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "domain": {"type": "string", "description": "Domínio alvo (ex: empresa.com.br ou https://alvo.org)."},
            },
            "required": ["domain"],
        },
    },
    {
        "name": "argos_subdomain_enum",
        "description": "Enumera todos os subdomínios históricos de um domínio via logs de Certificate Transparency (crt.sh) de forma 100% passiva e indetectável.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "domain": {"type": "string", "description": "Domínio base para descoberta de subdomínios (ex: target.com)."},
                "limit": {"type": "integer", "description": "Quantidade máxima de subdomínios retornados.", "default": 40},
            },
            "required": ["domain"],
        },
    },
    {
        "name": "argos_email_footprint",
        "description": "Verifica passivamente a existência de contas vinculadas a um e-mail em serviços abertos (GitHub, Gravatar, Google Workspace) sem enviar notificações.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "email": {"type": "string", "description": "Endereço de e-mail para investigação."},
            },
            "required": ["email"],
        },
    },
    {
        "name": "argos_archive_lookup",
        "description": "Consulta a Wayback Machine (Internet Archive CDX) para obter histórico cronológico de snapshots de páginas ou bios apagadas.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "URL alvo para consulta histórica."},
                "limit": {"type": "integer", "description": "Limite de snapshots retornados.", "default": 12},
            },
            "required": ["url"],
        },
    },
    {
        "name": "argos_analyze_trackers",
        "description": "Disseca o HTML de um site e extrai IDs de rastreamento (Google Analytics UA/GA4, GTM, FB Pixel, AdSense) para provar autoria compartilhada entre sites.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "URL do site para extração de rastreadores."},
            },
            "required": ["url"],
        },
    },
    {
        "name": "argos_generate_dossier",
        "description": "Gera um Dossiê OSINT 360° consolidado unindo Pegada Digital, Dorking, Bio Links e Grafo de Vínculos Estruturado.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "target": {"type": "string", "description": "Nome de usuário ou marca alvo da investigação."},
                "bio_url": {"type": "string", "description": "URL opcional de bio agregadora."},
                "include_reputation": {"type": "boolean", "description": "Incluir dorking de reputação/reclamações.", "default": True},
                "include_press": {"type": "boolean", "description": "Incluir menções em notícias e imprensa.", "default": True},
                "include_media_kit": {"type": "boolean", "description": "Incluir busca de mídia kits/tarifários.", "default": True},
            },
            "required": ["target"],
        },
    },
]


async def handle_tool_call(name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    """Executa a ferramenta solicitada e formata a resposta para o AGY."""
    logger.info(f"Invocando ferramenta MCP: '{name}' com argumentos: {arguments}")

    if name == "argos_scan_footprint":
        username = arguments.get("username", "")
        limit = arguments.get("limit_targets", 50)
        cats = arguments.get("categories")
        res = await OsintCollector.scan_username_footprint(username, limit_targets=limit, categories=cats)
        return res

    elif name == "argos_dork_search":
        query = arguments.get("query", "")
        preset = arguments.get("preset", "reputation")
        max_r = arguments.get("max_results", 15)
        custom = arguments.get("custom_dork")
        results = await OsintCollector.search_dork(query, preset=preset, max_results=max_r, custom_dork=custom)
        return {
            "query": query,
            "preset": preset,
            "dork_used": custom or OsintCollector.build_dork(query, preset),
            "total_found": len(results),
            "results": results,
        }

    elif name == "argos_resolve_bio":
        bio_url = arguments.get("bio_url", "")
        return await OsintCollector.resolve_bio_url(bio_url)

    elif name == "argos_inspect_domain":
        domain = arguments.get("domain", "")
        return await OsintCollector.inspect_domain(domain)

    elif name == "argos_subdomain_enum":
        domain = arguments.get("domain", "")
        limit = arguments.get("limit", 40)
        return await OsintCollector.enumerate_subdomains(domain, limit=limit)

    elif name == "argos_email_footprint":
        email = arguments.get("email", "")
        return await OsintCollector.scan_email_footprint(email)

    elif name == "argos_archive_lookup":
        url = arguments.get("url", "")
        limit = arguments.get("limit", 12)
        return await OsintCollector.query_wayback_snapshots(url, limit=limit)

    elif name == "argos_analyze_trackers":
        url = arguments.get("url", "")
        bio_res = await OsintCollector.resolve_bio_url(url)
        return {
            "url": url,
            "trackers": bio_res.get("trackers", {}),
        }

    elif name == "argos_generate_dossier":
        target = arguments.get("target", "")
        bio_url = arguments.get("bio_url")
        inc_rep = arguments.get("include_reputation", True)
        inc_press = arguments.get("include_press", True)
        inc_mk = arguments.get("include_media_kit", True)
        return await OsintCollector.generate_dossier(
            username_or_brand=target,
            bio_url=bio_url,
            include_reputation=inc_rep,
            include_press=inc_press,
            include_media_kit=inc_mk,
        )

    else:
        raise ValueError(f"Ferramenta desconhecida: '{name}'")


async def main():
    """Loop principal de escuta JSON-RPC 2.0 via standard input (MCP stdio protocol)."""
    logger.info(f"Iniciando Servidor MCP '{SERVER_NAME}' v{SERVER_VERSION}...")

    while True:
        line = await asyncio.to_thread(sys.stdin.readline)
        if not line:
            break

        line = line.strip()
        if not line:
            continue

        try:
            req = json.loads(line)
        except Exception as e:
            logger.error(f"Erro ao parsear JSON-RPC: {e}")
            continue

        msg_id = req.get("id")
        method = req.get("method")
        params = req.get("params", {})

        # Resposta JSON-RPC padrão
        resp: dict[str, Any] = {"jsonrpc": "2.0", "id": msg_id}

        try:
            if method == "initialize":
                resp["result"] = {
                    "protocolVersion": "2024-11-05",
                    "serverInfo": {
                        "name": SERVER_NAME,
                        "version": SERVER_VERSION,
                    },
                    "capabilities": {
                        "tools": {"listChanged": False},
                        "resources": {"subscribe": False, "listChanged": False},
                    },
                }

            elif method == "notifications/initialized":
                # Notificação do cliente de que a inicialização foi concluída
                continue

            elif method == "ping":
                resp["result"] = {}

            elif method == "tools/list":
                resp["result"] = {"tools": TOOLS_CATALOG}

            elif method == "tools/call":
                tool_name = params.get("name", "")
                args = params.get("arguments", {})
                tool_result = await handle_tool_call(tool_name, args)
                resp["result"] = {
                    "content": [
                        {
                            "type": "text",
                            "text": json.dumps(tool_result, ensure_ascii=False, indent=2),
                        }
                    ]
                }

            elif method == "resources/list":
                resp["result"] = {
                    "resources": [
                        {
                            "uri": "argos://platforms/catalog",
                            "name": "Catálogo de Plataformas Monitoradas",
                            "mimeType": "application/json",
                            "description": "Lista de mais de 100 plataformas mapeadas pelo Argos OSINT.",
                        }
                    ]
                }

            elif method == "resources/read":
                uri = params.get("uri", "")
                if uri == "argos://platforms/catalog":
                    resp["result"] = {
                        "contents": [
                            {
                                "uri": uri,
                                "mimeType": "application/json",
                                "text": json.dumps(ARGOS_USERNAME_TARGETS, ensure_ascii=False, indent=2),
                            }
                        ]
                    }
                else:
                    resp["error"] = {"code": -32602, "message": f"Recurso não encontrado: {uri}"}

            else:
                resp["error"] = {"code": -32601, "message": f"Método não suportado: {method}"}

        except Exception as exc:
            logger.error(f"Erro ao processar método '{method}': {exc}", exc_info=True)
            resp["error"] = {"code": -32603, "message": str(exc)}

        # Escreve a resposta na saída padrão (stdout) seguida por newline
        out_line = json.dumps(resp, ensure_ascii=False) + "\n"
        sys.stdout.write(out_line)
        sys.stdout.flush()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        pass
