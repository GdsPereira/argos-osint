"""Gerenciador de Jobs Assíncronos para Análise de Perfis.

Evita timeouts HTTP 504 permitindo execução em background e polling de status.
"""
from __future__ import annotations

import asyncio
from datetime import datetime
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional


class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class Job:
    id: str
    request: dict
    status: JobStatus = JobStatus.PENDING
    progress: str = "Aguardando início..."
    logs: list[dict] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    completed_at: Optional[float] = None
    result: Optional[dict] = None
    error: Optional[str] = None
    task: Optional[asyncio.Task] = None

    def to_dict(self) -> dict:
        return {
            "job_id": self.id,
            "status": self.status.value,
            "progress": self.progress,
            "logs": self.logs,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "completed_at": self.completed_at,
            "result": self.result,
            "error": self.error,
        }


class JobManager:
    def __init__(self, ttl_seconds: int = 3600):
        self._jobs: dict[str, Job] = {}
        self._ttl_seconds = ttl_seconds
        self._lock = asyncio.Lock()

    async def create_job(self, request_data: dict) -> Job:
        async with self._lock:
            self._cleanup_expired()
            job_id = f"job_{uuid.uuid4().hex[:12]}"
            initial_logs = [
                {
                    "timestamp": datetime.now().strftime("%H:%M:%S"),
                    "message": "Job registrado e enfileirado para execução.",
                    "level": "info",
                }
            ]
            job = Job(id=job_id, request=request_data, logs=initial_logs)
            self._jobs[job_id] = job
            try:
                import repository
                await repository.upsert_job(job.to_dict())
            except Exception:
                pass
            return job

    async def get_job(self, job_id: str) -> Optional[Job]:
        async with self._lock:
            job = self._jobs.get(job_id)
            if job:
                return job
            
        # Fallback de resiliência: se não estiver em memória (ex: reinicialização do pod/container), busca no banco
        try:
            import repository
            db_job = await repository.get_job_by_id(job_id)
            if db_job:
                recovered_job = Job(
                    id=db_job["job_id"],
                    request={},
                    status=JobStatus(db_job.get("status", "completed")),
                    progress=db_job.get("progress") or "",
                    logs=db_job.get("logs") or [],
                    created_at=float(db_job.get("created_at") or time.time()),
                    updated_at=float(db_job.get("updated_at") or time.time()),
                    completed_at=db_job.get("completed_at"),
                    result=db_job.get("result"),
                    error=db_job.get("error"),
                )
                async with self._lock:
                    self._jobs[job_id] = recovered_job
                return recovered_job
        except Exception:
            pass

        return None

    async def update_status(
        self,
        job_id: str,
        status: JobStatus,
        progress: Optional[str] = None,
        result: Optional[dict] = None,
        error: Optional[str] = None,
        log_level: Optional[str] = None,
    ):
        job_dict_to_save = None
        async with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return

            # CRÍTICO: Estados terminais são irreversíveis!
            if job.status in (JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED):
                if status in (JobStatus.PENDING, JobStatus.RUNNING):
                    return

            job.status = status
            job.updated_at = time.time()

            if progress is not None:
                job.progress = progress
                level = log_level or (
                    "error"
                    if status == JobStatus.FAILED
                    else (
                        "success"
                        if status == JobStatus.COMPLETED
                        else ("warning" if status == JobStatus.CANCELLED else "info")
                    )
                )
                if not job.logs or job.logs[-1].get("message") != progress:
                    job.logs.append({
                        "timestamp": datetime.now().strftime("%H:%M:%S"),
                        "message": progress,
                        "level": level,
                    })

            if result is not None:
                job.result = result
            if error is not None:
                job.error = error
                error_msg = str(error)
                if not any(error_msg in l.get("message", "") for l in job.logs):
                    job.logs.append({
                        "timestamp": datetime.now().strftime("%H:%M:%S"),
                        "message": f"Erro: {error_msg}",
                        "level": "error",
                    })

            if status in (JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED):
                job.completed_at = time.time()

            job_dict_to_save = job.to_dict()

        if job_dict_to_save:
            try:
                import repository
                await repository.upsert_job(job_dict_to_save)
            except Exception:
                pass

    async def cancel_job(self, job_id: str) -> bool:
        job_dict_to_save = None
        res = False
        async with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return False
            if job.status in (JobStatus.PENDING, JobStatus.RUNNING):
                if job.task and not job.task.done():
                    job.task.cancel()
                job.status = JobStatus.CANCELLED
                job.progress = "Cancelado pelo usuário."
                job.completed_at = time.time()
                job.logs.append({
                    "timestamp": datetime.now().strftime("%H:%M:%S"),
                    "message": "Execução cancelada pelo usuário.",
                    "level": "warning",
                })
                job_dict_to_save = job.to_dict()
                res = True

        if job_dict_to_save:
            try:
                import repository
                await repository.upsert_job(job_dict_to_save)
            except Exception:
                pass
        return res

    async def finish_job(
        self,
        job_id: str,
        result_id: Optional[str] = None,
        result_data: Optional[dict] = None,
        progress: str = "Concluído com sucesso.",
    ) -> None:
        """Marca o job como finalizado com sucesso."""
        await self.update_status(
            job_id,
            JobStatus.COMPLETED,
            progress=progress,
            result=result_data,
            log_level="success",
        )

    async def fail_job(self, job_id: str, error: str) -> None:
        """Marca o job como falho com mensagem de erro."""
        await self.update_status(
            job_id,
            JobStatus.FAILED,
            progress=f"Falha na execução: {error}",
            error=error,
            log_level="error",
        )

    def _cleanup_expired(self):
        now = time.time()
        expired = [
            jid
            for jid, j in self._jobs.items()
            if j.completed_at and (now - j.completed_at > self._ttl_seconds)
        ]
        for jid in expired:
            del self._jobs[jid]


job_manager = JobManager()

