"""Camada de Acesso a Dados (Repository) para Análises, Relatórios de IA e Jobs.

Encapsula consultas, transações e garante integridade referencial com tratamento de exceções.
"""
from __future__ import annotations

import logging
import uuid
from typing import Any, Optional

from sqlalchemy import delete, desc, select

from database import get_db_session
from models import AiReportModel, AnalysisModel, JobModel

logger = logging.getLogger("argos.repository")


async def save_analysis(analysis_data: dict[str, Any], job_id: Optional[str] = None) -> Optional[str]:
    """Persiste os dados completos de uma análise no banco de dados."""
    try:
        info = analysis_data.get("info", {}) or {}
        summary = analysis_data.get("summary", {}) or {}

        username = (info.get("username") or "perfil").lower().strip("@")
        full_name = info.get("nome_completo") or info.get("full_name") or ""
        source = analysis_data.get("source") or "apify"

        followers = int(info.get("seguidores") or info.get("followers") or 0)
        following = int(info.get("seguindo") or info.get("following") or 0)
        posts_count = int(info.get("posts") or info.get("posts_count") or len(analysis_data.get("posts", [])))

        eng_rate = float(summary.get("taxa_engajamento") or 0.0)
        avg_likes = float(summary.get("media_curtidas") or 0.0)
        avg_comments = float(summary.get("media_comentarios") or 0.0)
        total_inter = int(summary.get("total_interacoes") or 0)

        analysis_id = f"anl_{uuid.uuid4().hex[:12]}"

        model = AnalysisModel(
            id=analysis_id,
            job_id=job_id,
            username=username,
            full_name=full_name,
            source=source,
            followers=followers,
            following=following,
            posts_count=posts_count,
            engagement_rate=eng_rate,
            avg_likes=avg_likes,
            avg_comments=avg_comments,
            total_interactions=total_inter,
            raw_data=analysis_data,
        )

        async with get_db_session() as session:
            session.add(model)
            await session.commit()

        logger.info(f"Análise persistida com sucesso no banco: ID={analysis_id} (@{username})")
        return analysis_id

    except Exception as exc:
        logger.error(f"Erro ao salvar análise no banco de dados: {exc}", exc_info=True)
        return None


async def get_analysis_by_id(analysis_id: str) -> Optional[dict[str, Any]]:
    """Recupera a análise completa pelo ID, incluindo o último dossiê de IA se existir."""
    try:
        async with get_db_session() as session:
            stmt = select(AnalysisModel).where(AnalysisModel.id == analysis_id)
            result = await session.execute(stmt)
            obj = result.scalar_one_or_none()
            if obj:
                full_dict = obj.to_full_dict()
                ai_stmt = (
                    select(AiReportModel)
                    .where(
                        (AiReportModel.analysis_id == analysis_id)
                        | (AiReportModel.username == obj.username)
                    )
                    .order_by(desc(AiReportModel.created_at))
                    .limit(1)
                )
                ai_res = await session.execute(ai_stmt)
                latest_ai = ai_res.scalar_one_or_none()
                if latest_ai and latest_ai.diagnosis_data:
                    full_dict["ai_report"] = latest_ai.diagnosis_data
                return full_dict
    except Exception as exc:
        logger.error(f"Erro ao recuperar análise {analysis_id}: {exc}", exc_info=True)
    return None


async def list_analyses(
    username: Optional[str] = None, limit: int = 50, offset: int = 0
) -> list[dict[str, Any]]:
    """Lista resumos de análises persistidas com paginação e filtro opcional por username."""
    try:
        async with get_db_session() as session:
            stmt = select(AnalysisModel).order_by(desc(AnalysisModel.created_at)).offset(offset).limit(limit)
            if username:
                clean_user = username.lower().strip("@")
                stmt = stmt.where(AnalysisModel.username == clean_user)

            result = await session.execute(stmt)
            rows = result.scalars().all()
            return [row.to_summary_dict() for row in rows]
    except Exception as exc:
        logger.error(f"Erro ao listar análises do banco: {exc}", exc_info=True)
        return []


async def delete_analysis(analysis_id: str) -> bool:
    """Exclui uma análise e relatórios atrelados pelo ID."""
    try:
        async with get_db_session() as session:
            stmt = delete(AnalysisModel).where(AnalysisModel.id == analysis_id)
            result = await session.execute(stmt)
            await session.commit()
            return result.rowcount > 0
    except Exception as exc:
        logger.error(f"Erro ao excluir análise {analysis_id}: {exc}", exc_info=True)
        return False


async def save_ai_report(
    username: str,
    focus: str,
    provider: str,
    model: str,
    diagnosis_data: dict[str, Any],
    analysis_id: Optional[str] = None,
) -> Optional[str]:
    """Salva um relatório ou diagnóstico OSINT no banco."""
    try:
        report_id = f"rep_{uuid.uuid4().hex[:12]}"
        clean_user = username.lower().strip("@")

        report_model = AiReportModel(
            id=report_id,
            analysis_id=analysis_id,
            username=clean_user,
            focus=focus,
            provider=provider,
            model=model,
            diagnosis_data=diagnosis_data,
        )

        async with get_db_session() as session:
            session.add(report_model)
            await session.commit()

        logger.info(f"Relatório de IA persistido no banco: ID={report_id} (@{clean_user})")
        return report_id
    except Exception as exc:
        logger.error(f"Erro ao salvar relatório de IA no banco: {exc}", exc_info=True)
        return None


async def list_ai_reports_for_analysis(analysis_id: str) -> list[dict[str, Any]]:
    """Lista relatórios de IA vinculados a uma análise (ou pelo username correspondente)."""
    try:
        async with get_db_session() as session:
            anl_stmt = select(AnalysisModel.username).where(AnalysisModel.id == analysis_id)
            anl_res = await session.execute(anl_stmt)
            username = anl_res.scalar_one_or_none()

            if username:
                stmt = (
                    select(AiReportModel)
                    .where(
                        (AiReportModel.analysis_id == analysis_id)
                        | (AiReportModel.username == username)
                    )
                    .order_by(desc(AiReportModel.created_at))
                )
            else:
                stmt = (
                    select(AiReportModel)
                    .where(AiReportModel.analysis_id == analysis_id)
                    .order_by(desc(AiReportModel.created_at))
                )
            result = await session.execute(stmt)
            return [row.to_dict() for row in result.scalars().all()]
    except Exception as exc:
        logger.error(f"Erro ao listar relatórios de IA para análise {analysis_id}: {exc}", exc_info=True)
        return []


async def upsert_job(job_dict: dict[str, Any]) -> None:
    """Insere ou atualiza o estado de um job no banco para resiliência."""
    try:
        job_id = job_dict.get("job_id") or job_dict.get("id")
        if not job_id:
            return

        async with get_db_session() as session:
            stmt = select(JobModel).where(JobModel.id == job_id)
            result = await session.execute(stmt)
            existing = result.scalar_one_or_none()

            if existing:
                existing.status = job_dict.get("status", existing.status)
                existing.progress = job_dict.get("progress", existing.progress)
                existing.logs = job_dict.get("logs", existing.logs)
                existing.result_data = job_dict.get("result", existing.result_data)
                existing.error = job_dict.get("error", existing.error)
                existing.updated_at = float(job_dict.get("updated_at", existing.updated_at))
                if job_dict.get("completed_at"):
                    existing.completed_at = float(job_dict["completed_at"])
            else:
                new_job = JobModel(
                    id=job_id,
                    request_data=job_dict.get("request", {}),
                    status=job_dict.get("status", "pending"),
                    progress=job_dict.get("progress", ""),
                    logs=job_dict.get("logs", []),
                    result_data=job_dict.get("result"),
                    error=job_dict.get("error"),
                    created_at=float(job_dict.get("created_at", 0)),
                    updated_at=float(job_dict.get("updated_at", 0)),
                    completed_at=job_dict.get("completed_at"),
                )
                session.add(new_job)

            await session.commit()
    except Exception as exc:
        logger.debug(f"Aviso ao persistir job {job_dict.get('job_id')} no banco: {exc}")


async def get_job_by_id(job_id: str) -> Optional[dict[str, Any]]:
    """Busca um job persistido no banco."""
    try:
        async with get_db_session() as session:
            stmt = select(JobModel).where(JobModel.id == job_id)
            result = await session.execute(stmt)
            obj = result.scalar_one_or_none()
            if obj:
                return obj.to_dict()
    except Exception as exc:
        logger.error(f"Erro ao buscar job {job_id} no banco: {exc}", exc_info=True)
    return None


async def save_search_run(search_dict: dict[str, Any], job_id: Optional[str] = None) -> Optional[str]:
    """Persiste os resultados consolidados de uma busca transmídia."""
    from models import SearchRunModel
    try:
        search_id = search_dict.get("id") or f"sr_{uuid.uuid4().hex[:12]}"
        model = SearchRunModel(
            id=search_id,
            job_id=job_id,
            search_mode=search_dict.get("search_mode", "topic"),
            query=search_dict.get("query", ""),
            platforms=search_dict.get("platforms_requested", []),
            total_items=int(search_dict.get("total_items", 0)),
            total_views=int(search_dict.get("total_views", 0)),
            total_interactions=int(search_dict.get("total_interactions", 0)),
            avg_engagement_rate=float(search_dict.get("avg_engagement_rate", 0.0)),
            platform_summaries=search_dict.get("platform_summaries", {}),
            raw_data=search_dict,
        )
        async with get_db_session() as session:
            session.add(model)
            await session.commit()
        logger.info(f"Busca transmídia salva no banco: ID={search_id} ('{search_dict.get('query')}')")
        return search_id
    except Exception as exc:
        logger.error(f"Erro ao persistir busca transmídia: {exc}", exc_info=True)
        return None


async def get_search_run_by_id(search_id: str) -> Optional[dict[str, Any]]:
    """Recupera busca salva pelo ID."""
    from models import SearchRunModel
    try:
        async with get_db_session() as session:
            stmt = select(SearchRunModel).where(SearchRunModel.id == search_id)
            result = await session.execute(stmt)
            obj = result.scalar_one_or_none()
            if obj:
                return obj.to_full_dict()
    except Exception as exc:
        logger.error(f"Erro ao recuperar busca {search_id}: {exc}", exc_info=True)
    return None


async def list_search_runs(limit: int = 20) -> list[dict[str, Any]]:
    """Lista histórico recente de buscas multiplataforma."""
    from models import SearchRunModel
    try:
        async with get_db_session() as session:
            stmt = select(SearchRunModel).order_by(desc(SearchRunModel.created_at)).limit(limit)
            result = await session.execute(stmt)
            rows = result.scalars().all()
            return [r.to_summary_dict() for r in rows]
    except Exception as exc:
        logger.error(f"Erro ao listar buscas recentes: {exc}", exc_info=True)
        return []


async def delete_search_run(search_id: str) -> bool:
    """Remove uma busca do histórico."""
    from models import SearchRunModel
    try:
        async with get_db_session() as session:
            stmt = delete(SearchRunModel).where(SearchRunModel.id == search_id)
            res = await session.execute(stmt)
            await session.commit()
            return res.rowcount > 0
    except Exception as exc:
        logger.error(f"Erro ao deletar busca {search_id}: {exc}", exc_info=True)
        return False


async def save_omnichannel_report(
    search_run_id: str,
    query: str,
    provider: str,
    model: str,
    executive_summary: str,
    report_data: dict[str, Any],
) -> Optional[str]:
    """Salva relatório de IA transmídia."""
    from models import OmnichannelReportModel
    try:
        report_id = f"omni_{uuid.uuid4().hex[:12]}"
        obj = OmnichannelReportModel(
            id=report_id,
            search_run_id=search_run_id,
            query=query,
            provider=provider,
            model=model,
            executive_summary=executive_summary,
            report_data=report_data,
        )
        async with get_db_session() as session:
            session.add(obj)
            await session.commit()
        return report_id
    except Exception as exc:
        logger.error(f"Erro ao salvar relatório omnichannel: {exc}", exc_info=True)
        return None


async def upsert_osint_case(
    case_data: dict[str, Any],
    case_id: Optional[str] = None,
    title: Optional[str] = None,
    pivots_trail: Optional[list[str]] = None,
    analyst_notes: Optional[str] = None,
) -> Optional[dict[str, Any]]:
    """Persiste ou atualiza um Caso de Investigação OSINT no PostgreSQL com Hash SHA-256 Forense."""
    import hashlib
    import json
    from models import OsintCaseModel

    try:
        cid = case_id or case_data.get("case_id") or f"case_{uuid.uuid4().hex[:12]}"
        root_q = str(case_data.get("query") or case_data.get("target") or "Alvo OSINT")
        etype = str(case_data.get("entity_type") or "entity")
        graph = case_data.get("entity_graph") or {}
        total_nodes = int(graph.get("total_nodes") or len(graph.get("nodes") or []))
        total_edges = int(graph.get("total_edges") or len(graph.get("edges") or []))
        trail = pivots_trail or case_data.get("pivots_trail") or [root_q]

        custody_raw = json.dumps(
            {
                "case_id": cid,
                "root_query": root_q,
                "trail": trail,
                "total_nodes": total_nodes,
                "total_edges": total_edges,
                "notes": analyst_notes or "",
            },
            sort_keys=True,
        )
        sha256_hash = hashlib.sha256(custody_raw.encode("utf-8")).hexdigest()
        case_data["case_id"] = cid
        case_data["sha256_hash"] = sha256_hash
        case_data["pivots_trail"] = trail
        if analyst_notes is not None:
            case_data["analyst_notes"] = analyst_notes

        async with get_db_session() as session:
            stmt = select(OsintCaseModel).where(OsintCaseModel.id == cid)
            res = await session.execute(stmt)
            existing = res.scalar_one_or_none()

            if existing:
                existing.root_query = root_q
                existing.entity_type = etype
                if title:
                    existing.title = title
                existing.pivots_trail = trail
                existing.total_nodes = total_nodes
                existing.total_edges = total_edges
                existing.sha256_hash = sha256_hash
                if analyst_notes is not None:
                    existing.analyst_notes = analyst_notes
                existing.case_data = case_data
                await session.commit()
                await session.refresh(existing)
                return existing.to_summary_dict()
            else:
                new_case = OsintCaseModel(
                    id=cid,
                    root_query=root_q,
                    entity_type=etype,
                    title=title or f"Investigação: {root_q}",
                    pivots_trail=trail,
                    total_nodes=total_nodes,
                    total_edges=total_edges,
                    sha256_hash=sha256_hash,
                    analyst_notes=analyst_notes,
                    case_data=case_data,
                )
                session.add(new_case)
                await session.commit()
                await session.refresh(new_case)
                return new_case.to_summary_dict()
    except Exception as exc:
        logger.error(f"Erro ao persistir Caso OSINT no PostgreSQL: {exc}", exc_info=True)
        return None


async def list_osint_cases(limit: int = 30) -> list[dict[str, Any]]:
    """Lista os Casos de Investigação OSINT salvos no PostgreSQL."""
    from models import OsintCaseModel
    try:
        async with get_db_session() as session:
            stmt = select(OsintCaseModel).order_by(desc(OsintCaseModel.updated_at)).limit(limit)
            res = await session.execute(stmt)
            rows = res.scalars().all()
            return [r.to_summary_dict() for r in rows]
    except Exception as exc:
        logger.error(f"Erro ao listar Casos OSINT: {exc}", exc_info=True)
        return []


async def get_osint_case_by_id(case_id: str) -> Optional[dict[str, Any]]:
    """Recupera um Caso de Investigação OSINT completo pelo ID."""
    from models import OsintCaseModel
    try:
        async with get_db_session() as session:
            stmt = select(OsintCaseModel).where(OsintCaseModel.id == case_id)
            res = await session.execute(stmt)
            obj = res.scalar_one_or_none()
            if obj:
                return obj.to_full_dict()
    except Exception as exc:
        logger.error(f"Erro ao recuperar Caso OSINT {case_id}: {exc}", exc_info=True)
    return None


async def delete_osint_case(case_id: str) -> bool:
    """Remove um Caso de Investigação OSINT do PostgreSQL."""
    from models import OsintCaseModel
    try:
        async with get_db_session() as session:
            stmt = delete(OsintCaseModel).where(OsintCaseModel.id == case_id)
            res = await session.execute(stmt)
            await session.commit()
            return res.rowcount > 0
    except Exception as exc:
        logger.error(f"Erro ao excluir Caso OSINT {case_id}: {exc}", exc_info=True)
        return False


