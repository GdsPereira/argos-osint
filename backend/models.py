"""Modelos ORM SQLAlchemy para Persistência e Resiliência de Relatórios e Análises.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import (
    BigInteger,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class AnalysisModel(Base):
    """Armazena o resultado consolidado e detalhado das análises de perfis."""
    __tablename__ = "analyses"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    job_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    username: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    source: Mapped[str] = mapped_column(String(32), default="apify")
    followers: Mapped[int] = mapped_column(BigInteger, default=0)
    following: Mapped[int] = mapped_column(BigInteger, default=0)
    posts_count: Mapped[int] = mapped_column(Integer, default=0)
    engagement_rate: Mapped[float] = mapped_column(Float, default=0.0)
    avg_likes: Mapped[float] = mapped_column(Float, default=0.0)
    avg_comments: Mapped[float] = mapped_column(Float, default=0.0)
    total_interactions: Mapped[int] = mapped_column(BigInteger, default=0)
    raw_data: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relacionamento com relatórios de IA
    ai_reports: Mapped[list["AiReportModel"]] = relationship(
        "AiReportModel", back_populates="analysis", cascade="all, delete-orphan", lazy="selectin"
    )

    def to_summary_dict(self) -> dict[str, Any]:
        """Retorna resumo conciso para listagens e histórico."""
        return {
            "id": self.id,
            "job_id": self.job_id,
            "username": self.username,
            "full_name": self.full_name,
            "source": self.source,
            "followers": self.followers,
            "following": self.following,
            "posts_count": self.posts_count,
            "engagement_rate": self.engagement_rate,
            "avg_likes": self.avg_likes,
            "avg_comments": self.avg_comments,
            "total_interactions": self.total_interactions,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "has_ai_reports": len(self.ai_reports) > 0,
        }

    def to_full_dict(self) -> dict[str, Any]:
        """Retorna o payload analítico completo pronto para consumo pelo dashboard."""
        data = dict(self.raw_data) if self.raw_data else {}
        data["db_id"] = self.id
        data["db_saved_at"] = self.created_at.isoformat() if self.created_at else None
        return data


class AiReportModel(Base):
    """Armazena relatórios, diagnósticos OSINT e consultoria estratégica gerados por IA."""
    __tablename__ = "ai_reports"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    analysis_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=True, index=True
    )
    username: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    focus: Mapped[str] = mapped_column(String(64), default="general")
    provider: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    model: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    diagnosis_data: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    analysis: Mapped[Optional[AnalysisModel]] = relationship("AnalysisModel", back_populates="ai_reports")

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "analysis_id": self.analysis_id,
            "username": self.username,
            "focus": self.focus,
            "provider": self.provider,
            "model": self.model,
            "diagnosis": self.diagnosis_data,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class JobModel(Base):
    """Persistência de jobs em background para tolerância a falhas e reinicializações."""
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    request_data: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True)
    progress: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    logs: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    result_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    result_data: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[float] = mapped_column(Float, nullable=False)
    updated_at: Mapped[float] = mapped_column(Float, nullable=False)
    completed_at: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    def to_dict(self) -> dict[str, Any]:
        return {
            "job_id": self.id,
            "status": self.status,
            "progress": self.progress,
            "logs": self.logs,
            "result_id": self.result_id,
            "result": self.result_data,
            "error": self.error,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "completed_at": self.completed_at,
        }


class SearchRunModel(Base):
    """Armazena o histórico e resultado consolidado de buscas multiplataforma e social listening."""
    __tablename__ = "search_runs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    job_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    search_mode: Mapped[str] = mapped_column(String(32), default="topic")  # 'topic' ou 'profile'
    query: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    platforms: Mapped[list[str]] = mapped_column(JSON, default=list)
    total_items: Mapped[int] = mapped_column(Integer, default=0)
    total_views: Mapped[int] = mapped_column(BigInteger, default=0)
    total_interactions: Mapped[int] = mapped_column(BigInteger, default=0)
    avg_engagement_rate: Mapped[float] = mapped_column(Float, default=0.0)
    platform_summaries: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    raw_data: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    omnichannel_reports: Mapped[list["OmnichannelReportModel"]] = relationship(
        "OmnichannelReportModel", back_populates="search_run", cascade="all, delete-orphan", lazy="selectin"
    )

    def to_summary_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "job_id": self.job_id,
            "search_mode": self.search_mode,
            "query": self.query,
            "platforms": self.platforms,
            "total_items": self.total_items,
            "total_views": self.total_views,
            "total_interactions": self.total_interactions,
            "avg_engagement_rate": self.avg_engagement_rate,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "has_ai_reports": len(self.omnichannel_reports) > 0,
        }

    def to_full_dict(self) -> dict[str, Any]:
        data = dict(self.raw_data) if self.raw_data else {}
        data["db_id"] = self.id
        data["db_saved_at"] = self.created_at.isoformat() if self.created_at else None
        return data


class OmnichannelReportModel(Base):
    """Armazena relatórios de Inteligência Omnichannel 360° gerados por IA."""
    __tablename__ = "omnichannel_reports"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    search_run_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("search_runs.id", ondelete="CASCADE"), nullable=True, index=True
    )
    query: Mapped[str] = mapped_column(String(255), nullable=False)
    provider: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    model: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    executive_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    report_data: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    search_run: Mapped[Optional[SearchRunModel]] = relationship("SearchRunModel", back_populates="omnichannel_reports")

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "search_run_id": self.search_run_id,
            "query": self.query,
            "provider": self.provider,
            "model": self.model,
            "executive_summary": self.executive_summary,
            "report_data": self.report_data,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class OsintCaseModel(Base):
    """Armazena Casos de Investigação OSINT (Grafo de Vínculos, Trilha de Pivôs e Hash SHA-256 Forense)."""
    __tablename__ = "osint_cases"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    root_query: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(64), default="entity", index=True)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    pivots_trail: Mapped[list[str]] = mapped_column(JSON, default=list)
    total_nodes: Mapped[int] = mapped_column(Integer, default=0)
    total_edges: Mapped[int] = mapped_column(Integer, default=0)
    sha256_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    analyst_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    case_data: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def to_summary_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "root_query": self.root_query,
            "entity_type": self.entity_type,
            "title": self.title or f"Caso OSINT: {self.root_query}",
            "pivots_trail": self.pivots_trail or [self.root_query],
            "total_nodes": self.total_nodes,
            "total_edges": self.total_edges,
            "sha256_hash": self.sha256_hash,
            "analyst_notes": self.analyst_notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.created_at else None,
        }

    def to_full_dict(self) -> dict[str, Any]:
        data = dict(self.case_data) if self.case_data else {}
        data["case_id"] = self.id
        data["sha256_hash"] = self.sha256_hash
        data["analyst_notes"] = self.analyst_notes
        data["pivots_trail"] = self.pivots_trail or [self.root_query]
        data["saved_at"] = self.created_at.isoformat() if self.created_at else None
        return data


