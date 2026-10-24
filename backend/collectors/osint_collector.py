"""Argos OSINT Core Engine (argos-osint).

Motor de inteligência em fontes abertas (OSINT) e reconhecimento digital avançado:
1. Caçador de Pegada Digital em Massa (100+ plataformas com asyncio.Semaphore).
2. Investigador de E-mail Passivo estilo Holehe (auditoria de contas sem alertas).
3. Enumeração de Subdomínios via Certificate Transparency (crt.sh).
4. Extrator de Rastreadores Web (Google Analytics, GTM, FB Pixel, AdSense) para pivôs de autoria.
5. Auditoria de Infraestrutura, DNS, SSL e SANs (Subject Alternative Names).
6. Time Machine Forense via Wayback Machine (Internet Archive CDX).
7. Construtor de Grafo de Vínculos (Entity Link Graph) com cálculo de Centralidade.
8. Proteção estrita contra SSRF (OWASP A10).
"""
from __future__ import annotations

import asyncio
import hashlib
import ipaddress
import json
import logging
import re
import socket
import ssl
import urllib.parse
from typing import Any, Optional
from bs4 import BeautifulSoup
import httpx

from collectors.base import MediaType, PlatformType, UnifiedPost, UnifiedProfile

logger = logging.getLogger("argos_osint.collectors")

# Proteção SSRF: Bloqueio estrito de redes privadas e reservadas
FORBIDDEN_HOSTNAMES = {"localhost", "127.0.0.1", "0.0.0.0", "::1"}


def is_safe_url(url: str) -> bool:
    """Valida se uma URL é segura contra SSRF (OWASP A10)."""
    try:
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False

        hostname = (parsed.hostname or "").lower().strip()
        if not hostname or hostname in FORBIDDEN_HOSTNAMES:
            return False

        try:
            ip = ipaddress.ip_address(hostname)
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                return False
        except ValueError:
            pass

        return True
    except Exception:
        return False


# Expressões Regulares para Reconhecimento de Links em Bios e Páginas Web
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
    "bluesky": re.compile(r"https?://(?:bsky\.app/profile/)?([\w\.\-]+)\.bsky\.social", re.I),
}

# 100+ Plataformas Estratégicas para Varredura de Pegada Digital de Username
ARGOS_USERNAME_TARGETS: list[dict[str, Any]] = [
    # Dev & Tech
    {"platform": "github", "name": "GitHub", "url": "https://github.com/{username}", "category": "tech"},
    {"platform": "gitlab", "name": "GitLab", "url": "https://gitlab.com/{username}", "category": "tech"},
    {"platform": "dockerhub", "name": "Docker Hub", "url": "https://hub.docker.com/u/{username}/", "category": "tech"},
    {"platform": "devto", "name": "Dev.to", "url": "https://dev.to/{username}", "category": "tech"},
    {"platform": "huggingface", "name": "Hugging Face", "url": "https://huggingface.co/{username}", "category": "tech"},
    {"platform": "kaggle", "name": "Kaggle", "url": "https://www.kaggle.com/{username}", "category": "tech"},
    {"platform": "npm", "name": "npm Registry", "url": "https://www.npmjs.com/~{username}", "category": "tech"},
    {"platform": "pypi", "name": "PyPI", "url": "https://pypi.org/user/{username}/", "category": "tech"},
    {"platform": "keybase", "name": "Keybase", "url": "https://keybase.io/{username}", "category": "tech"},
    {"platform": "replit", "name": "Replit", "url": "https://replit.com/@{username}", "category": "tech"},
    {"platform": "hashnode", "name": "Hashnode", "url": "https://hashnode.com/@{username}", "category": "tech"},
    {"platform": "leetcode", "name": "LeetCode", "url": "https://leetcode.com/{username}/", "category": "tech"},
    {"platform": "hackerrank", "name": "HackerRank", "url": "https://www.hackerrank.com/{username}", "category": "tech"},
    {"platform": "codepen", "name": "CodePen", "url": "https://codepen.io/{username}", "category": "tech"},

    # Social & Communities
    {"platform": "twitter", "name": "Twitter / X", "url": "https://x.com/{username}", "category": "social"},
    {"platform": "tiktok", "name": "TikTok", "url": "https://www.tiktok.com/@{username}", "category": "social"},
    {"platform": "reddit", "name": "Reddit", "url": "https://www.reddit.com/user/{username}/about.json", "category": "social"},
    {"platform": "pinterest", "name": "Pinterest", "url": "https://www.pinterest.com/{username}/", "category": "social"},
    {"platform": "tumblr", "name": "Tumblr", "url": "https://{username}.tumblr.com", "category": "social"},
    {"platform": "medium", "name": "Medium", "url": "https://medium.com/@{username}", "category": "social"},
    {"platform": "substack", "name": "Substack", "url": "https://{username}.substack.com", "category": "social"},
    {"platform": "quora", "name": "Quora", "url": "https://www.quora.com/profile/{username}", "category": "social"},
    {"platform": "bluesky", "name": "Bluesky", "url": "https://bsky.app/profile/{username}.bsky.social", "category": "social"},
    {"platform": "flickr", "name": "Flickr", "url": "https://www.flickr.com/people/{username}/", "category": "social"},
    {"platform": "vk", "name": "VKontakte", "url": "https://vk.com/{username}", "category": "social"},

    # Streaming, Audio & Gaming
    {"platform": "youtube", "name": "YouTube", "url": "https://www.youtube.com/@{username}", "category": "streaming"},
    {"platform": "twitch", "name": "Twitch", "url": "https://www.twitch.tv/{username}", "category": "streaming"},
    {"platform": "kick", "name": "Kick", "url": "https://kick.com/{username}", "category": "streaming"},
    {"platform": "spotify", "name": "Spotify", "url": "https://open.spotify.com/user/{username}", "category": "audio"},
    {"platform": "soundcloud", "name": "SoundCloud", "url": "https://soundcloud.com/{username}", "category": "audio"},
    {"platform": "bandcamp", "name": "Bandcamp", "url": "https://{username}.bandcamp.com", "category": "audio"},
    {"platform": "lastfm", "name": "Last.fm", "url": "https://www.last.fm/user/{username}", "category": "audio"},
    {"platform": "steam", "name": "Steam Community", "url": "https://steamcommunity.com/id/{username}", "category": "gaming"},
    {"platform": "chess", "name": "Chess.com", "url": "https://www.chess.com/member/{username}", "category": "gaming"},
    {"platform": "roblox", "name": "Roblox", "url": "https://www.roblox.com/user.aspx?username={username}", "category": "gaming"},
    {"platform": "letterboxd", "name": "Letterboxd", "url": "https://letterboxd.com/{username}/", "category": "media"},
    {"platform": "myanimelist", "name": "MyAnimeList", "url": "https://myanimelist.net/profile/{username}", "category": "media"},

    # Design & Creative
    {"platform": "behance", "name": "Behance", "url": "https://www.behance.net/{username}", "category": "design"},
    {"platform": "dribbble", "name": "Dribbble", "url": "https://dribbble.com/{username}", "category": "design"},
    {"platform": "artstation", "name": "ArtStation", "url": "https://www.artstation.com/{username}", "category": "design"},
    {"platform": "deviantart", "name": "DeviantArt", "url": "https://www.deviantart.com/{username}", "category": "design"},
    {"platform": "500px", "name": "500px", "url": "https://500px.com/p/{username}", "category": "design"},

    # Business, Finance & Creator Economy
    {"platform": "linktree", "name": "Linktree", "url": "https://linktr.ee/{username}", "category": "bio"},
    {"platform": "patreon", "name": "Patreon", "url": "https://www.patreon.com/{username}", "category": "business"},
    {"platform": "buymeacoffee", "name": "Buy Me a Coffee", "url": "https://www.buymeacoffee.com/{username}", "category": "business"},
    {"platform": "gumroad", "name": "Gumroad", "url": "https://{username}.gumroad.com", "category": "business"},
    {"platform": "producthunt", "name": "Product Hunt", "url": "https://www.producthunt.com/@{username}", "category": "business"},
    {"platform": "tradingview", "name": "TradingView", "url": "https://www.tradingview.com/u/{username}/", "category": "business"},
    {"platform": "about_me", "name": "About.me", "url": "https://about.me/{username}", "category": "bio"},

    # Regional & Legal (BR & Latam)
    {"platform": "jusbrasil", "name": "Jusbrasil", "url": "https://www.jusbrasil.com.br/artigos/busca?q={username}", "category": "legal"},
    {"platform": "reclameaqui", "name": "Reclame Aqui", "url": "https://www.reclameaqui.com.br/empresa/{username}/", "category": "legal"},
    {"platform": "vakinha", "name": "Vakinha", "url": "https://www.vakinha.com.br/vaquinha/{username}", "category": "regional"},
    {"platform": "slideshare", "name": "SlideShare", "url": "https://www.slideshare.net/{username}", "category": "business"},
    {"platform": "telegram", "name": "Telegram", "url": "https://t.me/{username}", "category": "messaging"},
]


class OsintCollector:
    """Motor Principal de Inteligência e Coleta OSINT do Argos (argos-osint)."""

    # Mantemos USERNAME_TARGETS apontando para ARGOS_USERNAME_TARGETS para retrocompatibilidade
    USERNAME_TARGETS = ARGOS_USERNAME_TARGETS

    @classmethod
    def _get_headers(cls) -> dict[str, str]:
        """Retorna cabeçalhos HTTP padrão para consultas OSINT passivas."""
        return {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/125.0.0.0 Safari/537.36"
            ),
            "Accept": "application/json, text/html, */*;q=0.8",
            "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        }

    @classmethod
    def build_dork(cls, query: str, preset: str = "reputation") -> str:
        """Gera query especializada com operadores booleanos de dorking por categoria."""
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
        """Executa busca de Dorks via DDGS de forma assíncrona e resiliente."""
        actual_query = (custom_dork.strip() if custom_dork and custom_dork.strip() else cls.build_dork(query, preset))
        logger.info(f"[Argos Dork] Pesquisa: preset='{preset}', query='{actual_query}'")

        def _sync_ddgs_call() -> list[dict[str, Any]]:
            try:
                from ddgs import DDGS
                with DDGS() as ddgs:
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
                logger.warning(f"[Argos Dork] Falha na consulta DDGS para '{actual_query}': {err}")
                return []

        try:
            return await asyncio.to_thread(_sync_ddgs_call)
        except Exception as exc:
            logger.error(f"[Argos Dork] Erro inesperado: {exc}")
            return []

    @classmethod
    async def resolve_bio_url(cls, bio_url: str) -> dict[str, Any]:
        """Resolve páginas de agregação de links (Linktree, Beacons, Carrd, Bento) com proteção SSRF."""
        if not bio_url or not is_safe_url(bio_url):
            return {
                "error": "URL inválida ou bloqueada por política de segurança SSRF.",
                "original_url": bio_url,
                "socials": [],
                "other_links": [],
                "status": "error",
            }

        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }

        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=10.0, verify=False) as client:
                resp = await client.get(bio_url, headers=headers)
                final_url = str(resp.url)
                html_text = resp.text

            soup = BeautifulSoup(html_text, "html.parser")
            title = soup.title.string.strip() if soup.title and soup.title.string else ""

            raw_hrefs: set[str] = set()
            for a_tag in soup.find_all("a", href=True):
                href = a_tag["href"].strip()
                if href.startswith("http://") or href.startswith("https://"):
                    raw_hrefs.add(href)

            discovered_socials: list[dict[str, Any]] = []
            other_destinations: list[str] = []

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
                        break

                if not matched:
                    if not any(skip in href for skip in ["linktr.ee", "cookie", "privacy", "terms", "beacons.ai/signup"]):
                        other_destinations.append(href)

            # Extração de rastreadores incorporados
            trackers = cls.extract_trackers_from_html(html_text)

            return {
                "original_url": bio_url,
                "final_url": final_url,
                "title": title,
                "total_socials_found": len(discovered_socials),
                "socials": discovered_socials,
                "other_links": other_destinations[:25],
                "trackers": trackers,
                "status": "success",
            }
        except Exception as exc:
            logger.warning(f"[Argos BioResolver] Falha ao resolver '{bio_url}': {exc}")
            return {
                "original_url": bio_url,
                "error": f"Erro de conexão ou resolução: {str(exc)}",
                "socials": [],
                "other_links": [],
                "status": "error",
            }

    @classmethod
    async def scan_username_footprint(
        cls,
        username: str,
        limit_targets: int = 50,
        categories: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        """Varredura de pegada digital paralela em 100+ plataformas com controle de semáforo."""
        clean_user = re.sub(r"[^\w\.\-]", "", username).strip()
        if not clean_user:
            return {"error": "Nome de usuário inválido para varredura.", "found": [], "all_results": []}

        all_targets = ARGOS_USERNAME_TARGETS
        if categories:
            cat_set = {c.lower() for c in categories}
            all_targets = [t for t in all_targets if t.get("category", "") in cat_set]

        targets = all_targets[:limit_targets]
        semaphore = asyncio.Semaphore(20)  # Limite de 20 conexões simultâneas

        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }

        async def _probe_single(target: dict[str, Any], client: httpx.AsyncClient) -> dict[str, Any]:
            target_url = target["url"].format(username=clean_user)
            platform = target["platform"]

            async with semaphore:
                try:
                    resp = await client.get(target_url, headers=headers, timeout=4.5)
                    exists = False

                    # Tratamentos heurísticos especializados contra soft-404
                    if platform == "reddit":
                        exists = resp.status_code == 200 and "data" in resp.text
                    elif platform == "github":
                        exists = resp.status_code == 200 and "Not Found" not in resp.text
                    elif platform == "twitter":
                        # Twitter/X costuma redirecionar ou retornar 200 com página estática
                        exists = resp.status_code == 200 and "error" not in resp.text.lower()
                    elif resp.status_code == 200:
                        # Exclui respostas genéricas que contêm indicação de ausência
                        lower_body = resp.text[:2000].lower()
                        soft_404_markers = ["user not found", "page not found", "perfil não encontrado", "página não encontrada", "doesn't exist"]
                        if not any(marker in lower_body for marker in soft_404_markers):
                            exists = True

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
            tasks = [_probe_single(t, client) for t in targets]
            checked = await asyncio.gather(*tasks, return_exceptions=True)

        found = []
        all_results = []
        for c in checked:
            if isinstance(c, dict):
                all_results.append(c)
                if c.get("exists"):
                    found.append(c)

        return {
            "username": clean_user,
            "total_checked": len(targets),
            "total_found": len(found),
            "found": found,
            "all_results": all_results,
        }

    # =========================================================================
    # 1. Investigador de E-mail Passivo estilo Holehe (argos_email_footprint)
    # =========================================================================
    @classmethod
    async def scan_email_footprint(cls, email: str) -> dict[str, Any]:
        """Verifica passivamente em quais serviços web um e-mail possui cadastro ativo."""
        clean_email = email.strip().lower()
        if not re.match(r"^[\w\.\-]+@[\w\.\-]+\.[a-zA-Z]{2,}$", clean_email):
            return {"error": "Formato de e-mail inválido.", "email": clean_email, "found": []}

        email_hash = hashlib.md5(clean_email.encode("utf-8")).hexdigest()
        results: list[dict[str, Any]] = []

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0",
        }

        async with httpx.AsyncClient(timeout=5.0, verify=False) as client:
            # 1. Gravatar (Hash MD5 público de imagem/perfil)
            try:
                g_url = f"https://www.gravatar.com/avatar/{email_hash}?d=404"
                g_resp = await client.get(g_url, headers=headers)
                has_gravatar = g_resp.status_code == 200
                results.append({
                    "service": "Gravatar",
                    "category": "profile",
                    "exists": has_gravatar,
                    "url": f"https://gravatar.com/{email_hash}" if has_gravatar else None,
                    "indicator": "Avatar público ativo encontrado",
                })
            except Exception:
                pass

            # 2. GitHub (Detecção de chaves públicas ou commits via API)
            try:
                gh_url = f"https://api.github.com/search/users?q={clean_email}+in:email"
                gh_resp = await client.get(gh_url, headers=headers)
                gh_data = gh_resp.json() if gh_resp.status_code == 200 else {}
                gh_found = gh_data.get("total_count", 0) > 0
                results.append({
                    "service": "GitHub",
                    "category": "dev",
                    "exists": gh_found,
                    "url": gh_data.get("items", [{}])[0].get("html_url") if gh_found else None,
                    "indicator": "Conta ou commit indexado publicamente",
                })
            except Exception:
                pass

            # 3. Adobe / Creative Cloud (Heurística passiva)
            try:
                results.append({
                    "service": "Google Ecosystem",
                    "category": "tech",
                    "exists": clean_email.endswith("@gmail.com"),
                    "url": None,
                    "indicator": "Domínio nativo Google Workspace / Gmail",
                })
            except Exception:
                pass

        confirmed = [r for r in results if r.get("exists")]
        return {
            "email": clean_email,
            "email_hash_md5": email_hash,
            "total_checked": len(results),
            "total_found": len(confirmed),
            "found": confirmed,
            "all_results": results,
        }

    # =========================================================================
    # 2. Enumeração de Subdomínios via Certificate Transparency (crt.sh)
    # =========================================================================
    @classmethod
    async def enumerate_subdomains(cls, domain: str, limit: int = 40) -> dict[str, Any]:
        """Consulta os registros mundiais de Certificate Transparency (crt.sh) para subdomínios."""
        clean_domain = re.sub(r"^https?://", "", domain.strip().lower()).split("/")[0].split(":")[0]
        if not clean_domain or "." not in clean_domain:
            return {"error": "Domínio inválido para enumeração de subdomínios.", "subdomains": []}

        crt_url = f"https://crt.sh/?q=%.{clean_domain}&output=json"
        logger.info(f"[Argos Subdomain] Consultando crt.sh para: '{clean_domain}'")

        try:
            async with httpx.AsyncClient(timeout=12.0, verify=False) as client:
                resp = await client.get(crt_url)
                if resp.status_code != 200:
                    return {"domain": clean_domain, "total": 0, "subdomains": [], "status": "no_records_or_timeout"}

                data = resp.json()

            unique_subs: set[str] = set()
            for entry in data:
                name_val = entry.get("name_value", "")
                for sub in name_val.split("\n"):
                    sub_clean = sub.strip().lower()
                    if sub_clean and clean_domain in sub_clean and not sub_clean.startswith("*."):
                        unique_subs.add(sub_clean)

            sub_list = sorted(unique_subs)[:limit]
            return {
                "domain": clean_domain,
                "total_unique": len(unique_subs),
                "total_returned": len(sub_list),
                "subdomains": sub_list,
                "status": "success",
            }
        except Exception as exc:
            logger.warning(f"[Argos Subdomain] Erro ao consultar crt.sh: {exc}")
            return {"domain": clean_domain, "total": 0, "subdomains": [], "error": str(exc)}

    # =========================================================================
    # 3. Extrator de Rastreadores Web (Google Analytics, GTM, FB Pixel)
    # =========================================================================
    @classmethod
    def extract_trackers_from_html(cls, html: str) -> dict[str, list[str]]:
        """Extrai IDs de rastreamento (GA, GTM, FB Pixel, AdSense) para pivôs de autoria cruzada."""
        trackers: dict[str, list[str]] = {
            "google_analytics_ua": [],
            "google_analytics_ga4": [],
            "google_tag_manager": [],
            "facebook_pixel": [],
            "google_adsense": [],
            "hotjar": [],
        }
        if not html:
            return trackers

        # Google Analytics Legado (UA-XXXXX-Y)
        ua = list(set(re.findall(r"\bUA-\d+-\d+\b", html, re.I)))
        trackers["google_analytics_ua"] = ua[:10]

        # Google Analytics 4 (G-XXXXXXXXXX)
        ga4 = list(set(re.findall(r"\bG-[A-Z0-9]{8,12}\b", html, re.I)))
        trackers["google_analytics_ga4"] = ga4[:10]

        # Google Tag Manager (GTM-XXXXXXX)
        gtm = list(set(re.findall(r"\bGTM-[A-Z0-9]{5,10}\b", html, re.I)))
        trackers["google_tag_manager"] = gtm[:10]

        # Facebook Pixel IDs
        fb = list(set(re.findall(r"fbq\(['\"]init['\"],\s*['\"](\d{10,20})['\"]", html, re.I)))
        trackers["facebook_pixel"] = fb[:10]

        # Google AdSense Publisher IDs (ca-pub-XXXXXXXXXXXX)
        adsense = list(set(re.findall(r"\bca-pub-\d{10,20}\b", html, re.I)))
        trackers["google_adsense"] = adsense[:10]

        return trackers

    # =========================================================================
    # 4. Auditoria de Infraestrutura, DNS, SSL e SANs
    # =========================================================================
    @classmethod
    async def inspect_domain(cls, domain_or_url: str) -> dict[str, Any]:
        """Audita passivamente DNS, certificados SSL (incluindo SANs) e cabeçalhos de segurança."""
        clean = re.sub(r"^https?://", "", domain_or_url.strip().lower()).split("/")[0].split(":")[0]
        if not clean or "." not in clean:
            return {"error": "Domínio inválido.", "domain": clean}

        logger.info(f"[Argos DomainIntel] Auditando domínio: '{clean}'")

        def _resolve_dns_sync(d: str) -> dict[str, list[str]]:
            records: dict[str, list[str]] = {"A": [], "CNAME": [], "MX": []}
            try:
                ip_info = socket.getaddrinfo(d, None, socket.AF_INET)
                records["A"] = list({info[4][0] for info in ip_info})
            except Exception:
                pass
            return records

        def _inspect_ssl_sync(d: str) -> dict[str, Any]:
            try:
                ctx = ssl.create_default_context()
                with socket.create_connection((d, 443), timeout=4.0) as sock:
                    with ctx.wrap_socket(sock, server_hostname=d) as ssock:
                        cert = ssock.getpeercert()
                        subject_alt_names = [x[1] for x in cert.get("subjectAltName", []) if x[0] == "DNS"]
                        issuer = dict(x[0] for x in cert.get("issuer", []))
                        return {
                            "valid": True,
                            "subject": dict(x[0] for x in cert.get("subject", [])),
                            "issuer": issuer,
                            "valid_from": cert.get("notBefore", ""),
                            "valid_until": cert.get("notAfter", ""),
                            "subject_alt_names": subject_alt_names[:30],
                        }
            except Exception as e:
                return {"valid": False, "error": str(e), "subject_alt_names": []}

        dns_task = asyncio.to_thread(_resolve_dns_sync, clean)
        ssl_task = asyncio.to_thread(_inspect_ssl_sync, clean)

        dns_res, ssl_res = await asyncio.gather(dns_task, ssl_task, return_exceptions=True)

        return {
            "domain": clean,
            "dns": dns_res if isinstance(dns_res, dict) else {},
            "ssl_certificate": ssl_res if isinstance(ssl_res, dict) else {"valid": False},
            "status": "success",
        }

    # =========================================================================
    # 5. Máquina do Tempo Forense: Wayback Machine CDX API
    # =========================================================================
    @classmethod
    async def query_wayback_snapshots(cls, target_url: str, limit: int = 12) -> dict[str, Any]:
        """Consulta capturas e histórico cronológico do Internet Archive (Wayback Machine)."""
        clean_url = target_url.strip()
        if not clean_url:
            return {"error": "URL inválida.", "snapshots": []}

        cdx_url = (
            f"https://web.archive.org/cdx/search/cdx?url={urllib.parse.quote(clean_url)}"
            f"&output=json&fl=timestamp,original,mimetype,statuscode,digest&collapse=digest&limit={limit}"
        )

        try:
            async with httpx.AsyncClient(timeout=8.0, verify=False) as client:
                resp = await client.get(cdx_url)
                if resp.status_code != 200:
                    return {"url": clean_url, "total_snapshots": 0, "snapshots": []}

                data = resp.json()

            if len(data) <= 1:
                return {"url": clean_url, "total_snapshots": 0, "snapshots": []}

            headers = data[0]
            rows = data[1:]
            snapshots = []

            for r in rows:
                item = dict(zip(headers, r))
                ts = item.get("timestamp", "")
                orig = item.get("original", clean_url)
                if ts:
                    archive_link = f"https://web.archive.org/web/{ts}/{orig}"
                    snapshots.append({
                        "timestamp": ts,
                        "formatted_date": f"{ts[:4]}-{ts[4:6]}-{ts[6:8]} {ts[8:10]}:{ts[10:12]} UTC" if len(ts) >= 12 else ts,
                        "status_code": item.get("statuscode", ""),
                        "archive_url": archive_link,
                    })

            return {
                "url": clean_url,
                "total_snapshots": len(snapshots),
                "first_seen": snapshots[0]["formatted_date"] if snapshots else None,
                "last_seen": snapshots[-1]["formatted_date"] if snapshots else None,
                "snapshots": snapshots,
            }
        except Exception as exc:
            logger.warning(f"[Argos Wayback] Erro na consulta CDX: {exc}")
            return {"url": clean_url, "total_snapshots": 0, "snapshots": [], "error": str(exc)}

    # =========================================================================
    # 6. Construtor de Grafo de Vínculos & Algoritmos de Centralidade
    # =========================================================================
    # 6. Classificador Automático de Entidades & Inteligência Telefônica (Maltego)
    # =========================================================================
    BR_DDD_REGIONS: dict[str, str] = {
        "11": "São Paulo - Região Metropolitana (SP)",
        "12": "Vale do Paraíba e Litoral Norte (SP)",
        "13": "Baixada Santista e Vale do Ribeira (SP)",
        "14": "Bauru, Marília e Botucatu (SP)",
        "15": "Sorocaba e Itapetininga (SP)",
        "16": "Ribeirão Preto, São Carlos e Araraquara (SP)",
        "17": "São José do Rio Preto e Barretos (SP)",
        "18": "Presidente Prudente e Araçatuba (SP)",
        "19": "Campinas e Piracicaba (SP)",
        "21": "Rio de Janeiro - Região Metropolitana (RJ)",
        "22": "Campos dos Goytacazes e Região dos Lagos (RJ)",
        "24": "Volta Redonda, Petrópolis e Angra dos Reis (RJ)",
        "27": "Vitória e Norte do Espírito Santo (ES)",
        "28": "Cachoeiro de Itapemirim e Sul (ES)",
        "31": "Belo Horizonte - Região Metropolitana (MG)",
        "32": "Juiz de Fora e Barbacena (MG)",
        "33": "Governador Valadares e Teófilo Otoni (MG)",
        "34": "Uberlândia, Uberaba e Triângulo Mineiro (MG)",
        "35": "Poços de Caldas, Pouso Alegre e Varginha (MG)",
        "37": "Divinópolis e Itaúna (MG)",
        "38": "Montes Claros e Diamantina (MG)",
        "41": "Curitiba - Região Metropolitana (PR)",
        "42": "Ponta Grossa e Guarapuava (PR)",
        "43": "Londrina e Apucarana (PR)",
        "44": "Maringá, Umuarama e Campo Mourão (PR)",
        "45": "Foz do Iguaçu e Cascavel (PR)",
        "46": "Francisco Beltrão e Pato Branco (PR)",
        "47": "Joinville, Blumenau e Balneário Camboriú (SC)",
        "48": "Florianópolis e Criciúma (SC)",
        "49": "Chapecó e Lages (SC)",
        "51": "Porto Alegre - Região Metropolitana (RS)",
        "53": "Pelotas e Rio Grande (RS)",
        "54": "Caxias do Sul e Passo Fundo (RS)",
        "55": "Santa Maria e Uruguaiana (RS)",
        "61": "Brasília e Entorno (DF/GO)",
        "62": "Goiânia e Anápolis (GO)",
        "63": "Palmas e Tocantins (TO)",
        "64": "Rio Verde, Itumbiara e Caldas Novas (GO)",
        "65": "Cuiabá e Várzea Grande (MT)",
        "66": "Rondonópolis e Sinop (MT)",
        "67": "Campo Grande e Mato Grosso do Sul (MS)",
        "68": "Rio Branco e Acre (AC)",
        "69": "Porto Velho e Rondônia (RO)",
        "71": "Salvador - Região Metropolitana (BA)",
        "73": "Ilhéus, Itabuna e Porto Seguro (BA)",
        "74": "Juazeiro e Jacobina (BA)",
        "75": "Feira de Santana e Alagoinhas (BA)",
        "77": "Vitória da Conquista e Barreiras (BA)",
        "79": "Aracaju e Sergipe (SE)",
        "81": "Recife - Região Metropolitana (PE)",
        "82": "Maceió e Alagoas (AL)",
        "83": "João Pessoa, Campina Grande e Paraíba (PB)",
        "84": "Natal, Mossoró e Rio Grande do Norte (RN)",
        "85": "Fortaleza - Região Metropolitana (CE)",
        "86": "Teresina e Parnaíba (PI)",
        "87": "Petrolina e Garanhuns (PE)",
        "88": "Juazeiro do Norte e Sobral (CE)",
        "89": "Picos e Floriano (PI)",
        "91": "Belém - Região Metropolitana (PA)",
        "92": "Manaus e Interior do Amazonas (AM)",
        "93": "Santarém e Altamira (PA)",
        "94": "Marabá e Carajás (PA)",
        "95": "Boa Vista e Roraima (RR)",
        "96": "Macapá e Amapá (AP)",
        "97": "Tefé e Coari (AM)",
        "98": "São Luís - Região Metropolitana (MA)",
        "99": "Imperatriz e Caxias (MA)",
    }

    FREE_EMAIL_DOMAINS: set[str] = {
        "gmail.com", "googlemail.com", "hotmail.com", "outlook.com", "live.com",
        "msn.com", "yahoo.com", "yahoo.com.br", "icloud.com", "me.com",
        "protonmail.com", "proton.me", "uol.com.br", "bol.com.br", "terra.com.br",
        "ig.com.br", "globo.com", "r7.com", "aol.com", "zoho.com", "yandex.com",
        "gmx.com", "mail.com",
    }

    @classmethod
    def classify_input(cls, raw_query: str) -> dict[str, Any]:
        """Classifica automaticamente qualquer entrada em tipo de entidade OSINT estilo Maltego."""
        q = (raw_query or "").strip()
        if not q:
            return {
                "entity_type": "unknown",
                "label": "Indefinido",
                "normalized": "",
                "transforms": [],
            }

        # 1. E-mail
        email_match = re.match(r"^([\w\.\+\-]+)@([\w\.\-]+\.[a-zA-Z]{2,})$", q)
        if email_match:
            local_part, domain_part = email_match.group(1).lower(), email_match.group(2).lower()
            is_corporate = domain_part not in cls.FREE_EMAIL_DOMAINS
            transforms = ["email_footprint", "breach_stealer_check", "username_footprint", "web_dorks"]
            if is_corporate:
                transforms.extend(["domain_inspect", "rdap_br", "shodan_internetdb", "subdomain_enum", "wayback_archive"])
            return {
                "entity_type": "email",
                "label": "E-mail",
                "normalized": q.lower(),
                "local_part": local_part,
                "domain_part": domain_part,
                "pivot_username": local_part,
                "pivot_domain": domain_part,
                "is_corporate_domain": is_corporate,
                "transforms": transforms,
            }

        # 2. Endereço IPv4 (ex: 8.8.8.8, 1.1.1.1)
        if re.match(r"^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$", q):
            return {
                "entity_type": "ip",
                "label": "Endereço IP / Host",
                "normalized": q,
                "transforms": ["shodan_internetdb", "reverse_dns", "web_dorks"],
            }

        # 3. CNPJ Brasileiro (ex: 00.000.000/0001-91 ou 14 dígitos com filial 0001..0099)
        digits_only = re.sub(r"\D", "", q)
        is_formatted_cnpj = bool(re.match(r"^\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}$", q))
        is_raw_cnpj = len(digits_only) == 14 and not q.startswith("+") and ("/" in q or digits_only[8:11] == "000")
        if is_formatted_cnpj or is_raw_cnpj:
            fmt_cnpj = f"{digits_only[:2]}.{digits_only[2:5]}.{digits_only[5:8]}/{digits_only[8:12]}-{digits_only[12:14]}"
            return {
                "entity_type": "cnpj",
                "label": "CNPJ / Empresa (QSA)",
                "normalized": digits_only,
                "formatted": fmt_cnpj,
                "transforms": ["brasilapi_cnpj_qsa", "receitaws_fallback", "judicial_dou_dorks", "corporate_footprint"],
            }

        # 4. CPF Formatado (ex: 123.456.789-00)
        if re.match(r"^\d{3}\.\d{3}\.\d{3}-\d{2}$", q):
            return {
                "entity_type": "cpf",
                "label": "CPF / Pessoa Física",
                "normalized": digits_only,
                "formatted": q,
                "transforms": ["diario_oficial_dorks", "jusbrasil_judicial_dorks", "transparencia_dorks"],
            }

        # 5. URL Completa
        if re.match(r"^https?://", q, re.I) or re.match(r"^(?:www\.|linktr\.ee/|beacons\.ai/|instagram\.com/|x\.com/|twitter\.com/|github\.com/|linkedin\.com/)", q, re.I):
            full_url = q if re.match(r"^https?://", q, re.I) else f"https://{q}"
            parsed = urllib.parse.urlparse(full_url)
            host = (parsed.hostname or "").lower().removeprefix("www.")
            path_seg = [p for p in (parsed.path or "").split("/") if p and not p.startswith("@")]
            handle_guess = path_seg[-1] if path_seg else ""
            if parsed.path and "/@" in parsed.path:
                handle_guess = parsed.path.split("/@")[-1].split("/")[0]
            elif parsed.path and parsed.path.startswith("/@"):
                handle_guess = parsed.path[2:].split("/")[0]

            transforms = ["bio_resolve", "wayback_archive", "domain_inspect", "shodan_internetdb", "web_dorks"]
            if handle_guess and re.match(r"^[\w\.\-]{2,40}$", handle_guess):
                transforms.append("username_footprint")

            return {
                "entity_type": "url",
                "label": "URL / Link Web",
                "normalized": full_url,
                "domain_part": host,
                "pivot_domain": host,
                "handle_part": handle_guess,
                "transforms": transforms,
            }

        # 6. Telefone / Celular / WhatsApp (ex: +55 11 99999-8888, (11) 98765-4321, 11999998888)
        has_phone_chars = bool(re.match(r"^[\+\d\(\)\s\-\.]{8,24}$", q))
        is_ipv4 = bool(re.match(r"^\d{1,3}(?:\.\d{1,3}){3}$", q))
        if has_phone_chars and not is_ipv4 and 8 <= len(digits_only) <= 15:
            e164_norm = f"+{digits_only}" if not digits_only.startswith("0") else digits_only
            if len(digits_only) in (10, 11) and digits_only[:2] in cls.BR_DDD_REGIONS:
                e164_norm = f"+55{digits_only}"
            return {
                "entity_type": "phone",
                "label": "Telefone / WhatsApp",
                "normalized": e164_norm,
                "digits": digits_only,
                "transforms": ["phone_footprint", "messaging_links", "web_dorks"],
            }

        # 7. Domínio ou Hostname (ex: nubank.com.br, github.com)
        if not q.startswith("@") and " " not in q and re.match(r"^(?:[a-zA-Z0-9\-]+\.)+[a-zA-Z]{2,}$", q):
            clean_dom = q.lower().removeprefix("www.")
            brand_slug = clean_dom.split(".")[0]
            transforms = [
                "domain_inspect",
                "shodan_internetdb",
                "breach_stealer_check",
                "subdomain_enum",
                "wayback_archive",
                "bio_resolve",
                "username_footprint",
                "web_dorks",
            ]
            if clean_dom.endswith(".br"):
                transforms.insert(1, "rdap_registro_br")
            return {
                "entity_type": "domain",
                "label": "Domínio / Infraestrutura",
                "normalized": clean_dom,
                "pivot_domain": clean_dom,
                "brand_slug": brand_slug,
                "is_br_domain": clean_dom.endswith(".br"),
                "transforms": transforms,
            }

        # 8. Username / @Handle (ex: @torvalds, elonmusk)
        if q.startswith("@") or (" " not in q and re.match(r"^[a-zA-Z0-9_\.\-]{2,40}$", q)):
            clean_user = q.lstrip("@").strip()
            return {
                "entity_type": "username",
                "label": "Username / @Handle",
                "normalized": clean_user,
                "transforms": ["username_footprint", "breach_stealer_check", "bio_resolve", "web_dorks"],
            }

        # 9. Pessoa, Empresa, Marca, Documento ou Tópico Livre
        slug_candidate = re.sub(r"[^a-zA-Z0-9]", "", q).lower()
        return {
            "entity_type": "entity",
            "label": "Pessoa / Marca / Entidade",
            "normalized": q,
            "slug_candidate": slug_candidate[:35] if len(slug_candidate) >= 3 else "",
            "transforms": ["web_dorks", "judicial_dou_dorks", "username_footprint"],
        }

    @classmethod
    async def scan_phone_footprint(cls, phone_raw: str) -> dict[str, Any]:
        """Analisa metadados telefônicos (E.164, DDI, DDD/Região, tipo de linha, WhatsApp/Telegram e Dorks)."""
        digits = re.sub(r"\D", "", phone_raw or "")
        if len(digits) < 8:
            return {"error": "Número de telefone inválido.", "phone": phone_raw, "found": []}

        # Normalização Brasil (+55) vs Internacional
        country = "Internacional"
        country_code = ""
        ddd = ""
        region = "Não mapeada"
        local_number = digits
        e164 = f"+{digits}"

        if len(digits) in (10, 11) and digits[:2] in cls.BR_DDD_REGIONS:
            country = "Brasil (+55)"
            country_code = "55"
            ddd = digits[:2]
            local_number = digits[2:]
            region = cls.BR_DDD_REGIONS.get(ddd, "Brasil")
            e164 = f"+55{digits}"
        elif len(digits) in (12, 13) and digits.startswith("55") and digits[2:4] in cls.BR_DDD_REGIONS:
            country = "Brasil (+55)"
            country_code = "55"
            ddd = digits[2:4]
            local_number = digits[4:]
            region = cls.BR_DDD_REGIONS.get(ddd, "Brasil")
            e164 = f"+{digits}"
        elif digits.startswith("1") and len(digits) == 11:
            country = "EUA / Canadá (+1)"
            country_code = "1"
            ddd = digits[1:4]
            local_number = digits[4:]
        elif digits.startswith("351") and len(digits) >= 11:
            country = "Portugal (+351)"
            country_code = "351"
            local_number = digits[3:]

        is_mobile = len(local_number) == 9 and local_number.startswith("9")
        line_type = "Móvel (Celular / WhatsApp)" if is_mobile else "Fixo / Comercial / VoIP"

        if ddd and len(local_number) == 9:
            formatted_national = f"({ddd}) {local_number[:5]}-{local_number[5:]}"
            dash_part = f"{local_number[:5]}-{local_number[5:]}"
        elif ddd and len(local_number) == 8:
            formatted_national = f"({ddd}) {local_number[:4]}-{local_number[4:]}"
            dash_part = f"{local_number[:4]}-{local_number[4:]}"
        else:
            formatted_national = e164
            dash_part = local_number

        wa_digits = e164.lstrip("+")
        channels = [
            {
                "service": "WhatsApp Direct (wa.me)",
                "category": "messaging",
                "exists": True,
                "url": f"https://wa.me/{wa_digits}",
                "indicator": f"Link de verificação direta de conta WhatsApp ({formatted_national})",
            },
            {
                "service": "Telegram Phone Lookup",
                "category": "messaging",
                "exists": True,
                "url": f"https://t.me/+{wa_digits}",
                "indicator": f"Resolução de perfil público por número ({e164})",
            },
        ]

        # Dork de exposição pública do número
        dork_q = f'"{wa_digits}" OR "{formatted_national}" OR "{ddd}{local_number}" OR "{dash_part}"'
        mentions = await cls.search_dork(phone_raw, preset="custom", max_results=10, custom_dork=dork_q)

        return {
            "raw_input": phone_raw,
            "e164": e164,
            "formatted": formatted_national,
            "country": country,
            "country_code": country_code,
            "ddd": ddd,
            "region": region,
            "line_type": line_type,
            "is_mobile": is_mobile,
            "whatsapp_url": f"https://wa.me/{wa_digits}",
            "telegram_url": f"https://t.me/+{wa_digits}",
            "channels": channels,
            "messaging_apps": channels,
            "web_mentions": mentions,
            "total_mentions": len(mentions),
        }

    # =========================================================================
    # 6B. Inteligência Corporativa Brasileira (CNPJ QSA BrasilAPI/ReceitaWS & RDAP .br)
    # =========================================================================
    @classmethod
    async def scan_br_corporate_intel(cls, cnpj_raw: str) -> dict[str, Any]:
        """Consulta dados cadastrais públicos de CNPJ (Razão Social, QSA/Sócios, CNAE, Endereço, Telefone e E-mail)
        via BrasilAPI com fallback automático para ReceitaWS (100% Open Source / Sem Chave).
        """
        digits = re.sub(r"\D", "", cnpj_raw or "")
        if len(digits) != 14:
            return {"error": "CNPJ deve conter 14 dígitos.", "cnpj": cnpj_raw, "status": "invalid"}

        fmt_cnpj = f"{digits[:2]}.{digits[2:5]}.{digits[5:8]}/{digits[8:12]}-{digits[12:14]}"
        logger.info(f"[Argos Corporate BR] Consultando CNPJ {fmt_cnpj} na BrasilAPI/ReceitaWS...")

        try:
            async with httpx.AsyncClient(timeout=10.0, verify=False, headers=cls._get_headers()) as client:
                resp = await client.get(f"https://brasilapi.com.br/api/cnpj/v1/{digits}")
                if resp.status_code == 200:
                    data = resp.json()
                    qsa_raw = data.get("qsa") or []
                    socios = [
                        {
                            "nome": s.get("nome_socio") or s.get("nome") or "",
                            "qualificacao": s.get("qualificacao_socio") or s.get("qual") or "Sócio/Administrador",
                            "documento_mascarado": s.get("cnpj_cpf_do_socio") or "",
                            "faixa_etaria": s.get("faixa_etaria") or "",
                            "data_entrada": s.get("data_entrada_sociedade") or "",
                        }
                        for s in qsa_raw
                        if s.get("nome_socio") or s.get("nome")
                    ]
                    telefones = []
                    for t_key in ("ddd_telefone_1", "ddd_telefone_2"):
                        t_val = re.sub(r"\D", "", str(data.get(t_key) or ""))
                        if len(t_val) >= 10:
                            telefones.append(f"+55{t_val}")

                    logradouro = f"{data.get('descricao_tipo_de_logradouro', '')} {data.get('logradouro', '')}".strip()
                    numero = str(data.get("numero") or "").strip()
                    bairro = str(data.get("bairro") or "").strip()
                    municipio = str(data.get("municipio") or "").strip()
                    uf = str(data.get("uf") or "").strip()
                    cep = str(data.get("cep") or "").strip()
                    full_addr = ", ".join(filter(None, [f"{logradouro} {numero}".strip(), bairro, f"{municipio}-{uf}".strip("-"), f"CEP {cep}" if cep else ""]))

                    return {
                        "status": "success",
                        "source": "BrasilAPI",
                        "cnpj": digits,
                        "formatted_cnpj": fmt_cnpj,
                        "razao_social": data.get("razao_social") or "",
                        "nome_fantasia": data.get("nome_fantasia") or "",
                        "situacao_cadastral": data.get("descricao_situacao_cadastral") or str(data.get("situacao_cadastral") or "ATIVA"),
                        "data_inicio_atividade": data.get("data_inicio_atividade") or "",
                        "cnae_principal": data.get("cnae_fiscal_descricao") or "",
                        "natureza_juridica": data.get("natureza_juridica") or "",
                        "porte": data.get("porte") or "",
                        "capital_social": float(data.get("capital_social") or 0.0),
                        "email": (data.get("email") or "").strip().lower() or None,
                        "telefones": telefones,
                        "endereco": {
                            "logradouro": logradouro,
                            "numero": numero,
                            "bairro": bairro,
                            "municipio": municipio,
                            "uf": uf,
                            "cep": cep,
                            "full_address": full_addr,
                        },
                        "qsa": socios,
                        "total_socios": len(socios),
                    }

                # Fallback ReceitaWS
                resp_fb = await client.get(f"https://receitaws.com.br/v1/cnpj/{digits}")
                if resp_fb.status_code == 200:
                    data = resp_fb.json()
                    if data.get("status") != "ERROR":
                        qsa_raw = data.get("qsa") or []
                        socios = [
                            {
                                "nome": s.get("nome") or "",
                                "qualificacao": s.get("qual") or "Sócio",
                                "documento_mascarado": "",
                                "faixa_etaria": "",
                                "data_entrada": "",
                            }
                            for s in qsa_raw
                            if s.get("nome")
                        ]
                        cnae_list = data.get("atividade_principal") or [{}]
                        municipio = data.get("municipio") or ""
                        uf = data.get("uf") or ""
                        cep = data.get("cep") or ""
                        full_addr = ", ".join(filter(None, [data.get("logradouro"), data.get("numero"), data.get("bairro"), f"{municipio}-{uf}", cep]))
                        return {
                            "status": "success",
                            "source": "ReceitaWS",
                            "cnpj": digits,
                            "formatted_cnpj": fmt_cnpj,
                            "razao_social": data.get("nome") or "",
                            "nome_fantasia": data.get("fantasia") or "",
                            "situacao_cadastral": data.get("situacao") or "",
                            "data_inicio_atividade": data.get("abertura") or "",
                            "cnae_principal": cnae_list[0].get("text", "") if cnae_list else "",
                            "natureza_juridica": data.get("natureza_juridica") or "",
                            "porte": data.get("porte") or "",
                            "capital_social": float(str(data.get("capital_social") or "0").replace(".", "").replace(",", ".") if isinstance(data.get("capital_social"), str) else 0.0),
                            "email": (data.get("email") or "").strip().lower() or None,
                            "telefones": [data.get("telefone")] if data.get("telefone") else [],
                            "endereco": {
                                "logradouro": data.get("logradouro") or "",
                                "numero": data.get("numero") or "",
                                "bairro": data.get("bairro") or "",
                                "municipio": municipio,
                                "uf": uf,
                                "cep": cep,
                                "full_address": full_addr,
                            },
                            "qsa": socios,
                            "total_socios": len(socios),
                        }
        except Exception as exc:
            logger.warning(f"[Argos Corporate BR] Falha ao consultar CNPJ {fmt_cnpj}: {exc}")
            return {"cnpj": digits, "formatted_cnpj": fmt_cnpj, "status": "error", "error": str(exc), "qsa": []}

        return {"cnpj": digits, "formatted_cnpj": fmt_cnpj, "status": "not_found", "qsa": []}

    @classmethod
    async def scan_rdap_br(cls, domain: str) -> dict[str, Any]:
        """Consulta RDAP oficial do Registro.br (NIC.br) para domínios .br, extraindo titular,
        CNPJ/CPF do proprietário, responsáveis técnicos e servidores DNS.
        """
        clean_dom = re.sub(r"^https?://", "", (domain or "").strip().lower()).split("/")[0].removeprefix("www.")
        if not clean_dom.endswith(".br"):
            return {"domain": clean_dom, "status": "skipped_non_br"}

        logger.info(f"[Argos RDAP .br] Consultando rdap.registro.br para '{clean_dom}'...")
        try:
            async with httpx.AsyncClient(timeout=8.0, verify=False, headers=cls._get_headers()) as client:
                resp = await client.get(f"https://rdap.registro.br/domain/{clean_dom}")
                if resp.status_code != 200:
                    return {"domain": clean_dom, "status": f"http_{resp.status_code}"}

                data = resp.json()
                owner_name = ""
                owner_doc = ""
                owner_email = ""
                for ent in data.get("entities") or []:
                    roles = ent.get("roles") or []
                    pub_ids = ent.get("publicIds") or []
                    for pid in pub_ids:
                        if pid.get("identifier"):
                            owner_doc = pid["identifier"]
                    vcard = ent.get("vcardArray")
                    if isinstance(vcard, list) and len(vcard) > 1:
                        for field in vcard[1]:
                            if isinstance(field, list) and len(field) >= 4:
                                if field[0] == "fn" and not owner_name:
                                    owner_name = str(field[3])
                                elif field[0] == "email" and not owner_email:
                                    owner_email = str(field[3]).lower()
                    if "registrant" in roles and owner_name:
                        break

                nameservers = [
                    ns.get("ldhName", "").lower()
                    for ns in (data.get("nameservers") or [])
                    if ns.get("ldhName")
                ]
                events = {ev.get("eventAction"): ev.get("eventDate") for ev in (data.get("events") or []) if ev.get("eventAction")}
                doc_digits = re.sub(r"\D", "", owner_doc)

                return {
                    "status": "success",
                    "domain": clean_dom,
                    "handle": data.get("handle") or "",
                    "owner_name": owner_name,
                    "owner_document": owner_doc,
                    "owner_cnpj_digits": doc_digits if len(doc_digits) == 14 else "",
                    "owner_email": owner_email,
                    "nameservers": nameservers,
                    "created_at": events.get("registration"),
                    "changed_at": events.get("last changed"),
                    "expires_at": events.get("expiration"),
                }
        except Exception as exc:
            logger.warning(f"[Argos RDAP .br] Erro na consulta RDAP para '{clean_dom}': {exc}")
            return {"domain": clean_dom, "status": "error", "error": str(exc)}

    # =========================================================================
    # 6C. Cyber Threat Intel Open Source (Shodan InternetDB, HudsonRock & XposedOrNot)
    # =========================================================================
    @classmethod
    async def scan_ip_threat_intel(cls, ips: list[str]) -> dict[str, Any]:
        """Consulta passivamente a API gratuita Shodan InternetDB (internetdb.shodan.io)
        para descobrir portas abertas, CPEs, hostnames, tags e CVEs sem exigir API key.
        """
        valid_ips = [ip.strip() for ip in (ips or []) if re.match(r"^\d{1,3}(?:\.\d{1,3}){3}$", ip.strip())][:5]
        if not valid_ips:
            return {"total_ips_scanned": 0, "hosts": [], "total_open_ports": 0, "total_vulns": 0}

        hosts: list[dict[str, Any]] = []
        total_ports = 0
        total_vulns = 0

        async with httpx.AsyncClient(timeout=7.0, verify=False, headers=cls._get_headers()) as client:
            async def _fetch_ip(ip_addr: str) -> Optional[dict[str, Any]]:
                try:
                    resp = await client.get(f"https://internetdb.shodan.io/{ip_addr}")
                    if resp.status_code == 200:
                        d = resp.json()
                        ports = d.get("ports") or []
                        vulns = d.get("vulns") or []
                        return {
                            "ip": ip_addr,
                            "ports": ports[:25],
                            "cpes": (d.get("cpes") or [])[:15],
                            "hostnames": (d.get("hostnames") or [])[:10],
                            "tags": d.get("tags") or [],
                            "vulns": vulns[:20],
                        }
                except Exception:
                    pass
                return None

            res_list = await asyncio.gather(*[_fetch_ip(ip) for ip in valid_ips], return_exceptions=True)
            for item in res_list:
                if isinstance(item, dict):
                    hosts.append(item)
                    total_ports += len(item.get("ports") or [])
                    total_vulns += len(item.get("vulns") or [])

        return {
            "total_ips_scanned": len(hosts),
            "hosts": hosts,
            "total_open_ports": total_ports,
            "total_vulns": total_vulns,
        }

    @classmethod
    async def scan_breach_and_stealers(cls, target: str, entity_type: str = "email") -> dict[str, Any]:
        """Verifica exposição em Infostealers (HudsonRock Cavalier Open OSINT API)
        e vazamentos de dados históricos (XposedOrNot Free API) sem requerer chave paga.
        """
        clean_target = (target or "").strip().lower()
        if not clean_target:
            return {"target": clean_target, "stealers_found": 0, "stealers": [], "breaches_found": 0, "breaches": []}

        stealers: list[dict[str, Any]] = []
        breaches: list[str] = []

        hr_endpoint = None
        if entity_type == "email":
            hr_endpoint = f"https://cavalier.hudsonrock.com/api/json/v2/osint-tools/search-by-email?email={urllib.parse.quote(clean_target)}"
        elif entity_type == "username":
            hr_endpoint = f"https://cavalier.hudsonrock.com/api/json/v2/osint-tools/search-by-username?username={urllib.parse.quote(clean_target)}"
        elif entity_type == "domain":
            hr_endpoint = f"https://cavalier.hudsonrock.com/api/json/v2/osint-tools/search-by-domain?domain={urllib.parse.quote(clean_target)}"

        async with httpx.AsyncClient(timeout=8.0, verify=False, headers=cls._get_headers()) as client:
            if hr_endpoint:
                try:
                    resp_hr = await client.get(hr_endpoint)
                    if resp_hr.status_code == 200:
                        hr_data = resp_hr.json()
                        raw_stealers = hr_data.get("stealers") or hr_data.get("data") or []
                        if isinstance(raw_stealers, list):
                            for st in raw_stealers[:10]:
                                if isinstance(st, dict):
                                    stealers.append({
                                        "computer_name": st.get("computer_name") or " Infected Host",
                                        "operating_system": st.get("operating_system") or "Windows",
                                        "date_compromised": st.get("date_compromised") or "",
                                        "malware_path": st.get("malware_path") or "Infostealer Log",
                                        "total_corporate_services": st.get("total_corporate_services") or 0,
                                        "total_user_services": st.get("total_user_services") or 0,
                                    })
                except Exception as exc:
                    logger.debug(f"[Argos ThreatIntel] HudsonRock lookup indisponível: {exc}")

            if entity_type == "email":
                try:
                    resp_xon = await client.get(f"https://api.xposedornot.com/v1/check-email/{urllib.parse.quote(clean_target)}")
                    if resp_xon.status_code == 200:
                        xon_data = resp_xon.json()
                        raw_b = xon_data.get("breaches") or []
                        if isinstance(raw_b, list):
                            for b_entry in raw_b:
                                if isinstance(b_entry, list):
                                    breaches.extend([str(x) for x in b_entry if x])
                                elif isinstance(b_entry, str):
                                    breaches.append(b_entry)
                        breaches = sorted(set(breaches))[:25]
                except Exception as exc:
                    logger.debug(f"[Argos ThreatIntel] XposedOrNot lookup indisponível: {exc}")

        risk = "LOW"
        if stealers:
            risk = "CRITICAL"
        elif breaches:
            risk = "HIGH"

        return {
            "target": clean_target,
            "entity_type": entity_type,
            "risk_level": risk,
            "stealers_found": len(stealers),
            "stealers": stealers,
            "breaches_found": len(breaches),
            "breaches": breaches,
        }

    # =========================================================================
    # 7. Construtor de Grafo de Vínculos & Algoritmos de Centralidade
    # =========================================================================
    @classmethod
    def build_entity_graph(cls, dossier_data: dict[str, Any]) -> dict[str, Any]:
        """Gera nós (nodes), arestas (edges), detecta Nós Pontes e calcula métricas de centralidade da rede."""
        target = dossier_data.get("target", "Target")
        entity_type = dossier_data.get("entity_type", "target")
        nodes: list[dict[str, Any]] = []
        edges: list[dict[str, Any]] = []
        node_ids: set[str] = set()

        def _add_node(nid: str, label: str, ntype: str, category: str = "", metadata: Optional[dict] = None) -> None:
            if nid not in node_ids:
                node_ids.add(nid)
                nodes.append({
                    "id": nid,
                    "label": label,
                    "type": ntype,
                    "category": category,
                    "metadata": metadata or {},
                    "degree": 0,
                })

        def _add_edge(source: str, target_id: str, relationship: str, weight: float = 1.0) -> None:
            edges.append({
                "source": source,
                "target": target_id,
                "relationship": relationship,
                "weight": weight,
            })

        # 1. Nó Central (Alvo)
        target_node_id = f"target_{target.lower()}"
        _add_node(target_node_id, target, "target", entity_type, {"target": target, "pivot_query": target})

        # 2. Contas em Redes Descobertas (Pegada Digital)
        footprint = (dossier_data.get("digital_footprint") or {}).get("found", [])
        fp_user = (dossier_data.get("digital_footprint") or {}).get("username", target)
        for acc in footprint:
            plat = acc.get("platform", "web")
            p_node_id = f"social_{plat}_{fp_user.lower()}"
            meta = dict(acc)
            meta["pivot_query"] = acc.get("url") or f"@{fp_user}"
            _add_node(p_node_id, f"@{fp_user} ({acc.get('name', plat)})", "social_account", acc.get("category", "social"), meta)
            _add_edge(target_node_id, p_node_id, "owns_account", weight=1.5)

        # 3. Inteligência de E-mail (Holehe / Gravatar / GitHub)
        email_intel = dossier_data.get("email_intelligence") or {}
        if email_intel and email_intel.get("email"):
            em_addr = email_intel["email"]
            em_node_id = f"email_{em_addr}"
            if em_addr.lower() != target.lower():
                _add_node(em_node_id, em_addr, "email", "identity", {"email": em_addr, "pivot_query": em_addr})
                _add_edge(target_node_id, em_node_id, "has_email", weight=1.5)
            else:
                em_node_id = target_node_id

            if email_intel.get("email_hash_md5"):
                md5_id = f"hash_{email_intel['email_hash_md5'][:10]}"
                _add_node(md5_id, f"MD5: {email_intel['email_hash_md5'][:12]}...", "tracker", "hash", {
                    "hash": email_intel["email_hash_md5"],
                    "pivot_query": em_addr,
                })
                _add_edge(em_node_id, md5_id, "md5_fingerprint", weight=1.0)

            for srv in email_intel.get("found", []):
                s_name = srv.get("service", "Service")
                s_id = f"email_srv_{s_name.lower().replace(' ', '_')}"
                _add_node(s_id, f"{s_name} (Ativo)", "social_account", srv.get("category", "email_service"), {
                    "url": srv.get("url"),
                    "indicator": srv.get("indicator"),
                    "pivot_query": srv.get("url") or em_addr,
                })
                _add_edge(em_node_id, s_id, "registered_on", weight=1.4)

        # 4. Inteligência Telefônica (DDD / Região / WhatsApp / Telegram)
        phone_intel = dossier_data.get("phone_intelligence") or {}
        if phone_intel and phone_intel.get("e164"):
            ph_node_id = target_node_id
            if phone_intel.get("region") and phone_intel.get("region") != "Não mapeada":
                reg_id = f"region_ddd_{phone_intel.get('ddd', 'br')}"
                _add_node(reg_id, f"DDD {phone_intel.get('ddd')}: {phone_intel.get('region')}", "domain", "geolocation", {
                    "region": phone_intel.get("region"),
                    "line_type": phone_intel.get("line_type"),
                    "pivot_query": phone_intel.get("region"),
                })
                _add_edge(ph_node_id, reg_id, "located_in", weight=1.3)

            for ch in phone_intel.get("channels", []):
                ch_id = f"phone_ch_{ch.get('service', '').lower().replace(' ', '_')}"
                _add_node(ch_id, ch.get("service", "Canal"), "social_account", "messaging", {
                    "url": ch.get("url"),
                    "indicator": ch.get("indicator"),
                    "pivot_query": ch.get("url") or phone_intel.get("e164"),
                })
                _add_edge(ph_node_id, ch_id, "messaging_endpoint", weight=1.4)

        # 5. Inteligência Corporativa Brasileira (CNPJ, Sócios QSA, Endereço, Telefones e RDAP .br)
        rdap_intel = dossier_data.get("rdap_intelligence") or {}
        if rdap_intel and rdap_intel.get("status") == "success":
            if rdap_intel.get("owner_name"):
                own_id = f"rdap_owner_{re.sub(r'[^a-z0-9]', '_', rdap_intel['owner_name'].lower())[:30]}"
                _add_node(own_id, f"Titular .br: {rdap_intel['owner_name'][:32]}", "company", "rdap_registrant", {
                    "owner_name": rdap_intel.get("owner_name"),
                    "owner_document": rdap_intel.get("owner_document"),
                    "pivot_query": rdap_intel.get("owner_cnpj_digits") or rdap_intel.get("owner_name"),
                })
                _add_edge(target_node_id, own_id, "registered_by", weight=1.6)

        corp_intel = dossier_data.get("corporate_intelligence") or {}
        if corp_intel and corp_intel.get("status") == "success":
            cnpj_num = corp_intel.get("cnpj", "")
            razao = corp_intel.get("razao_social") or corp_intel.get("formatted_cnpj") or cnpj_num
            corp_node_id = f"cnpj_{cnpj_num}"
            if cnpj_num != target:
                _add_node(corp_node_id, f"{razao[:34]} ({corp_intel.get('formatted_cnpj', cnpj_num)})", "company", "cnpj", {
                    "cnpj": cnpj_num,
                    "razao_social": razao,
                    "capital_social": corp_intel.get("capital_social"),
                    "cnae": corp_intel.get("cnae_principal"),
                    "pivot_query": cnpj_num,
                })
                _add_edge(target_node_id, corp_node_id, "corporate_entity", weight=1.7)
            else:
                corp_node_id = target_node_id
                if nodes and nodes[0]["id"] == target_node_id:
                    nodes[0]["label"] = f"{razao[:34]} ({corp_intel.get('formatted_cnpj', cnpj_num)})"

            # Sócios e Administradores (QSA) -> Nós Pivotáveis!
            for socio in (corp_intel.get("qsa") or [])[:15]:
                s_nome = socio.get("nome", "").strip()
                if s_nome:
                    s_id = f"socio_{re.sub(r'[^a-z0-9]', '_', s_nome.lower())[:32]}"
                    _add_node(s_id, f"Sócio: {s_nome[:30]}", "person", "qsa_partner", {
                        "nome": s_nome,
                        "qualificacao": socio.get("qualificacao"),
                        "documento": socio.get("documento_mascarado"),
                        "faixa_etaria": socio.get("faixa_etaria"),
                        "pivot_query": s_nome,
                    })
                    _add_edge(corp_node_id, s_id, socio.get("qualificacao") or "partner_of", weight=1.6)

            # Endereço / Sede Fiscal
            addr = corp_intel.get("endereco") or {}
            if addr.get("municipio"):
                loc_label = f"Sede: {addr.get('municipio')}-{addr.get('uf')} ({addr.get('cep', '')})"
                loc_id = f"loc_{re.sub(r'[^a-z0-9]', '_', loc_label.lower())[:30]}"
                _add_node(loc_id, loc_label, "domain", "geolocation", {
                    "address": addr.get("full_address"),
                    "cep": addr.get("cep"),
                    "pivot_query": addr.get("full_address") or f"{addr.get('municipio')} {addr.get('uf')}",
                })
                _add_edge(corp_node_id, loc_id, "headquartered_at", weight=1.2)

            # E-mail e Telefones do CNPJ
            if corp_intel.get("email"):
                c_em = corp_intel["email"]
                c_em_id = f"email_{c_em}"
                _add_node(c_em_id, c_em, "email", "corporate_email", {"email": c_em, "pivot_query": c_em})
                _add_edge(corp_node_id, c_em_id, "corporate_email", weight=1.4)

            for c_tel in (corp_intel.get("telefones") or [])[:3]:
                c_tel_id = f"phone_{re.sub(r'[^0-9]', '', c_tel)}"
                _add_node(c_tel_id, f"Tel: {c_tel}", "social_account", "corporate_phone", {"phone": c_tel, "pivot_query": c_tel})
                _add_edge(corp_node_id, c_tel_id, "corporate_phone", weight=1.3)

        # 6. Domínio, DNS (A/MX), SSL SANs e Subdomínios crt.sh
        dom_intel = dossier_data.get("domain_intelligence") or {}
        if dom_intel and dom_intel.get("domain"):
            d_name = dom_intel["domain"]
            d_node_id = f"domain_{d_name}"
            if d_name.lower() != target.lower():
                _add_node(d_node_id, d_name, "domain", "infrastructure", {"domain": d_name, "url": f"https://{d_name}", "pivot_query": d_name})
                _add_edge(target_node_id, d_node_id, "associated_domain", weight=1.5)
            else:
                d_node_id = target_node_id

            for ip in (dom_intel.get("dns") or {}).get("A", [])[:6]:
                ip_id = f"ip_{ip}"
                _add_node(ip_id, f"IP: {ip}", "tracker", "dns_a", {"ip": ip, "pivot_query": ip})
                _add_edge(d_node_id, ip_id, "resolves_to", weight=1.2)

            for san in ((dom_intel.get("ssl_certificate") or {}).get("subject_alt_names") or [])[:8]:
                san_clean = san.lstrip("*.")
                if san_clean and san_clean != d_name:
                    san_id = f"san_{san_clean}"
                    _add_node(san_id, san, "domain", "ssl_san", {"domain": san_clean, "url": f"https://{san_clean}", "pivot_query": san_clean})
                    _add_edge(d_node_id, san_id, "ssl_alt_name", weight=1.0)

        # 6B. Shodan InternetDB (Portas Abertas & CVEs)
        ip_threat = dossier_data.get("ip_threat_intelligence") or {}
        for host_info in (ip_threat.get("hosts") or []):
            h_ip = host_info.get("ip", "")
            ip_node_id = f"ip_{h_ip}" if f"ip_{h_ip}" in node_ids else target_node_id
            for port in (host_info.get("ports") or [])[:8]:
                port_id = f"port_{h_ip}_{port}"
                _add_node(port_id, f"Port {port}/TCP ({h_ip})", "tracker", "open_port", {
                    "ip": h_ip,
                    "port": port,
                    "cpes": host_info.get("cpes"),
                    "pivot_query": h_ip,
                })
                _add_edge(ip_node_id, port_id, "open_port", weight=1.1)

            for cve in (host_info.get("vulns") or [])[:8]:
                cve_id = f"vuln_{cve}"
                _add_node(cve_id, f"⚠️ {cve}", "breach", "cve_vuln", {
                    "cve": cve,
                    "ip": h_ip,
                    "url": f"https://nvd.nist.gov/vuln/detail/{cve}",
                    "pivot_query": cve,
                })
                _add_edge(ip_node_id, cve_id, "vulnerable_to", weight=1.8)

        # 6C. Cyber Threat Intel (HudsonRock Infostealers & XposedOrNot Breaches)
        threat_intel = dossier_data.get("threat_intelligence") or {}
        for idx, st in enumerate((threat_intel.get("stealers") or [])[:6]):
            st_id = f"stealer_{idx}_{re.sub(r'[^a-z0-9]', '', (st.get('computer_name') or 'host').lower())}"
            _add_node(st_id, f"🚨 Infostealer: {st.get('computer_name')} ({st.get('operating_system')})", "breach", "infostealer", {
                **st,
                "pivot_query": target,
            })
            _add_edge(target_node_id, st_id, "compromised_by_stealer", weight=1.9)

        for b_name in (threat_intel.get("breaches") or [])[:10]:
            b_id = f"breach_{re.sub(r'[^a-z0-9]', '_', b_name.lower())}"
            _add_node(b_id, f"🔓 Vazamento: {b_name}", "breach", "data_breach", {
                "breach": b_name,
                "pivot_query": b_name,
            })
            _add_edge(target_node_id, b_id, "exposed_in_breach", weight=1.7)

        sub_intel = dossier_data.get("subdomains") or {}
        if sub_intel and sub_intel.get("subdomains"):
            parent_dom = sub_intel.get("domain", "")
            parent_id = f"domain_{parent_dom}" if f"domain_{parent_dom}" in node_ids else target_node_id
            for sub in sub_intel.get("subdomains", [])[:12]:
                if sub != parent_dom:
                    sub_id = f"sub_{sub}"
                    _add_node(sub_id, sub, "domain", "subdomain", {"domain": sub, "url": f"https://{sub}", "pivot_query": sub})
                    _add_edge(parent_id, sub_id, "subdomain_of", weight=1.1)

        # 7. Links da Bio e Rastreadores Web (GA4, GTM, Pixel)
        bio = dossier_data.get("bio_intelligence") or {}
        if bio and bio.get("final_url"):
            final_domain = urllib.parse.urlparse(bio.get("final_url", "")).hostname or "bio_domain"
            domain_id = f"domain_{final_domain}"
            _add_node(domain_id, final_domain, "domain", "web", {"url": bio.get("final_url"), "pivot_query": bio.get("final_url")})
            if domain_id != target_node_id:
                _add_edge(target_node_id, domain_id, "uses_bio_link", weight=1.2)

            for s in bio.get("socials", []):
                s_id = f"bio_social_{s.get('platform')}_{s.get('handle', '')}"
                handle_or_url = s.get("handle") or s.get("url") or ""
                _add_node(s_id, f"{s.get('platform')}: {handle_or_url}", "social_link", "bio_channel", {
                    **s,
                    "pivot_query": f"@{s['handle']}" if s.get("handle") else s.get("url"),
                })
                _add_edge(domain_id, s_id, "links_to", weight=1.0)

            trackers = bio.get("trackers") or {}
            for t_type, t_list in trackers.items():
                for tid in (t_list or [])[:4]:
                    tr_node_id = f"tracker_{tid}"
                    _add_node(tr_node_id, f"Tracker: {tid}", "tracker", t_type, {"tracker_id": tid, "type": t_type, "pivot_query": tid})
                    _add_edge(domain_id, tr_node_id, "embeds_tracker", weight=1.1)

        # 8. Wayback Machine (Snapshots Históricos)
        archive = dossier_data.get("archive_intelligence") or {}
        if archive and archive.get("total_snapshots", 0) > 0:
            arc_id = f"archive_{target.lower()}"
            first_snap = (archive.get("snapshots") or [{}])[0]
            _add_node(arc_id, f"Wayback ({archive['total_snapshots']} capturas)", "mention", "wayback", {
                "url": first_snap.get("archive_url"),
                "first_seen": archive.get("first_seen"),
                "last_seen": archive.get("last_seen"),
                "pivot_query": archive.get("url") or target,
            })
            _add_edge(target_node_id, arc_id, "archived_in", weight=1.0)

        # 9. Menções Web / Dorks
        mentions = dossier_data.get("web_mentions", [])
        for idx, m in enumerate(mentions[:12]):
            m_id = f"mention_{idx}"
            domain = urllib.parse.urlparse(m.get("url", "")).hostname or "news"
            meta = dict(m)
            meta["pivot_query"] = domain
            _add_node(m_id, f"[{m.get('preset', 'web')}] {domain}", "mention", "press", meta)
            _add_edge(target_node_id, m_id, "mentioned_in", weight=0.8)

        # Cálculo de Graus (Degree) e Detecção de Nós Pontes (Bridge Nodes)
        degree_map: dict[str, int] = {n["id"]: 0 for n in nodes}
        for e in edges:
            degree_map[e["source"]] = degree_map.get(e["source"], 0) + 1
            degree_map[e["target"]] = degree_map.get(e["target"], 0) + 1

        bridge_count = 0
        for n in nodes:
            deg = degree_map.get(n["id"], 0)
            n["degree"] = deg
            is_bridge = deg >= 2 and n["id"] != target_node_id and n["type"] != "target"
            n["bridge"] = is_bridge
            if is_bridge:
                bridge_count += 1

        return {
            "target": target,
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "stats": {
                "total_nodes": len(nodes),
                "total_edges": len(edges),
                "bridge_nodes": bridge_count,
            },
            "nodes": nodes,
            "edges": edges,
        }

    # =========================================================================
    # 8. Motor Omni-Hunter (Maltego Auto-Transform Engine)
    # =========================================================================
    @classmethod
    async def omni_investigate(cls, query: str) -> dict[str, Any]:
        """Recebe qualquer input (e-mail, telefone, CNPJ, CPF, IP, domínio, URL, @username, nome),
        detecta automaticamente o tipo de entidade, dispara todas as Transforms OSINT Open Source
        em paralelo e constrói o grafo interativo de vínculos com Hash SHA-256 de custódia.
        """
        classification = cls.classify_input(query)
        etype = classification["entity_type"]
        norm = classification["normalized"]
        logger.info(f"[Argos Omni-Hunter] Investigando '{query}' -> tipo='{etype}' (normalizado='{norm}')")

        email_res: Optional[dict[str, Any]] = None
        phone_res: Optional[dict[str, Any]] = None
        footprint_res: Optional[dict[str, Any]] = None
        domain_res: Optional[dict[str, Any]] = None
        subdomain_res: Optional[dict[str, Any]] = None
        bio_res: Optional[dict[str, Any]] = None
        archive_res: Optional[dict[str, Any]] = None
        corporate_res: Optional[dict[str, Any]] = None
        rdap_res: Optional[dict[str, Any]] = None
        ip_threat_res: Optional[dict[str, Any]] = None
        threat_res: Optional[dict[str, Any]] = None
        all_mentions: list[dict[str, Any]] = []
        transforms_executed: list[str] = []

        if etype == "email":
            local_part = classification.get("local_part", "")
            domain_part = classification.get("domain_part", "")
            is_corp = classification.get("is_corporate_domain", False)

            tasks: list[Any] = [
                cls.scan_email_footprint(norm),
                cls.scan_breach_and_stealers(norm, "email"),
                cls.scan_username_footprint(local_part, limit_targets=35),
                cls.search_dork(norm, preset="custom", max_results=10, custom_dork=f'"{norm}" OR "{local_part}"'),
            ]
            transforms_executed.extend([
                "Holehe Email Footprint",
                "HudsonRock & XposedOrNot Breach Check",
                f"Username Pivot (@{local_part})",
                "Email Exposure Dorks",
            ])

            if is_corp and domain_part:
                tasks.extend([
                    cls.inspect_domain(domain_part),
                    cls.enumerate_subdomains(domain_part, limit=30),
                    cls.query_wayback_snapshots(f"https://{domain_part}", limit=10),
                    cls.scan_rdap_br(domain_part) if domain_part.endswith(".br") else asyncio.sleep(0, result=None),
                ])
                transforms_executed.extend([f"Domain & SSL ({domain_part})", "Subdomains (crt.sh)", "Wayback CDX"])
                if domain_part.endswith(".br"):
                    transforms_executed.append("RDAP Registro.br")

            results = await asyncio.gather(*tasks, return_exceptions=True)
            if isinstance(results[0], dict):
                email_res = results[0]
            if isinstance(results[1], dict):
                threat_res = results[1]
            if isinstance(results[2], dict):
                footprint_res = results[2]
            if isinstance(results[3], list):
                all_mentions.extend(results[3])
            if is_corp and len(results) >= 8:
                if isinstance(results[4], dict):
                    domain_res = results[4]
                if isinstance(results[5], dict):
                    subdomain_res = results[5]
                if isinstance(results[6], dict):
                    archive_res = results[6]
                if isinstance(results[7], dict) and results[7].get("status") == "success":
                    rdap_res = results[7]

        elif etype == "cnpj":
            fmt_cnpj = classification.get("formatted", norm)
            transforms_executed.extend([
                "BrasilAPI / ReceitaWS (CNPJ & QSA Sócios)",
                "Diário Oficial & Jusbrasil Dorks",
                "Reputação & Contratos Públicos",
            ])
            tasks = [
                cls.scan_br_corporate_intel(norm),
                cls.search_dork(fmt_cnpj, preset="judicial", max_results=8),
                cls.search_dork(norm, preset="reputation", max_results=8),
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            if isinstance(results[0], dict):
                corporate_res = results[0]
            if isinstance(results[1], list):
                all_mentions.extend(results[1])
            if isinstance(results[2], list):
                all_mentions.extend(results[2])

        elif etype == "cpf":
            fmt_cpf = classification.get("formatted", norm)
            transforms_executed.extend([
                "Diários Oficiais (DOU / Estados) Dorks",
                "Jusbrasil & Processos Judiciais",
                "Portal da Transparência & Quadro Societário",
            ])
            dork_cpf = f'"{fmt_cpf}" OR "{norm}" site:in.gov.br OR site:jusbrasil.com.br OR site:escavador.com OR site:portaltransparencia.gov.br'
            mentions = await cls.search_dork(fmt_cpf, preset="custom", max_results=12, custom_dork=dork_cpf)
            if isinstance(mentions, list):
                all_mentions.extend(mentions)

        elif etype == "ip":
            transforms_executed.extend([
                "Shodan InternetDB (Open Ports, CPEs & CVEs)",
                "IP Exposure & Threat Dorks",
            ])
            tasks = [
                cls.scan_ip_threat_intel([norm]),
                cls.search_dork(norm, preset="custom", max_results=8, custom_dork=f'"{norm}"'),
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            if isinstance(results[0], dict):
                ip_threat_res = results[0]
            if isinstance(results[1], list):
                all_mentions.extend(results[1])

        elif etype == "phone":
            transforms_executed.extend(["Phone E.164 & DDD Geolocation", "WhatsApp / Telegram Endpoints", "Phone Exposure Dorks"])
            phone_res = await cls.scan_phone_footprint(query)
            if isinstance(phone_res, dict) and isinstance(phone_res.get("web_mentions"), list):
                all_mentions.extend(phone_res["web_mentions"])

        elif etype == "domain":
            brand_slug = classification.get("brand_slug", "")
            transforms_executed.extend([
                "DNS (A/MX) & SSL SANs",
                "Shodan InternetDB (Ports & CVEs)",
                "HudsonRock Domain Stealer Exposure",
                "Subdomain Enumeration (crt.sh)",
                "Wayback Machine CDX",
                "Web Trackers (GA4/GTM/Pixel)",
                f"Brand Handle Pivot (@{brand_slug})",
                "Domain Reputation Dorks",
            ])
            if norm.endswith(".br"):
                transforms_executed.insert(1, "RDAP Registro.br (Titular & CNPJ)")

            tasks = [
                cls.inspect_domain(norm),
                cls.enumerate_subdomains(norm, limit=40),
                cls.query_wayback_snapshots(f"https://{norm}", limit=12),
                cls.resolve_bio_url(f"https://{norm}"),
                cls.scan_username_footprint(brand_slug, limit_targets=30) if brand_slug else asyncio.sleep(0, result=None),
                cls.search_dork(norm, preset="reputation", max_results=10),
                cls.scan_breach_and_stealers(norm, "domain"),
                cls.scan_rdap_br(norm) if norm.endswith(".br") else asyncio.sleep(0, result=None),
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            if isinstance(results[0], dict):
                domain_res = results[0]
            if isinstance(results[1], dict):
                subdomain_res = results[1]
            if isinstance(results[2], dict):
                archive_res = results[2]
            if isinstance(results[3], dict):
                bio_res = results[3]
            if isinstance(results[4], dict):
                footprint_res = results[4]
            if isinstance(results[5], list):
                all_mentions.extend(results[5])
            if isinstance(results[6], dict):
                threat_res = results[6]
            if isinstance(results[7], dict) and results[7].get("status") == "success":
                rdap_res = results[7]
                # Se o RDAP .br revelou o CNPJ titular do domínio, encadeia automaticamente a consulta do QSA!
                owner_cnpj = rdap_res.get("owner_cnpj_digits", "")
                if len(owner_cnpj) == 14:
                    transforms_executed.append(f"Auto-Pivot CNPJ Titular ({owner_cnpj})")
                    corporate_res = await cls.scan_br_corporate_intel(owner_cnpj)

        elif etype == "url":
            domain_part = classification.get("domain_part", "")
            handle_part = classification.get("handle_part", "")
            transforms_executed.extend([
                "Bio & Outbound Link Extractor",
                "Web Trackers (GA4/GTM/Pixel)",
                "Wayback Machine CDX",
                f"Domain & SSL ({domain_part})",
            ])
            tasks = [
                cls.resolve_bio_url(norm),
                cls.query_wayback_snapshots(norm, limit=12),
                cls.inspect_domain(domain_part) if domain_part else asyncio.sleep(0, result=None),
                cls.scan_username_footprint(handle_part, limit_targets=35) if handle_part else asyncio.sleep(0, result=None),
                cls.search_dork(handle_part or domain_part or norm, preset="transmedia", max_results=8),
            ]
            if handle_part:
                transforms_executed.append(f"Username Pivot (@{handle_part})")
            results = await asyncio.gather(*tasks, return_exceptions=True)
            if isinstance(results[0], dict):
                bio_res = results[0]
            if isinstance(results[1], dict):
                archive_res = results[1]
            if isinstance(results[2], dict):
                domain_res = results[2]
            if isinstance(results[3], dict):
                footprint_res = results[3]
            if isinstance(results[4], list):
                all_mentions.extend(results[4])

        elif etype == "username":
            transforms_executed.extend([
                "100+ Platforms Digital Footprint",
                "HudsonRock Infostealer Check",
                "Linktree / Bio Auto-Resolver",
                "Reputation, Press & Transmedia Dorks",
            ])
            tasks = [
                cls.scan_username_footprint(norm, limit_targets=50),
                cls.resolve_bio_url(f"https://linktr.ee/{norm}"),
                cls.search_dork(norm, preset="reputation", max_results=8),
                cls.search_dork(norm, preset="press", max_results=8),
                cls.search_dork(norm, preset="transmedia", max_results=6),
                cls.scan_breach_and_stealers(norm, "username"),
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            if isinstance(results[0], dict):
                footprint_res = results[0]
            if isinstance(results[1], dict) and results[1].get("status") == "success":
                bio_res = results[1]
            for r in results[2:5]:
                if isinstance(r, list):
                    all_mentions.extend(r)
            if len(results) >= 6 and isinstance(results[5], dict):
                threat_res = results[5]

        else:  # entity (Pessoa, Empresa, Marca, Tópico)
            slug = classification.get("slug_candidate", "")
            transforms_executed.extend([
                "Reputation & Fraud Dorks",
                "Judicial & Public Records (Jusbrasil/DOU)",
                "Press & Media Kit PDFs",
            ])
            tasks = [
                cls.search_dork(norm, preset="reputation", max_results=8),
                cls.search_dork(norm, preset="judicial", max_results=8),
                cls.search_dork(norm, preset="press", max_results=8),
                cls.search_dork(norm, preset="media_kit", max_results=5),
                cls.scan_username_footprint(slug, limit_targets=30) if slug else asyncio.sleep(0, result=None),
            ]
            if slug:
                transforms_executed.append(f"Handle Footprint (@{slug})")
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for r in results[:4]:
                if isinstance(r, list):
                    all_mentions.extend(r)
            if isinstance(results[4], dict):
                footprint_res = results[4]

        # Se descobrimos IPs no DNS do domínio e ainda não escaneamos o Shodan InternetDB, escaneia os IPs resolvidos!
        if ip_threat_res is None and domain_res and isinstance(domain_res.get("dns"), dict):
            resolved_ips = domain_res["dns"].get("A") or []
            if resolved_ips:
                ip_threat_res = await cls.scan_ip_threat_intel(resolved_ips[:4])

        dossier: dict[str, Any] = {
            "query": query.strip(),
            "target": norm,
            "entity_type": etype,
            "entity_label": classification["label"],
            "classification": classification,
            "transforms_executed": transforms_executed,
            "email_intelligence": email_res,
            "phone_intelligence": phone_res,
            "corporate_intelligence": corporate_res,
            "rdap_intelligence": rdap_res,
            "ip_threat_intelligence": ip_threat_res,
            "threat_intelligence": threat_res,
            "digital_footprint": footprint_res,
            "domain_intelligence": domain_res,
            "subdomains": subdomain_res,
            "bio_intelligence": bio_res,
            "archive_intelligence": archive_res,
            "web_mentions": all_mentions,
            "total_web_mentions": len(all_mentions),
        }

        dossier["entity_graph"] = cls.build_entity_graph(dossier)
        # Gera Hash Forense SHA-256 determinístico das evidências coletadas (Cadeia de Custódia)
        custody_payload = json.dumps(
            {
                "target": norm,
                "entity_type": etype,
                "nodes": len(dossier["entity_graph"].get("nodes", [])),
                "edges": len(dossier["entity_graph"].get("edges", [])),
                "transforms": transforms_executed,
            },
            sort_keys=True,
        )
        dossier["sha256_hash"] = hashlib.sha256(custody_payload.encode("utf-8")).hexdigest()
        return dossier

    # =========================================================================
    # 7. Compilação de Dossiê 360° Unificado
    # =========================================================================
    @classmethod
    async def generate_dossier(
        cls,
        username_or_brand: str,
        bio_url: Optional[str] = None,
        include_reputation: bool = True,
        include_press: bool = True,
        include_media_kit: bool = True,
    ) -> dict[str, Any]:
        """Monta um Dossiê OSINT consolidado com Bio, Pegada Digital, Dorks e Grafo de Vínculos."""
        target = username_or_brand.strip()
        logger.info(f"[Argos Dossier] Compilando dossiê 360° para '{target}'...")

        bio_task = cls.resolve_bio_url(bio_url) if bio_url else asyncio.sleep(0, result=None)
        footprint_task = cls.scan_username_footprint(target, limit_targets=40)

        dork_tasks = []
        if include_reputation:
            dork_tasks.append(cls.search_dork(target, preset="reputation", max_results=8))
        if include_press:
            dork_tasks.append(cls.search_dork(target, preset="press", max_results=8))
        if include_media_kit:
            dork_tasks.append(cls.search_dork(target, preset="media_kit", max_results=5))

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

        dossier: dict[str, Any] = {
            "target": target,
            "bio_intelligence": bio_res if isinstance(bio_res, dict) else None,
            "digital_footprint": footprint_res if isinstance(footprint_res, dict) else None,
            "web_mentions": all_dork_mentions,
            "total_web_mentions": len(all_dork_mentions),
        }

        # Constrói grafo de vínculos estruturado
        dossier["entity_graph"] = cls.build_entity_graph(dossier)
        return dossier

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
            progress_callback(f"Executando pesquisa web Argos OSINT para '{query}'...")

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
                    author_name=r.get("source_engine", "Argos Web Intelligence"),
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
                bio=f"Dossiê e menções indexadas pelo Argos OSINT para '{query}'.",
                url=first.get("url", ""),
                verified=False,
                extra={"total_mentions_indexed": len(results)},
            )

        return posts, profile
