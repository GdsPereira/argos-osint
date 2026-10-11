"""Testes unitários para o módulo collector_apify.py."""
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

import collector_apify as ca


def test_url_formatting():
    assert ca._url("instagram") == "https://www.instagram.com/instagram/"
    assert ca._url("@usuario_alvo") == "https://www.instagram.com/usuario_alvo/"
    assert ca._url("  @perfil_com_espacos/  ") == "https://www.instagram.com/perfil_com_espacos/"


def test_hashtags_and_mentions_extraction():
    text = "Confira nosso novo post! #marketing #vendas @cliente_vip e @parceiro.oficial no #sucesso"
    assert ca._hashtags(text) == ["marketing", "vendas", "sucesso"]
    assert ca._mentions(text) == ["cliente_vip", "parceiro.oficial"]

    assert ca._hashtags("") == []
    assert ca._mentions("") == []


def test_parse_profile():
    raw = {
        "username": "brand_test",
        "id": "123456",
        "fullName": "Brand Test Official",
        "biography": "Inovação e tecnologia #tech @google",
        "externalUrl": "https://brand.com",
        "followersCount": 50000,
        "followsCount": 350,
        "postsCount": 420,
        "igtvVideoCount": 12,
        "private": False,
        "verified": True,
        "isBusinessAccount": True,
        "businessCategoryName": "Technology",
        "profilePicUrlHD": "https://img.instagram.com/hd.jpg",
    }
    info = ca._parse_profile(raw, fallback_username="brand_test")
    assert info["username"] == "brand_test"
    assert info["user_id"] == "123456"
    assert info["nome_completo"] == "Brand Test Official"
    assert info["seguidores"] == 50000
    assert info["seguindo"] == 350
    assert info["posts"] == 420
    assert info["verificado"] is True
    assert info["privado"] is False
    assert info["conta_business"] is True
    assert info["categoria_business"] == "Technology"
    assert info["bio_hashtags"] == ["tech"]
    assert info["bio_mencoes"] == ["google"]


def test_parse_post():
    raw_post = {
        "shortCode": "C123ABC",
        "type": "Video",
        "likesCount": 1500,
        "commentsCount": 45,
        "caption": "Reels imperdível #reels @creator",
        "videoViewCount": 12000,
        "videoDuration": 30.5,
        "timestamp": "2026-03-01T15:00:00Z",
        "taggedUsers": [{"username": "parceiro1"}, "parceiro2"],
        "locationName": "São Paulo, Brazil",
        "paidPartnership": False,
        "isPinned": True,
    }
    post = ca._parse_post(raw_post)
    assert post["shortcode"] == "C123ABC"
    assert post["tipo"] == "GraphVideo"
    assert post["is_video"] is True
    assert post["visualizacoes_video"] == 12000
    assert post["curtidas"] == 1500
    assert post["comentarios"] == 45
    assert post["fixado"] is True
    assert post["hashtags"] == ["reels"]
    assert post["mencoes"] == ["creator"]
    assert post["marcados"] == ["parceiro1", "parceiro2"]
    assert post["local"] == "São Paulo, Brazil"


def test_parse_comment():
    raw_c = {
        "text": "Produto maravilhoso!",
        "ownerUsername": "cliente1",
        "timestamp": "2026-03-01T16:00:00Z",
        "likesCount": 5,
    }
    c = ca._parse_comment(raw_c, shortcode="C123ABC")
    assert c is not None
    assert c["shortcode"] == "C123ABC"
    assert c["autor"] == "cliente1"
    assert c["texto"] == "Produto maravilhoso!"
    assert c["curtidas"] == 5

    # Comentário vazio deve ser ignorado
    assert ca._parse_comment({"text": "  "}) is None


def test_parse_story():
    raw_story = {
        "id": "story_999",
        "type": "Video",
        "url": "https://img.instagram.com/story.mp4",
        "videoUrl": "https://img.instagram.com/story.mp4",
        "timestamp": "2026-03-01T18:00:00Z",
        "expiringAt": "2026-03-02T18:00:00Z",
        "viewCount": 850,
        "mentions": ["influencer_partner"],
    }
    story = ca._parse_story(raw_story)
    assert story["id"] == "story_999"
    assert story["is_video"] is True
    assert story["tipo"] == "GraphVideo"
    assert story["visualizacoes"] == 850
    assert story["mentions"] == ["influencer_partner"]
    assert story["expira_em"] == "2026-03-02T18:00:00Z"


@pytest.mark.asyncio
async def test_run_actor_async_success():
    mock_client = MagicMock()
    mock_run = MagicMock()
    mock_run.default_dataset_id = "dataset_123"

    mock_actor = MagicMock()
    mock_actor.call = AsyncMock(return_value=mock_run)
    mock_client.actor.return_value = mock_actor

    mock_dataset = MagicMock()

    async def fake_iterate():
        yield {"item": 1}
        yield {"item": 2}

    mock_dataset.iterate_items = fake_iterate
    mock_client.dataset.return_value = mock_dataset

    items = await ca._run_actor_async(mock_client, "apify/instagram-scraper", {}, timeout_secs=10)
    assert items == [{"item": 1}, {"item": 2}]


@pytest.mark.asyncio
async def test_run_actor_async_timeout():
    mock_client = MagicMock()
    mock_actor = MagicMock()

    async def hang(*args, **kwargs):
        await asyncio.sleep(2)

    mock_actor.call = hang
    mock_client.actor.return_value = mock_actor

    with pytest.raises(TimeoutError) as exc_info:
        await ca._run_actor_async(mock_client, "apify/instagram-scraper", {}, timeout_secs=0.05)
    assert "Timeout" in str(exc_info.value)


@pytest.mark.asyncio
async def test_pipeline_parallel_execution_success():
    pipeline = ca.ApifyPipeline(token="test_token")

    fake_profile = {
        "username": "usuario_teste",
        "id": "111",
        "fullName": "Perfil Teste",
        "followersCount": 1000,
        "followsCount": 200,
        "postsCount": 10,
        "private": False,
    }
    fake_posts = [
        {
            "shortCode": "POST1",
            "type": "Image",
            "likesCount": 50,
            "commentsCount": 1,
            "caption": "Post #legal",
            "latestComments": [{"text": "Muito bom!", "ownerUsername": "user_com"}],
        }
    ]
    fake_stories = [
        {
            "id": "STORY1",
            "type": "Image",
            "url": "https://insta.com/s1.jpg",
            "timestamp": "2026-03-01T12:00:00Z",
        }
    ]

    with patch.object(pipeline, "fetch_profile_async", new=AsyncMock(return_value=ca._parse_profile(fake_profile, "usuario_teste"))), \
         patch.object(pipeline, "fetch_posts_async", new=AsyncMock(return_value=([ca._parse_post(fake_posts[0])], [ca._parse_comment(fake_posts[0]["latestComments"][0], "POST1")]))), \
         patch.object(pipeline, "fetch_stories_async", new=AsyncMock(return_value=[ca._parse_story(fake_stories[0])])):

        info, posts, comments, extra = await pipeline.execute_pipeline(
            username="usuario_teste",
            max_posts=10,
            with_comments=True,
            with_stories=True,
        )

        assert info["username"] == "usuario_teste"
        assert len(posts) == 1
        assert posts[0]["shortcode"] == "POST1"
        assert len(comments) == 1
        assert comments[0]["texto"] == "Muito bom!"
        assert extra["stories_count"] == 1
        assert extra["stories"][0]["id"] == "STORY1"


@pytest.mark.asyncio
async def test_pipeline_private_profile_raises_error():
    pipeline = ca.ApifyPipeline(token="test_token")
    fake_private_profile = {
        "username": "usuario_privado",
        "private": True,
        "followersCount": 500,
    }

    with patch.object(pipeline, "fetch_profile_async", new=AsyncMock(return_value=ca._parse_profile(fake_private_profile, "usuario_privado"))), \
         patch.object(pipeline, "fetch_posts_async", new=AsyncMock(return_value=([], []))):

        with pytest.raises(ValueError) as exc:
            await pipeline.execute_pipeline(username="usuario_privado")
        assert "Perfil privado" in str(exc.value)


@pytest.mark.asyncio
async def test_pipeline_stories_actor_failure_degrades_gracefully():
    pipeline = ca.ApifyPipeline(token="test_token")
    fake_profile = {
        "username": "usuario_aberto",
        "private": False,
        "followersCount": 1200,
    }

    async def fail_stories(*args, **kwargs):
        raise RuntimeError("Stories actor falhou")

    with patch.object(pipeline, "fetch_profile_async", new=AsyncMock(return_value=ca._parse_profile(fake_profile, "usuario_aberto"))), \
         patch.object(pipeline, "fetch_posts_async", new=AsyncMock(return_value=([], []))), \
         patch.object(pipeline, "fetch_stories_async", new=fail_stories):

        # O pipeline NÃO deve falhar quando stories dá erro, deve retornar lista vazia
        info, posts, comments, extra = await pipeline.execute_pipeline(
            username="usuario_aberto",
            with_stories=True,
        )
        assert info["username"] == "usuario_aberto"
        assert extra["stories"] == []
        assert extra["stories_count"] == 0


def test_edge_cases_in_parsers():
    # Post com curtidas ocultas (None) e sem legenda
    p = ca._parse_post({"shortCode": "NULL_TEST", "likesCount": None, "caption": None})
    assert p["curtidas"] == -1
    assert p["legenda"] == ""
    assert p["hashtags"] == []
    assert p["mencoes"] == []

    # Perfil sem bio
    prof = ca._parse_profile({"username": "nobio", "biography": None}, fallback_username="nobio")
    assert prof["bio"] == ""
    assert prof["bio_hashtags"] == []
    assert prof["bio_mencoes"] == []

    # Comentário com extração de shortcode da URL
    c = ca._parse_comment({
        "text": "Comentário via URL",
        "postUrl": "https://www.instagram.com/p/URL_CODE_123/",
        "owner": {"username": "nested_owner"},
    })
    assert c is not None
    assert c["shortcode"] == "URL_CODE_123"
    assert c["autor"] == "nested_owner"


@pytest.mark.asyncio
async def test_comments_complementary_merging_and_deduplication():
    pipeline = ca.ApifyPipeline(token="test_token")
    fake_profile = {"username": "user1", "private": False, "followersCount": 100}
    fake_posts = [{"shortCode": "P1", "url": "https://instagram.com/p/P1/", "likesCount": 10}]

    # latestComments tem C1
    latest = [{"shortcode": "P1", "autor": "u1", "texto": "Mesmo texto", "curtidas": 0}]
    # complementary actor retorna C1 (duplicado) e C2 (novo)
    deep = [
        {"shortcode": "P1", "autor": "u1", "texto": "Mesmo texto", "curtidas": 0},
        {"shortcode": "P1", "autor": "u2", "texto": "Texto novo", "curtidas": 2},
    ]

    with patch.object(pipeline, "fetch_profile_async", new=AsyncMock(return_value=ca._parse_profile(fake_profile, "user1"))), \
         patch.object(pipeline, "fetch_posts_async", new=AsyncMock(return_value=([ca._parse_post(fake_posts[0])], latest))), \
         patch.object(pipeline, "fetch_comments_complementary_async", new=AsyncMock(return_value=deep)):

        info, posts, comments, extra = await pipeline.execute_pipeline(
            username="user1",
            max_posts=5,
            with_comments=True,
            comments_per_post=20,  # > 15 ativa actor complementar
        )

        assert len(comments) == 2
        textos = [c["texto"] for c in comments]
        assert "Mesmo texto" in textos
        assert "Texto novo" in textos


@pytest.mark.asyncio
async def test_profile_not_found_raises_value_error():
    pipeline = ca.ApifyPipeline(token="test_token")
    mock_client = MagicMock()

    # Actor retorna item com erro
    with patch("collector_apify._run_actor_async", new=AsyncMock(return_value=[{"error": True, "errorDescription": "User does not exist"}])):
        with pytest.raises(ValueError) as exc:
            await pipeline.fetch_profile_async(mock_client, "inexistente_123")
        assert "Perfil não encontrado" in str(exc.value)


def test_sync_wrappers_work():
    with patch("collector_apify.ApifyPipeline.run_profile_sync", return_value=("usr", {"username": "usr"})), \
         patch("collector_apify.ApifyPipeline.run_posts_sync", return_value=([{"shortcode": "P"}], [])):

        u, prof = ca.fetch_profile("tok", "usr")
        assert u == "usr"
        assert prof["username"] == "usr"

        posts, comments = ca.fetch_posts("tok", "usr", max_posts=5)
        assert len(posts) == 1
        assert comments == []


def test_clean_username_and_urls():
    assert ca._clean_username("usuario") == "usuario"
    assert ca._clean_username("@usuario") == "usuario"
    assert ca._clean_username("  @usuario/  ") == "usuario"
    assert ca._clean_username("https://www.instagram.com/usuario/") == "usuario"
    assert ca._clean_username("https://instagram.com/usuario?hl=pt") == "usuario"
    assert ca._clean_username("instagram.com/usuario") == "usuario"

    assert ca._url("https://www.instagram.com/usuario/") == "https://www.instagram.com/usuario/"


def test_parse_comment_reels_and_variations():
    c_reel = ca._parse_comment({
        "text": "Reel incrível",
        "postUrl": "https://www.instagram.com/reel/C999XYZ/",
        "username": "reels_fan",
    })
    assert c_reel is not None
    assert c_reel["shortcode"] == "C999XYZ"
    assert c_reel["autor"] == "reels_fan"

    c_no_slash = ca._parse_comment({
        "text": "Post sem barra",
        "postUrl": "https://www.instagram.com/p/ABC123NoSlash",
        "owner": {"username": "author_nested"},
    })
    assert c_no_slash is not None
    assert c_no_slash["shortcode"] == "ABC123NoSlash"


def test_parse_profile_variations():
    prof = ca._parse_profile({
        "isPrivate": True,
        "isVerified": True,
        "is_business_account": True,
        "followers": 1234,
        "following": 56,
        "posts_count": 78,
    }, fallback_username="fallback_user")
    assert prof["username"] == "fallback_user"
    assert prof["privado"] is True
    assert prof["verificado"] is True
    assert prof["conta_business"] is True
    assert prof["seguidores"] == 1234
    assert prof["seguindo"] == 56
    assert prof["posts"] == 78


@pytest.mark.asyncio
async def test_run_actor_async_failed_status_raises_runtime_error():
    mock_client = MagicMock()
    mock_run = MagicMock()
    mock_run.status = "FAILED"
    mock_run.status_message = "Actor run crashed due to memory limit"

    mock_actor = MagicMock()
    mock_actor.call = AsyncMock(return_value=mock_run)
    mock_client.actor.return_value = mock_actor

    with pytest.raises(RuntimeError) as exc:
        await ca._run_actor_async(mock_client, "apify/instagram-scraper", {}, timeout_secs=10)
    assert "Actor run crashed" in str(exc.value)


@pytest.mark.asyncio
async def test_run_actor_async_running_status_raises_timeout_error():
    mock_client = MagicMock()
    mock_run = MagicMock()
    mock_run.status = "RUNNING"

    mock_actor = MagicMock()
    mock_actor.call = AsyncMock(return_value=mock_run)
    mock_client.actor.return_value = mock_actor

    with pytest.raises(TimeoutError) as exc:
        await ca._run_actor_async(mock_client, "apify/instagram-scraper", {}, timeout_secs=10)
    assert "não concluiu a tempo" in str(exc.value)


@pytest.mark.asyncio
async def test_pipeline_cancellation_cancels_all_subtasks():
    pipeline = ca.ApifyPipeline(token="test_token")
    mock_client = MagicMock()

    task_flags = {"profile_cancelled": False, "posts_cancelled": False, "stories_cancelled": False}

    async def fake_profile(client, username):
        try:
            await asyncio.sleep(10)
        except asyncio.CancelledError:
            task_flags["profile_cancelled"] = True
            raise

    async def fake_posts(client, username, max_posts):
        try:
            await asyncio.sleep(10)
        except asyncio.CancelledError:
            task_flags["posts_cancelled"] = True
            raise

    async def fake_stories(client, username):
        try:
            await asyncio.sleep(10)
        except asyncio.CancelledError:
            task_flags["stories_cancelled"] = True
            raise

    with patch.object(pipeline, "fetch_profile_async", side_effect=fake_profile), \
         patch.object(pipeline, "fetch_posts_async", side_effect=fake_posts), \
         patch.object(pipeline, "fetch_stories_async", side_effect=fake_stories):

        pipe_task = asyncio.create_task(
            pipeline.execute_pipeline(username="cancel_user", with_stories=True)
        )
        await asyncio.sleep(0.05)
        pipe_task.cancel()

        with pytest.raises(asyncio.CancelledError):
            await pipe_task

        assert task_flags["profile_cancelled"] is True
        assert task_flags["posts_cancelled"] is True
        assert task_flags["stories_cancelled"] is True


def test_parse_profile_enriched_scraping():
    raw = {
        "username": "superbrand",
        "id": "999888",
        "businessEmail": "contato@superbrand.com",
        "businessPhoneNumber": "+5511999998888",
        "businessAddress": {"street_address": "Av Paulista 1000", "city_name": "São Paulo"},
        "externalUrls": [{"url": "https://superbrand.com"}, {"url": "https://linktr.ee/superbrand"}],
        "relatedProfiles": [{"username": "competitor1"}, {"username": "competitor2"}],
        "highlightReelCount": 8,
        "followersCount": 12000,
        "followsCount": 200,
        "postsCount": 80,
    }
    info = ca._parse_profile(raw, fallback_username="superbrand")
    assert info["email"] == "contato@superbrand.com"
    assert info["telefone"] == "+5511999998888"
    assert info["endereco"] == {"street_address": "Av Paulista 1000", "city_name": "São Paulo"}
    assert info["links_externos"] == ["https://superbrand.com", "https://linktr.ee/superbrand"]
    assert info["perfis_similares"] == ["competitor1", "competitor2"]
    assert info["destaques_count"] == 8


def test_parse_post_enriched_scraping():
    raw_post = {
        "shortCode": "C999XYZ",
        "type": "Video",
        "likesCount": 2500,
        "commentsCount": 140,
        "videoPlayCount": 45000,
        "musicInfo": {"song_name": "Trending Song", "artist_name": "Popular Artist"},
        "coauthorProducers": [{"username": "influencer_partner"}],
        "isPinned": True,
    }
    post = ca._parse_post(raw_post)
    assert post["plays_video"] == 45000
    assert post["musica"] == "Trending Song"
    assert post["artista"] == "Popular Artist"
    assert post["colabs"] == ["influencer_partner"]
    assert post["fixado"] is True


@pytest.mark.asyncio
async def test_pipeline_with_tagged_and_highlights():
    pipeline = ca.ApifyPipeline(token="mock_token")
    mock_profile = {"username": "brand_hub", "followersCount": 5000, "perfis_similares": ["rival_brand"]}
    mock_posts = ([{"shortCode": "P1", "likesCount": 100, "commentsCount": 10}], [])
    mock_tagged = [{"shortcode": "T1", "curtidas": 50, "comentarios": 5, "legenda": "Adorei a marca!"}]
    mock_highlights = [{
        "id": "HL1",
        "title": "Depoimentos",
        "coverImageUrl": "https://img.com/h.jpg",
        "media_count": 2,
        "items": [
            {"id": "S1", "type": "photo", "media_url": "https://img.com/s1.jpg"},
            {"id": "S2", "type": "video", "media_url": "https://video.com/s2.mp4"}
        ]
    }]

    with patch.object(pipeline, "fetch_profile_async", new=AsyncMock(return_value=mock_profile)), \
         patch.object(pipeline, "fetch_posts_async", new=AsyncMock(return_value=mock_posts)), \
         patch.object(pipeline, "fetch_tagged_async", new=AsyncMock(return_value=mock_tagged)), \
         patch.object(pipeline, "fetch_highlights_async", new=AsyncMock(return_value=mock_highlights)):

        info, posts, comments, extra = await pipeline.execute_pipeline(
            username="brand_hub",
            max_posts=10,
            with_tagged=True,
            with_highlights=True,
        )

        assert info["username"] == "brand_hub"
        assert info["perfis_similares"] == ["rival_brand"]
        assert len(extra["tagged_posts"]) == 1
        assert extra["tagged_posts"][0]["shortcode"] == "T1"
        assert len(extra["highlights"]) == 1
        assert extra["highlights"][0]["title"] == "Depoimentos"
        assert extra["highlights"][0]["media_count"] == 2
        assert len(extra["highlights"][0]["items"]) == 2
        assert extra["highlight_media_count"] == 2


def test_parse_highlight_item():
    raw_story = {
        "id": "story_123",
        "mediaType": "video",
        "videoUrl": "https://video.com/st1.mp4",
        "thumbnail": "https://img.com/st1.jpg",
        "timestamp": "2026-03-10T12:00:00Z",
        "linkSticker": {"url": "https://loja.com/produto"},
        "caption": "Confira nosso novo produto!",
    }
    parsed = ca._parse_highlight_item(raw_story, hl_id="hl_99", hl_title="Lançamentos")
    assert parsed["id"] == "story_123"
    assert parsed["type"] == "video"
    assert parsed["is_video"] is True
    assert parsed["media_url"] == "https://video.com/st1.mp4"
    assert parsed["thumbnail_url"] == "https://img.com/st1.jpg"
    assert parsed["link_sticker"] == "https://loja.com/produto"
    assert parsed["caption"] == "Confira nosso novo produto!"
    assert parsed["highlight_id"] == "hl_99"
    assert parsed["highlight_title"] == "Lançamentos"


@pytest.mark.asyncio
async def test_fetch_highlights_async_expanded():
    pipeline = ca.ApifyPipeline(token="mock_token")
    mock_items = [{
        "highlights": [{
            "highlightId": "highlight:1001",
            "title": "Produtos",
            "coverImageUrl": "https://img.com/cover.jpg",
            "stories": [
                {"id": "st_1", "mediaType": "photo", "imageUrl": "https://img.com/1.jpg"},
                {"id": "st_2", "mediaType": "video", "videoUrl": "https://video.com/2.mp4"}
            ]
        }]
    }]

    with patch.object(ca, "_run_actor_async", new=AsyncMock(return_value=mock_items)):
        highlights = await pipeline.fetch_highlights_async(client=None, username="teste_user")
        assert len(highlights) == 1
        h = highlights[0]
        assert h["id"] == "1001"
        assert h["title"] == "Produtos"
        assert h["media_count"] == 2
        assert len(h["items"]) == 2
        assert h["items"][0]["type"] == "photo"
        assert h["items"][1]["type"] == "video"


