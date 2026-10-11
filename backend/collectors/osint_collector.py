"""Motor e Coletor OSINT Open-Source (Dorking, Pegada Digital e Resolução de Bios).

Fornece recursos de Inteligência de Fontes Abertas (OSINT):
1. Dorking Web Inteligente (Presets de Reputação, Mídia Kit, Imprensa, Transmídia e Dorks Livres via DDG).
2. Resolução Automática de Bio Links (Linktree, Beacons, Carrd, Bento.me, Stan Store, etc.).
3. Caçador de Pegada Digital de Username (Detecção de perfis em 20+ plataformas web).
4. Suporte a SSRF defensivo (validação estrita de IPs e protocolos).
"""
from __future__ import annotations

import asyncio
import ipaddress
import logging
import re
import urllib.parse
from typing import Any, Optional
from bs4 import BeautifulSoup
import httpx

from collectors.base import MediaType, PlatformType, UnifiedPost, UnifiedProfile

logger = logging.getLogger("insta_analyzer.collectors.osint")

# Lista de hosts/redes bloqueadas para prevenir SSRF (OWASP A10)
FORBIDDEN_HOSTNAMES = {"localhost", "127.0.0.1", "0.0.0.0", "::1"}

# Plataformas para detecção de links em bios
SOCIAL_PATTERNS: dict[str, re.Pattern[str]] = {
    "youtube": re.compile(r"https?://(?:www\.)?(?:youtube\.com/(?:@|c/|channel/|user/)?[\w\-]+|youtu\.be/[\w\-]+)", re.I),
    "tiktok": re.compile(r"https?://(?:www\.)?tiktok\.com/@([\w\.\-]+)", re.I),
    "instagram": re.compile(r"https?://(?:www\.)?instagram\.com/([\w\.\-]+)", re.I),
    "twitter": re.compile(r"https?://(?:www\.)?(?:twitter\.com|x\.com)/([\w\-]+)", re.I),
    "threads": re.compile(r"https?://(?:www\.)?threads\.net/@([\w\.\-]+)", re.I),
    "linkedin": re.compile(r"https?://(?:www\.)?linkedin\.com/(?:in|company)/([\w\-]+)", re.I),
    "twitch": re.compile(r"https?://(?:www\.)?twitch\.tv/([\w\-]+)", re.I),
    "spotify": re.compile(r"https?://(?:open\.)?spotify\.com/(?:user|artist|show|episode)/([\w\-]+)", re.I),
    "telegram": re.compile(r"https?://(?:t\.me|telegram\.me)/([\w\-]+)", re.I),
    "whatsapp": re.compile(r"https?://(?:wa\.me|api\.whatsapp\.com/send\?phone=)(\d+)", re.I),
    "github": re.compile(r"https?://(?:www\.)?github\.com/([\w\-]+)", re.I),
    "discord": re.compile(r"https?://(?:discord\.gg|discord\.com/invite)/([\w\-]+)", re.I),
    "pinterest": re.compile(r"https?://(?:www\.)?pinterest\.com/([\w\-]+)", re.I),
    "patreon": re.compile(r"https?://(?:www\.)?patreon\.com/([\w\-]+)", re.I),
    "substack": re.compile(r"https?://([\w\-]+)\.substack\.com", re.I),
    "medium": re.compile(r"https?://(?:www\.)?medium\.com/@?([\w\-]+)", re.I),
}

# Assinaturas de verificação de username em plataformas abertas
USERNAME_TARGETS: list[dict[str, Any]] = [
    {"platform": "github", "name": "GitHub", "url": "https://github.com/{username}", "category": "tech"},
    {"platform": "youtube", "name": "YouTube", "url": "https://www.youtube.com/@{username}", "category": "video"},
    {"platform": "tiktok", "name": "TikTok", "url": "https://www.tiktok.com/@{username}", "category": "social"},
    {"platform": "twitter", "name": "Twitter / X", "url": "https://x.com/{username}", "category": "social"},
    {"platform": "reddit", "name": "Reddit", "url": "https://www.reddit.com/user/{username}/about.json", "category": "community"},
    {"platform": "twitch", "name": "Twitch", "url": "https://www.twitch.tv/{username}", "category": "streaming"},
    {"platform": "pinterest", "name": "Pinterest", "url": "https://www.pinterest.com/{username}/", "category": "visual"},
    {"platform": "telegram", "name": "Telegram", "url": "https://t.me/{username}", "category": "messaging"},
    {"platform": "medium", "name": "Medium", "url": "https://medium.com/@{username}", "category": "blog"},
    {"platform": "soundcloud", "name": "SoundCloud", "url": "https://soundcloud.com/{username}", "category": "audio"},
    {"platform": "spotify", "name": "Spotify", "url": "https://open.spotify.com/user/{username}", "category": "audio"},
    {"platform": "patreon", "name": "Patreon", "url": "https://www.patreon.com/{username}", "category": "community"},
    {"platform": "linktree", "name": "Linktree", "url": "https://linktr.ee/{username}", "category": "bio"},
    {"platform": "devto", "name": "Dev.to", "url": "https://dev.to/{username}", "category": "tech"},
    {"platform": "behance", "name": "Behance", "url": "https://www.behance.net/{username}", "category": "design"},
    {"platform": "dribbble", "name": "Dribbble", "url": "https://dribbble.com/{username}", "category": "design"},
]


def is_safe_url(url: str) -> bool:
    """Valida se uma URL é segura contra SSRF (OWASP A10)."""
    try:
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False

        hostname = (parsed.hostname or "").lower().strip()
        if not hostname or hostname in FORBIDDEN_HOSTNAMES:
            return False

        # Verifica se o hostname é um IP privado
        try:
            ip = ipaddress.ip_address(hostname)
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                return False
        except ValueError:
            # Não é um endereço IP direto, é um domínio normal
            pass

        return True
    except Exception:
        return False


class OsintCollector:
    """Motor de coleta e inteligência OSINT 100% Open Source."""

    @classmethod
    def build_dork(cls, query: str, preset: str = "reputation") -> str:
        """Gera query especializada com operadores de dorking por categoria."""
        clean_q = query.strip().strip("\"'")
        p = (preset or "reputation").lower()

        if p == "reputation":
            return f'"{clean_q}" (site:reclameaqui.com.br OR "reclamação" OR "reclamações" OR "fraude" OR "golpe" OR "processo" OR "denúncia")'
        elif p == "media_kit":
            return f'"{clean_q}" ("mídia kit" OR "midia kit" OR "rate card" OR "tabela de preços" OR "audiência") filetype:pdf'
        elif p == "press":
            return f'"{clean_q}" -site:instagram.com -site:facebook.com (entrevista OR podcast OR notícia OR reportagem OR matéria)'
        elif p == "transmedia":
            return f'"{clean_q}" (site:tiktok.com OR site:youtube.com OR site:linkedin.com OR site:threads.net)'
        elif p == "judicial":
            return f'"{clean_q}" (site:jusbrasil.com.br OR "processo civil" OR "processo criminal" OR "diário oficial")'
        else:
            return clean_q

    @classmethod
    async def search_dork(
        cls,
        query: str,
        preset: str = "reputation",
        max_results: int = 15,
        custom_dork: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """Executa busca de Dorks via DDGS de forma assíncrona com tolerância a falhas."""
        actual_query = (custom_dork.strip() if custom_dork and custom_dork.strip() else cls.build_dork(query, preset))
        logger.info(f"[OSINT Dork] Executando busca: preset='{preset}', query='{actual_query}'")

        def _sync_ddgs_call() -> list[dict[str, Any]]:
            try:
                from ddgs import DDGS
                with DDGS() as ddgs:
                    # Executa busca de texto com timeout embutido
                    results = list(ddgs.text(actual_query, max_results=max_results))
                    formatted = []
                    for r in results:
                        formatted.append({
                            "title": r.get("title", ""),
                            "url": r.get("href", ""),
                            "snippet": r.get("body", ""),
                            "preset": preset,
                            "source_engine": "duckduckgo_open",
                        })
                    return formatted
            except Exception as err:
                logger.warning(f"[OSINT Dork] Falha na consulta DDGS para '{actual_query}': {err}")
                return []

        # Executa em threadpool separada para garantir não-bloqueio do event loop assíncrono
        try:
            return await asyncio.to_thread(_sync_ddgs_call)
        except Exception as exc:
            logger.error(f"[OSINT Dork] Erro inesperado: {exc}")
            return []

    @classmethod
    async def resolve_bio_url(cls, bio_url: str) -> dict[str, Any]:
        """Resolve páginas de agregação de links (Linktree, Beacons, Bento, Carrd) e extrai canais oficiais."""
        if not bio_url or not is_safe_url(bio_url):
            return {
                "error": "URL inválida ou não permitida por política de segurança SSRF.",
                "original_url": bio_url,
                "socials": [],
                "other_links": [],
            }

        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        }

        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=12.0, verify=False) as client:
                resp = await client.get(bio_url, headers=headers)
                final_url = str(resp.url)
                html_text = resp.text

            soup = BeautifulSoup(html_text, "html.parser")
            title = soup.title.string.strip() if soup.title and soup.title.string else ""

            # Extrai todas as tags <a>
            raw_hrefs: set[str] = set()
            for a_tag in soup.find_all("a", href=True):
                href = a_tag["href"].strip()
                if href.startswith("http://") or href.startswith("https://"):
                    raw_hrefs.add(href)

            # Classifica redes sociais descobertas
            discovered_socials: list[dict[str, Any]] = []
            other_destinations: list[str] = []
            seen_platforms: set[str] = set()

            for href in sorted(raw_hrefs):
                matched = False
                for plat, pattern in SOCIAL_PATTERNS.items():
                    m = pattern.search(href)
                    if m:
                        matched = True
                        handle = m.group(1) if m.groups() else ""
                        discovered_socials.append({
                            "platform": plat,
                            "url": href,
                            "handle": handle,
                            "source": "bio_link",
                        })
                        seen_platforms.add(plat)
                        break

                if not matched:
                    # Filtra links de tracking internos comuns de linktree/beacons
                    if not any(skip in href for skip in ["linktr.ee", "cookie", "privacy", "terms", "beacons.ai/signup"]):
                        other_destinations.append(href)

            return {
                "original_url": bio_url,
                "final_url": final_url,
                "title": title,
                "total_socials_found": len(discovered_socials),
                "socials": discovered_socials,
                "other_links": other_destinations[:20],
                "status": "success",
            }
        except Exception as exc:
            logger.warning(f"[OSINT BioResolver] Falha ao resolver '{bio_url}': {exc}")
            return {
                "original_url": bio_url,
                "error": f"Erro de conexão ou resolução: {str(exc)}",
                "socials": [],
                "other_links": [],
                "status": "error",
            }

    @classmethod
    async def scan_username_footprint(cls, username: str, limit_targets: int = 16) -> dict[str, Any]:
        """Varre plataformas abertas para detectar se o @username possui contas criadas."""
        clean_user = re.sub(r"[^\w\.\-]", "", username).strip()
        if not clean_user:
            return {"error": "Nome de usuário inválido para varredura de pegada digital.", "found": []}

        targets = USERNAME_TARGETS[:limit_targets]
        results: list[dict[str, Any]] = []

        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
            ),
        }

        async def _check_target(target: dict[str, Any], client: httpx.AsyncClient) -> dict[str, Any]:
            target_url = target["url"].format(username=clean_user)
            platform = target["platform"]

            try:
                # Dispara requisição com timeout rígido de 5s
                resp = await client.get(target_url, headers=headers, timeout=5.0)

                # Tratamento específico para Reddit API
                if platform == "reddit":
                    exists = resp.status_code == 200 and "data" in resp.text
                elif resp.status_code == 200:
                    exists = True
                else:
                    exists = False

                return {
                    "platform": platform,
                    "name": target["name"],
                    "category": target["category"],
                    "url": target_url if exists else None,
                    "exists": exists,
                    "status_code": resp.status_code,
                }
            except Exception:
                return {
                    "platform": platform,
                    "name": target["name"],
                    "category": target["category"],
                    "url": None,
                    "exists": False,
                    "status_code": 0,
                }

        async with httpx.AsyncClient(follow_redirects=True, verify=False) as client:
            tasks = [_check_target(t, client) for t in targets]
            checked = await asyncio.gather(*tasks, return_exceptions=True)

        found = []
        for c in checked:
            if isinstance(c, dict) and c.get("exists"):
                found.append(c)
            elif isinstance(c, dict):
                results.append(c)

        return {
            "username": clean_user,
            "total_checked": len(targets),
            "total_found": len(found),
            "found": found,
            "all_results": found + results,
        }

    @classmethod
    async def generate_dossier(
        cls,
        username_or_brand: str,
        bio_url: Optional[str] = None,
        include_reputation: bool = True,
        include_press: bool = True,
        include_media_kit: bool = True,
    ) -> dict[str, Any]:
        """Monta um Dossiê OSINT unificado consolidando Bio Links, Dorking e Pegada Digital."""
        target = username_or_brand.strip()
        logger.info(f"[OSINT Dossier] Compilando dossiê de inteligência para '{target}'...")

        # 1. Tarefa de Bio Resolver (se houver link)
        bio_task = cls.resolve_bio_url(bio_url) if bio_url else asyncio.sleep(0, result=None)

        # 2. Tarefa de Pegada Digital de Username
        footprint_task = cls.scan_username_footprint(target)

        # 3. Tarefas de Dorking em paralelo
        dork_tasks = []
        if include_reputation:
            dork_tasks.append(cls.search_dork(target, preset="reputation", max_results=8))
        if include_press:
            dork_tasks.append(cls.search_dork(target, preset="press", max_results=8))
        if include_media_kit:
            dork_tasks.append(cls.search_dork(target, preset="media_kit", max_results=5))

        # Dispara tudo em paralelo
        bio_res, footprint_res, *dork_results = await asyncio.gather(
            bio_task,
            footprint_task,
            *dork_tasks,
            return_exceptions=True,
        )

        all_dork_mentions: list[dict[str, Any]] = []
        for dr in dork_results:
            if isinstance(dr, list):
                all_dork_mentions.extend(dr)

        return {
            "target": target,
            "bio_intelligence": bio_res if isinstance(bio_res, dict) else None,
            "digital_footprint": footprint_res if isinstance(footprint_res, dict) else None,
            "web_mentions": all_dork_mentions,
            "total_web_mentions": len(all_dork_mentions),
        }

    @classmethod
    async def search(
        cls,
        query: str,
        search_mode: str = "topic",
        limit: int = 25,
        token: str = "",
        progress_callback: Optional[Any] = None,
    ) -> tuple[list[UnifiedPost], Optional[UnifiedProfile]]:
        """Integração canônica com o MultiPlatformManager para buscar menções na web aberta."""
        if progress_callback:
            progress_callback(f"Executando pesquisa web OSINT / Dorking para '{query}'...")

        preset = "transmedia" if search_mode == "profile" else "press"
        results = await cls.search_dork(query, preset=preset, max_results=limit)

        posts: list[UnifiedPost] = []
        for idx, r in enumerate(results):
            post_id = f"web_{idx}_{abs(hash(r.get('url', '')))}"
            posts.append(
                UnifiedPost(
                    id=post_id,
                    platform=PlatformType.WEB,
                    url=r.get("url", ""),
                    author_username="web_mention",
                    author_name=r.get("source_engine", "Web Search"),
                    title=r.get("title", ""),
                    content=r.get("snippet", ""),
                    media_type=MediaType.ARTICLE,
                    extra={
                        "preset": r.get("preset", preset),
                        "snippet": r.get("snippet", ""),
                    },
                )
            )

        profile: Optional[UnifiedProfile] = None
        if search_mode == "profile" and results:
            first = results[0]
            profile = UnifiedProfile(
                platform=PlatformType.WEB,
                username=query,
                full_name=f"Pegada Web: {query}",
                bio=f"Dossiê e menções indexadas na web aberta para '{query}'.",
                url=first.get("url", ""),
                verified=False,
                extra={"total_mentions_indexed": len(results)},
            )

        return posts, profile
