"""Coleta de dados de perfis do Instagram usando Instaloader."""
from __future__ import annotations

import itertools
import time
from typing import Callable, Optional

import instaloader
from instaloader import Profile


def get_loader(login_user: Optional[str] = None, password: Optional[str] = None) -> instaloader.Instaloader:
    """Cria o Instaloader. Login é opcional, mas reduz bloqueios e libera
    comentários, listas de seguidores/seguindo e stories/highlights."""
    L = instaloader.Instaloader(
        download_pictures=False,
        download_videos=False,
        download_video_thumbnails=False,
        download_geotags=False,
        download_comments=False,
        save_metadata=False,
        compress_json=False,
        quiet=True,
        max_connection_attempts=2,
    )
    if login_user:
        try:
            L.load_session_from_file(login_user)
        except FileNotFoundError:
            if not password:
                raise ValueError("Sem sessão salva: informe a senha para o primeiro login.")
            L.login(login_user, password)
            L.save_session_to_file()
    return L


def fetch_profile(L: instaloader.Instaloader, username: str) -> tuple[Profile, dict]:
    p = Profile.from_username(L.context, username.strip().lstrip("@"))
    info = {
        "username": p.username,
        "user_id": p.userid,
        "nome_completo": p.full_name,
        "bio": p.biography,
        "link_externo": p.external_url,
        "seguidores": p.followers,
        "seguindo": p.followees,
        "posts": p.mediacount,
        "igtv": p.igtvcount,
        "privado": p.is_private,
        "verificado": p.is_verified,
        "conta_business": p.is_business_account,
        "categoria_business": p.business_category_name,
        "foto_perfil": p.profile_pic_url,
        "bio_hashtags": p.biography_hashtags,
        "bio_mencoes": p.biography_mentions,
    }
    return p, info


def fetch_posts(
    profile: Profile,
    max_posts: int = 50,
    with_comments: bool = False,
    max_comments_per_post: int = 50,
    delay: float = 1.0,
    progress: Optional[Callable[[int, int], None]] = None,
) -> tuple[list[dict], list[dict]]:
    """Retorna (posts, comentarios)."""
    posts, comments = [], []
    for i, post in enumerate(itertools.islice(profile.get_posts(), max_posts), 1):
        posts.append({
            "shortcode": post.shortcode,
            "url": f"https://www.instagram.com/p/{post.shortcode}/",
            "data": post.date_utc,
            "tipo": post.typename,
            "is_video": post.is_video,
            "visualizacoes_video": post.video_view_count if post.is_video else None,
            "duracao_video": post.video_duration if post.is_video else None,
            "curtidas": post.likes,
            "comentarios": post.comments,
            "legenda": post.caption or "",
            "hashtags": list(post.caption_hashtags),
            "mencoes": list(post.caption_mentions),
            "marcados": list(post.tagged_users),
            "local": post.location.name if post.location else None,
            "patrocinado": getattr(post, "is_sponsored", None),
            "n_midias": post.mediacount,
        })
        if with_comments and post.comments:
            try:
                for c in itertools.islice(post.get_comments(), max_comments_per_post):
                    comments.append({
                        "shortcode": post.shortcode,
                        "autor": c.owner.username,
                        "texto": c.text,
                        "data": c.created_at_utc,
                        "curtidas": c.likes_count,
                    })
            except Exception:  # comentários normalmente exigem login
                pass
        if progress:
            progress(i, max_posts)
        time.sleep(delay)
    return posts, comments


def fetch_people(profile: Profile, kind: str, limit: int = 200, delay: float = 0.5) -> list[dict]:
    """Lista de seguidores ('followers') ou seguindo ('followees'). Exige login."""
    it = profile.get_followers() if kind == "followers" else profile.get_followees()
    out = []
    for u in itertools.islice(it, limit):
        out.append({
            "username": u.username,
            "nome": u.full_name,
            "verificado": u.is_verified,
            "privado": u.is_private,
        })
        time.sleep(delay)
    return out
