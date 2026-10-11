"""Métricas e análises sobre os dados coletados (Python puro, sem pandas)."""
from __future__ import annotations

import re
import statistics
from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Any, Optional

DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
POS = {"amei", "adoro", "lindo", "linda", "top", "parabéns", "parabens", "perfeito", "incrível",
       "incrivel", "show", "love", "great", "amazing", "awesome", "beautiful", "beautiful", "wonderful",
       "thank", "thanks", "obrigado", "obrigada", "best", "brilliant", "😍", "❤", "🔥", "👏", "🥹", "🙏"}
NEG = {"ruim", "péssimo", "pessimo", "horrível", "horrivel", "odeio", "lixo", "golpe", "fake",
       "bad", "worst", "hate", "terrible", "awful", "disgusting", "trash", "😡", "👎", "🤮", "🗑"}
STOP = set("""a o e é de da do das dos que em um uma para com não nao os as se na no nas nos por mais mas foi ao
ele ela eu você voce isso esse essa the and to of is in it that this you for on with my so me be are was your
have just not but at they their his her from what all can will been has had one about out who get like very
too how its our there when more than them she him were would could should because been into over only also
did does doing don can't it's i'm""".split())
EMOJI_RE = re.compile("[\U0001F300-\U0001FAFF\u2600-\u27BF\u2764]")
WORD_RE = re.compile(r"[A-Za-zÀ-ÿ']{3,}")


def parse_dt(v: Any) -> Optional[datetime]:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
    try:
        s = str(v).replace("Z", "+00:00")
        d = datetime.fromisoformat(s)
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def sentiment(text: str) -> str:
    """Heurística simples baseada em léxico."""
    tokens = set(re.findall(r"\w+|[^\w\s]", text.lower()))
    p, n = len(tokens & POS), len(tokens & NEG)
    return "positivo" if p > n else "negativo" if n > p else "neutro"


def _avg(xs: list[float]) -> float:
    return sum(xs) / len(xs) if xs else 0.0


def _top(items, n=15) -> list[dict]:
    return [{"item": k, "usos": v} for k, v in Counter(items).most_common(n)]


def analyze(info: dict, posts: list[dict], comments: list[dict],
            followers: list[dict], followees: list[dict], extra: dict) -> dict:
    seg = max(info.get("seguidores") or 0, 1)

    rows: list[dict] = []
    for p in posts:
        dt = parse_dt(p.get("data"))
        likes = p.get("curtidas")
        likes = -1 if likes is None else int(likes)
        com = int(p.get("comentarios") or 0)
        r = dict(p)
        r.update(data=dt.isoformat() if dt else None, curtidas=likes, comentarios=com,
                 interacoes=max(likes, 0) + com, _dt=dt)
        r["taxa_engajamento"] = round(r["interacoes"] / seg * 100, 3)
        rows.append(r)

    dated = sorted([r for r in rows if r["_dt"]], key=lambda r: r["_dt"])
    valid = [r for r in rows if r["curtidas"] >= 0]
    likes_list = [r["curtidas"] for r in valid]
    com_list = [r["comentarios"] for r in rows]
    inter_list = [r["interacoes"] for r in rows]

    span_days = None
    if len(dated) > 1:
        span_days = max((dated[-1]["_dt"] - dated[0]["_dt"]).days, 1)

    # ---- horários / dias
    by_hour_acc: dict[int, list[int]] = defaultdict(list)
    by_wd_acc: dict[int, list[int]] = defaultdict(list)
    for r in dated:
        by_hour_acc[r["_dt"].hour].append(r["interacoes"])
        by_wd_acc[r["_dt"].weekday()].append(r["interacoes"])
    by_hour = [{"hora": h, "posts": len(by_hour_acc[h]), "interacoes": round(_avg(by_hour_acc[h]), 1)}
               for h in range(24)]
    by_weekday = [{"dia": DIAS[i], "posts": len(by_wd_acc[i]), "interacoes": round(_avg(by_wd_acc[i]), 1)}
                  for i in range(7)]
    best_hour = max((x for x in by_hour if x["posts"]), key=lambda x: x["interacoes"], default=None)
    best_day = max((x for x in by_weekday if x["posts"]), key=lambda x: x["interacoes"], default=None)

    summary = {
        "posts_analisados": len(rows),
        "media_curtidas": round(_avg(likes_list), 1) if likes_list else None,
        "mediana_curtidas": statistics.median(likes_list) if likes_list else None,
        "media_comentarios": round(_avg(com_list), 1) if rows else None,
        "taxa_engajamento": round(_avg(inter_list) / seg * 100, 3) if rows else None,
        "posts_por_semana": round(len(dated) / span_days * 7, 2) if span_days else None,
        "seguidores_por_seguindo": round(seg / max(info.get("seguindo") or 0, 1), 2),
        "total_curtidas": sum(likes_list),
        "total_comentarios": sum(com_list),
        "total_interacoes": sum(inter_list),
        "curtidas_ocultas": len(rows) - len(valid),
        "periodo_dias": span_days,
        "melhor_hora": best_hour["hora"] if best_hour else None,
        "melhor_dia": best_day["dia"] if best_day else None,
    }

    # ---- gráficos
    timeline = [{"d": r["data"], "curtidas": r["curtidas"], "comentarios": r["comentarios"],
                 "interacoes": r["interacoes"]} for r in dated]
    types: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        types[r.get("tipo") or "—"].append(r)
    by_type = [{
        "tipo": t, "posts": len(rs),
        "curtidas": round(_avg([x["curtidas"] for x in rs if x["curtidas"] >= 0]), 1),
        "comentarios": round(_avg([x["comentarios"] for x in rs]), 1),
        "interacoes": round(_avg([x["interacoes"] for x in rs]), 1),
    } for t, rs in types.items()]
    caption = [{"x": len(r.get("legenda") or ""), "y": r["interacoes"]} for r in rows]

    # ---- hashtags / menções
    tag_acc: dict[str, list[int]] = defaultdict(list)
    for r in rows:
        for h in {str(x).lower().lstrip("#") for x in (r.get("hashtags") or []) if x}:
            tag_acc[h].append(r["interacoes"])
    perf = sorted(
        ({"item": h, "usos": len(v), "media": round(_avg(v), 1)} for h, v in tag_acc.items() if len(v) >= 2),
        key=lambda x: x["media"], reverse=True)[:15]

    def flat(key):
        for r in rows:
            for x in r.get(key) or []:
                if x:
                    yield x

    # ---- comentários
    c_items = []
    for c in comments:
        dt = parse_dt(c.get("data"))
        text = c.get("texto") or ""
        c_items.append({"shortcode": c.get("shortcode"), "autor": c.get("autor"), "texto": text,
                        "data": dt.isoformat() if dt else None, "curtidas": c.get("curtidas") or 0,
                        "sentimento": sentiment(text)})
    sent = Counter(c["sentimento"] for c in c_items)
    words = Counter()
    emojis = Counter()
    for c in c_items:
        for w in WORD_RE.findall(c["texto"].lower()):
            if w not in STOP:
                words[w] += 1
        emojis.update(EMOJI_RE.findall(c["texto"]))

    # ---- audiência (Instaloader)
    fs = {u.get("username") for u in followers if isinstance(u, dict) and u.get("username")}
    fl = {u.get("username") for u in followees if isinstance(u, dict) and u.get("username")}

    for r in rows:
        r.pop("_dt", None)

    top_cols = ("shortcode", "url", "data", "tipo", "curtidas", "comentarios", "interacoes", "legenda")
    top_posts = [{k: r.get(k) for k in top_cols}
                 for r in sorted(rows, key=lambda x: x["interacoes"], reverse=True)[:10]]

    return {
        "info": info,
        "summary": summary,
        "posts": rows,
        "top_posts": top_posts,
        "charts": {"timeline": timeline, "by_type": by_type, "by_hour": by_hour,
                   "by_weekday": by_weekday, "caption": caption},
        "hashtags": {"top": _top(flat("hashtags")), "performance": perf},
        "mentions": _top(flat("mencoes")),
        "tagged": _top(flat("marcados")),
        "locations": _top([r["local"] for r in rows if r.get("local")], 10),
        "comments": {
            "total": len(c_items),
            "items": c_items[:1000],
            "sentiment": {"positivo": sent["positivo"], "neutro": sent["neutro"], "negativo": sent["negativo"]},
            "top_authors": _top([c["autor"] for c in c_items if c["autor"]], 15),
            "words": [{"item": k, "usos": v} for k, v in words.most_common(40)],
            "emojis": [{"item": k, "usos": v} for k, v in emojis.most_common(15)],
        },
        "audience": {
            "followers": followers, "followees": followees,
            "not_following_back": sorted(fl - fs), "mutual": sorted(fs & fl),
        },
        "extra": extra or {},
    }
