"""Coleta via API oficial do Instagram (Graph API).

Modos:
  - "own":       conta própria (Instagram API com Instagram Login, graph.instagram.com).
                 Token de usuário do Instagram (conta Business/Creator).
                 Traz perfil, posts, comentários, insights por post e da conta, demografia.
  - "discovery": Business Discovery (graph.facebook.com). Lê dados públicos de OUTRAS
                 contas Business/Creator. Precisa de token do Facebook Login com
                 `instagram_basic` + `pages_show_list` e do ID da SUA conta IG (ig_user_id).
                 Não traz comentários nem insights; só perfil e posts (curtidas/comentários).
"""
from __future__ import annotations

import time
from typing import Optional

import requests

VERSION = "v21.0"
IG_BASE = f"https://graph.instagram.com/{VERSION}"
FB_BASE = f"https://graph.facebook.com/{VERSION}"


class GraphError(Exception):
    pass


def _get(url: str, params: dict, token: str) -> dict:
    r = requests.get(url, params={**params, "access_token": token}, timeout=30)
    try:
        data = r.json()
    except ValueError:
        raise GraphError(f"Resposta inválida ({r.status_code})")
    if "error" in data:
        e = data["error"]
        raise GraphError(f"{e.get('message')} (code {e.get('code')}, sub {e.get('error_subcode')})")
    return data


def _paginate(url: str, params: dict, token: str, limit: int):
    n = 0
    data = _get(url, params, token)
    while True:
        for item in data.get("data", []):
            yield item
            n += 1
            if n >= limit:
                return
        nxt = data.get("paging", {}).get("next")
        if not nxt:
            return
        r = requests.get(nxt, timeout=30)
        data = r.json()
        if "error" in data:
            raise GraphError(data["error"].get("message"))


def _tipo(m: dict) -> str:
    return {"IMAGE": "GraphImage", "VIDEO": "GraphVideo", "CAROUSEL_ALBUM": "GraphSidecar"}.get(
        m.get("media_type"), m.get("media_type") or "")


def _hashtags(text: str) -> list[str]:
    import re
    return [h.lower() for h in re.findall(r"#(\w+)", text or "")]


def _mentions(text: str) -> list[str]:
    import re
    return [h.lower() for h in re.findall(r"@([\w.]+)", text or "")]


def _post_row(m: dict) -> dict:
    cap = m.get("caption") or ""
    return {
        "shortcode": m.get("shortcode") or m.get("id"),
        "url": m.get("permalink"),
        "data": m.get("timestamp"),
        "tipo": _tipo(m),
        "is_video": m.get("media_type") == "VIDEO",
        "visualizacoes_video": m.get("video_view_count"),
        "duracao_video": None,
        "curtidas": m.get("like_count") if m.get("like_count") is not None else -1,
        "comentarios": m.get("comments_count") or 0,
        "legenda": cap,
        "hashtags": _hashtags(cap),
        "mencoes": _mentions(cap),
        "marcados": [],
        "local": None,
        "patrocinado": None,
        "n_midias": len((m.get("children") or {}).get("data", [])) or 1,
        "_id": m.get("id"),
    }


# ---------------------------------------------------------------- conta própria
def fetch_own(token: str, max_posts: int = 50, with_comments: bool = False,
              max_comments_per_post: int = 50, with_insights: bool = True,
              progress=None) -> tuple[dict, list[dict], list[dict], dict]:
    me = _get(f"{IG_BASE}/me", {"fields": (
        "user_id,username,name,account_type,profile_picture_url,followers_count,"
        "follows_count,media_count,biography,website")}, token)
    info = {
        "username": me.get("username"),
        "user_id": me.get("user_id") or me.get("id"),
        "nome_completo": me.get("name"),
        "bio": me.get("biography") or "",
        "link_externo": me.get("website"),
        "seguidores": me.get("followers_count") or 0,
        "seguindo": me.get("follows_count") or 0,
        "posts": me.get("media_count") or 0,
        "igtv": 0,
        "privado": False,
        "verificado": False,
        "conta_business": me.get("account_type") in ("BUSINESS", "MEDIA_CREATOR"),
        "categoria_business": me.get("account_type"),
        "foto_perfil": me.get("profile_picture_url"),
        "bio_hashtags": _hashtags(me.get("biography")),
        "bio_mencoes": _mentions(me.get("biography")),
    }

    fields = "id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count,shortcode"
    medias = list(_paginate(f"{IG_BASE}/me/media", {"fields": fields, "limit": 50}, token, max_posts))
    posts = [_post_row(m) for m in medias]
    for p, m in zip(posts, medias):
        p["produto"] = m.get("media_product_type")

    if with_insights:
        for i, p in enumerate(posts, 1):
            if progress:
                progress(i, len(posts))
            p.update(_media_insights(token, p["_id"], p["produto"]))

    comments = []
    if with_comments:
        for p in posts:
            if not p["comentarios"]:
                continue
            try:
                for c in _paginate(f"{IG_BASE}/{p['_id']}/comments",
                                   {"fields": "id,text,username,timestamp,like_count", "limit": 50},
                                   token, max_comments_per_post):
                    comments.append({
                        "shortcode": p["shortcode"], "autor": c.get("username"),
                        "texto": c.get("text") or "", "data": c.get("timestamp"),
                        "curtidas": c.get("like_count") or 0,
                    })
            except GraphError:
                pass

    extra = _account_extra(token, info["user_id"])
    return info, posts, comments, extra


def _media_insights(token: str, media_id: str, produto: Optional[str]) -> dict:
    """Métricas variam por tipo de mídia; tenta o conjunto completo e cai para menores."""
    sets = [
        "reach,saved,shares,views,total_interactions",
        "reach,saved,shares,total_interactions",
        "reach,saved",
    ]
    for metrics in sets:
        try:
            d = _get(f"{IG_BASE}/{media_id}/insights", {"metric": metrics}, token)
            vals = {x["name"]: (x.get("values") or [{}])[0].get("value") for x in d.get("data", [])}
            return {"alcance": vals.get("reach"), "salvos": vals.get("saved"),
                    "compartilhamentos": vals.get("shares"), "visualizacoes": vals.get("views")}
        except GraphError:
            continue
        finally:
            time.sleep(0.2)
    return {}


def _account_extra(token: str, ig_id: str) -> dict:
    extra: dict = {}
    now = int(time.time())
    try:
        d = _get(f"{IG_BASE}/{ig_id}/insights", {
            "metric": "reach,profile_views,accounts_engaged,total_interactions,likes,comments,shares,saves",
            "period": "day", "metric_type": "total_value",
            "since": now - 29 * 86400, "until": now}, token)
        extra["ultimos_30_dias"] = {x["name"]: x.get("total_value", {}).get("value") for x in d.get("data", [])}
    except GraphError as e:
        extra["erro_insights"] = str(e)
    for breakdown in ("age", "gender", "city", "country"):
        try:
            d = _get(f"{IG_BASE}/{ig_id}/insights", {
                "metric": "follower_demographics", "period": "lifetime",
                "metric_type": "total_value", "breakdown": breakdown, "timeframe": "this_month"}, token)
            res = d["data"][0]["total_value"]["breakdowns"][0].get("results", [])
            extra.setdefault("demografia", {})[breakdown] = {
                "/".join(r["dimension_values"]): r["value"] for r in res}
        except (GraphError, KeyError, IndexError):
            pass
    return extra


# ------------------------------------------------------------ business discovery
def fetch_discovery(token: str, my_ig_user_id: str, target: str,
                    max_posts: int = 50) -> tuple[dict, list[dict]]:
    target = target.strip().lstrip("@")
    media_fields = "id,caption,media_type,permalink,timestamp,like_count,comments_count,children{id}"
    posts_raw: list[dict] = []
    info = None
    after = None
    while len(posts_raw) < max_posts:
        media = f"media.limit(50){'.after(' + after + ')' if after else ''}{{{media_fields}}}"
        q = (f"business_discovery.username({target}){{username,name,biography,website,"
             f"followers_count,follows_count,media_count,profile_picture_url,{media}}}")
        d = _get(f"{FB_BASE}/{my_ig_user_id}", {"fields": q}, token)["business_discovery"]
        if info is None:
            info = {
                "username": d.get("username"), "user_id": d.get("id"),
                "nome_completo": d.get("name"), "bio": d.get("biography") or "",
                "link_externo": d.get("website"),
                "seguidores": d.get("followers_count") or 0, "seguindo": d.get("follows_count") or 0,
                "posts": d.get("media_count") or 0, "igtv": 0, "privado": False,
                "verificado": False, "conta_business": True, "categoria_business": None,
                "foto_perfil": d.get("profile_picture_url"),
                "bio_hashtags": _hashtags(d.get("biography")), "bio_mencoes": _mentions(d.get("biography")),
            }
        media_page = d.get("media", {})
        posts_raw += media_page.get("data", [])
        after = media_page.get("paging", {}).get("cursors", {}).get("after")
        if not after or not media_page.get("data"):
            break
    return info, [_post_row(m) for m in posts_raw[:max_posts]]
