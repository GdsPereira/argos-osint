"""Módulo de Conexão e Gerenciamento do Banco de Dados PostgreSQL / SQLAlchemy Assíncrono.

Fornece engine assíncrona, sessões com context manager, inicialização automática
de tabelas e fallback seguro (SQLite/In-Memory) para testes e resiliência total.
"""
from __future__ import annotations

import logging
import os
import re
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text

logger = logging.getLogger("argos.database")


class Base(DeclarativeBase):
    """Base declarativa para os modelos ORM."""
    pass


_engine: Optional[AsyncEngine] = None
_session_factory: Optional[async_sessionmaker[AsyncSession]] = None


def get_database_url() -> str:
    """Monta e normaliza a URL do banco de dados para o driver asyncpg."""
    # Ambiente de teste (pytest): usa SQLite em memória ultra-rápido e isolado
    if "PYTEST_CURRENT_TEST" in os.environ or os.getenv("TESTING") == "1":
        return os.getenv("TEST_DATABASE_URL", "sqlite+aiosqlite:///:memory:")

    raw_url = os.getenv("DATABASE_URL", "").strip()

    if raw_url:
        # Corrige prefixos comuns para garantir uso do driver asyncpg
        if raw_url.startswith("postgres://"):
            raw_url = raw_url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif raw_url.startswith("postgresql://") and not raw_url.startswith("postgresql+asyncpg://"):
            raw_url = raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return raw_url

    # Monta a partir das variáveis individuais
    user = os.getenv("POSTGRES_USER", "argos_user")
    pwd = os.getenv("POSTGRES_PASSWORD", "argos_pass_2026")
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    db = os.getenv("POSTGRES_DB", "argos_db")

    return f"postgresql+asyncpg://{user}:{pwd}@{host}:{port}/{db}"


def get_engine() -> AsyncEngine:
    """Retorna o engine global inicializado ou cria um novo."""
    global _engine, _session_factory
    if _engine is None:
        db_url = get_database_url()
        is_sqlite = db_url.startswith("sqlite")

        engine_kwargs = {
            "echo": False,
            "future": True,
        }

        if is_sqlite:
            from sqlalchemy.pool import StaticPool
            engine_kwargs.update({
                "connect_args": {"check_same_thread": False},
                "poolclass": StaticPool,
            })
        else:
            # Configurações do pool para PostgreSQL sob alta carga e timeout ágil
            engine_kwargs.update({
                "pool_size": int(os.getenv("DB_POOL_SIZE", "10")),
                "max_overflow": int(os.getenv("DB_MAX_OVERFLOW", "20")),
                "pool_timeout": 5.0,
                "pool_recycle": 1800,
                "pool_pre_ping": True,
                "connect_args": {"timeout": 5.0},
            })

        logger.info(f"Inicializando engine assíncrona do banco de dados ({db_url.split('@')[-1] if '@' in db_url else 'local'})")
        _engine = create_async_engine(db_url, **engine_kwargs)
        _session_factory = async_sessionmaker(_engine, expire_on_commit=False, class_=AsyncSession)

    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """Retorna a fábrica de sessões."""
    if _session_factory is None:
        get_engine()
    assert _session_factory is not None
    return _session_factory


_tables_created = False


@asynccontextmanager
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Context manager assíncrono para operações seguras de banco."""
    global _tables_created
    if not _tables_created:
        await init_db()
        _tables_created = True

    factory = get_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db() -> bool:
    """Inicializa as tabelas do banco de dados de forma resiliente.
    
    Se o PostgreSQL não estiver acessível de imediato (ex: durante inicialização do container),
    tenta fallback transparente ou registra aviso sem travar a aplicação.
    """
    global _engine, _session_factory
    engine = get_engine()

    try:
        async with engine.begin() as conn:
            # Importa modelos para garantir registro no metadata
            import models  # noqa: F401
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Tabelas do banco de dados verificadas/criadas com sucesso.")
        return True
    except Exception as e:
        logger.warning(
            f"Não foi possível conectar ao PostgreSQL primário ({e}). "
            "Ativando fallback local para garantir disponibilidade e resiliência..."
        )

        # Fallback para SQLite assíncrono se o Postgres estiver inacessível localmente
        try:
            fallback_url = os.getenv("FALLBACK_DATABASE_URL", "sqlite+aiosqlite:///argos_local.db")
            _engine = create_async_engine(fallback_url, echo=False)
            _session_factory = async_sessionmaker(_engine, expire_on_commit=False, class_=AsyncSession)
            async with _engine.begin() as conn:
                import models  # noqa: F401
                await conn.run_sync(Base.metadata.create_all)
            logger.info("Fallback local para banco de dados SQLite ativado com sucesso.")
            return True
        except Exception as fallback_err:
            logger.error(f"Falha catastrófica ao inicializar banco de dados: {fallback_err}", exc_info=True)
            return False


async def check_db_health() -> dict:
    """Verifica a saúde da conexão com o banco de dados."""
    try:
        async with get_db_session() as session:
            result = await session.execute(text("SELECT 1"))
            val = result.scalar()
            engine = get_engine()
            return {
                "status": "healthy" if val == 1 else "unhealthy",
                "dialect": engine.dialect.name,
                "connected": True,
            }
    except Exception as exc:
        return {
            "status": "unhealthy",
            "connected": False,
            "error": str(exc),
        }
