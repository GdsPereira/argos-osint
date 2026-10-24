import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import {
  AnalyzeRequest,
  AnalyzeResponse,
  AsyncStartResponse,
  ConfigResponse,
  JobResponse
} from '../models/instagram.model';
import {
  OsintDorkRequest,
  OsintDorkResponse,
  BioResolveRequest,
  BioResolveResponse,
  UsernameScanRequest,
  UsernameScanResponse,
  OsintDossierRequest,
  OsintDossierResponse,
  DomainIntelResponse,
  SubdomainEnumResponse,
  EmailFootprintResponse,
  ArchiveLookupResponse,
  EntityGraphData,
  ArgosAiAssessmentResponse,
  OmniSearchResponse,
  PhoneFootprintResponse,
  OsintCaseSummary,
} from '../models/osint.model';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api';

  getImageProxyUrl(url?: string | null): string {
    if (!url) return '';
    const trimmed = url.trim();
    if (trimmed.startsWith('/api/') || trimmed.startsWith('data:')) {
      return trimmed;
    }
    return `${this.baseUrl}/proxy-image?url=${encodeURIComponent(trimmed)}`;
  }

  getVideoProxyUrl(url?: string | null): string {
    if (!url) return '';
    const trimmed = url.trim();
    if (trimmed.startsWith('/api/') || trimmed.startsWith('data:')) {
      return trimmed;
    }
    return `${this.baseUrl}/proxy-video?url=${encodeURIComponent(trimmed)}`;
  }

  getConfig(): Observable<ConfigResponse> {
    return this.http.get<ConfigResponse>(`${this.baseUrl}/config`).pipe(
      catchError(this.handleError)
    );
  }

  analyze(payload: AnalyzeRequest): Observable<AnalyzeResponse> {
    return this.http.post<AnalyzeResponse>(`${this.baseUrl}/analyze`, payload).pipe(
      catchError(this.handleError)
    );
  }

  analyzeAsync(payload: AnalyzeRequest): Observable<AsyncStartResponse> {
    return this.http.post<AsyncStartResponse>(`${this.baseUrl}/analyze/async`, payload).pipe(
      catchError(this.handleError)
    );
  }

  getJob(jobId: string): Observable<JobResponse> {
    return this.http.get<JobResponse>(`${this.baseUrl}/jobs/${jobId}`).pipe(
      catchError(this.handleError)
    );
  }

  cancelJob(jobId: string): Observable<{ job_id: string; status: string }> {
    return this.http.delete<{ job_id: string; status: string }>(`${this.baseUrl}/jobs/${jobId}`).pipe(
      catchError(this.handleError)
    );
  }

  getAiDiagnosis(payload: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/ai/diagnose`, payload).pipe(
      catchError(this.handleError)
    );
  }

  sendAiChatMessage(payload: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/ai/chat`, payload).pipe(
      catchError(this.handleError)
    );
  }

  getReports(username?: string): Observable<any[]> {
    const params: any = {};
    if (username) params.username = username;
    return this.http.get<any[]>(`${this.baseUrl}/reports`, { params }).pipe(
      catchError(this.handleError)
    );
  }

  getReportById(id: string): Observable<AnalyzeResponse> {
    return this.http.get<AnalyzeResponse>(`${this.baseUrl}/reports/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  getReportAiDossiers(reportId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/reports/${reportId}/ai`).pipe(
      catchError(this.handleError)
    );
  }

  deleteReport(id: string): Observable<{ id: string; deleted: boolean }> {
    return this.http.delete<{ id: string; deleted: boolean }>(`${this.baseUrl}/reports/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  getDbHealth(): Observable<{ database: any }> {
    return this.http.get<{ database: any }>(`${this.baseUrl}/health/db`).pipe(
      catchError(this.handleError)
    );
  }

  // ==========================================
  // Métodos Multiplataforma & Social Listening
  // ==========================================

  searchMulti(payload: any): Observable<AsyncStartResponse> {
    return this.http.post<AsyncStartResponse>(`${this.baseUrl}/search/multi`, payload).pipe(
      catchError(this.handleError)
    );
  }

  getSearchRuns(limit = 30): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/search/runs?limit=${limit}`).pipe(
      catchError(this.handleError)
    );
  }

  getSearchRunById(id: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/search/runs/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  deleteSearchRun(id: string): Observable<{ id: string; deleted: boolean }> {
    return this.http.delete<{ id: string; deleted: boolean }>(`${this.baseUrl}/search/runs/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  getOmnichannelAiAudit(payload: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/search/ai/audit`, payload).pipe(
      catchError(this.handleError)
    );
  }

  sendOmnichannelAiChat(payload: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/search/ai/chat`, payload).pipe(
      catchError(this.handleError)
    );
  }

  // ==========================================
  // Métodos OSINT & Dorking (Open Source)
  // ==========================================

  searchOsintDork(payload: OsintDorkRequest): Observable<OsintDorkResponse> {
    return this.http.post<OsintDorkResponse>(`${this.baseUrl}/osint/dork`, payload).pipe(
      catchError(this.handleError)
    );
  }

  resolveBioUrl(payload: BioResolveRequest): Observable<BioResolveResponse> {
    return this.http.post<BioResolveResponse>(`${this.baseUrl}/osint/bio-resolve`, payload).pipe(
      catchError(this.handleError)
    );
  }

  scanUsernameFootprint(payload: UsernameScanRequest): Observable<UsernameScanResponse> {
    return this.http.post<UsernameScanResponse>(`${this.baseUrl}/osint/username-scan`, payload).pipe(
      catchError(this.handleError)
    );
  }

  generateOsintDossier(payload: OsintDossierRequest): Observable<OsintDossierResponse> {
    return this.http.post<OsintDossierResponse>(`${this.baseUrl}/argos/dossier`, payload).pipe(
      catchError(this.handleError)
    );
  }

  inspectDomain(domain: string): Observable<DomainIntelResponse> {
    return this.http.post<DomainIntelResponse>(`${this.baseUrl}/argos/domain-inspect`, { domain }).pipe(
      catchError(this.handleError)
    );
  }

  enumerateSubdomains(domain: string, limit = 40): Observable<SubdomainEnumResponse> {
    return this.http.post<SubdomainEnumResponse>(`${this.baseUrl}/argos/subdomain-enum`, { domain, limit }).pipe(
      catchError(this.handleError)
    );
  }

  scanEmailFootprint(email: string): Observable<EmailFootprintResponse> {
    return this.http.post<EmailFootprintResponse>(`${this.baseUrl}/argos/email-footprint`, { email }).pipe(
      catchError(this.handleError)
    );
  }

  lookupArchive(url: string, limit = 12): Observable<ArchiveLookupResponse> {
    return this.http.post<ArchiveLookupResponse>(`${this.baseUrl}/argos/archive-lookup`, { url, limit }).pipe(
      catchError(this.handleError)
    );
  }

  generateEntityGraph(dossier: any): Observable<EntityGraphData> {
    return this.http.post<EntityGraphData>(`${this.baseUrl}/argos/entity-graph`, { dossier }).pipe(
      catchError(this.handleError)
    );
  }

  getArgosAiAssessment(payload: { dossier: any; provider?: string; model?: string; token?: string; fallback_token?: string }): Observable<ArgosAiAssessmentResponse> {
    return this.http.post<ArgosAiAssessmentResponse>(`${this.baseUrl}/argos/ai-assessment`, payload).pipe(
      catchError(this.handleError)
    );
  }

  omniSearch(query: string, caseId?: string, autoSave = true): Observable<OmniSearchResponse> {
    return this.http.post<OmniSearchResponse>(`${this.baseUrl}/argos/omni-search`, {
      query,
      case_id: caseId,
      auto_save: autoSave,
    }).pipe(
      catchError(this.handleError)
    );
  }

  scanPhoneFootprint(phone: string): Observable<PhoneFootprintResponse> {
    return this.http.post<PhoneFootprintResponse>(`${this.baseUrl}/argos/phone-footprint`, { phone }).pipe(
      catchError(this.handleError)
    );
  }

  listOsintCases(limit = 30): Observable<OsintCaseSummary[]> {
    return this.http.get<OsintCaseSummary[]>(`${this.baseUrl}/argos/cases?limit=${limit}`).pipe(
      catchError(this.handleError)
    );
  }

  getOsintCaseById(caseId: string): Observable<OmniSearchResponse> {
    return this.http.get<OmniSearchResponse>(`${this.baseUrl}/argos/cases/${encodeURIComponent(caseId)}`).pipe(
      catchError(this.handleError)
    );
  }

  saveOsintCase(payload: {
    case_id?: string;
    title?: string;
    pivots_trail?: string[];
    analyst_notes?: string;
    case_data: any;
  }): Observable<OsintCaseSummary> {
    return this.http.post<OsintCaseSummary>(`${this.baseUrl}/argos/cases`, payload).pipe(
      catchError(this.handleError)
    );
  }

  deleteOsintCase(caseId: string): Observable<{ id: string; deleted: boolean }> {
    return this.http.delete<{ id: string; deleted: boolean }>(`${this.baseUrl}/argos/cases/${encodeURIComponent(caseId)}`).pipe(
      catchError(this.handleError)
    );
  }


  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Ocorreu um erro inesperado ao se comunicar com o servidor.';

    if (error.error instanceof ErrorEvent) {
      // Erro do lado do cliente
      errorMessage = `Erro de conexão: ${error.error.message}`;
    } else if (error.error && typeof error.error === 'object' && error.error.detail) {
      // FastAPI HTTPException detail
      errorMessage = error.error.detail;
    } else if (error.status === 0) {
      errorMessage = 'Não foi possível conectar ao backend FastAPI em http://localhost:8000. Verifique se o servidor está ativo.';
    } else if (error.status === 404) {
      errorMessage = 'Endpoint da API não encontrado (404).';
    } else if (error.status === 502) {
      errorMessage = `Erro na API externa (502): ${error.error?.detail || error.message}`;
    } else {
      errorMessage = `Erro ${error.status}: ${error.statusText || error.message}`;
    }

    return throwError(() => new Error(errorMessage));
  }

  /**
   * Exporta array de objetos para CSV com suporte a UTF-8 (BOM) e escape de campos.
   */
  exportToCsv(data: Record<string, any>[], filename: string): void {
    if (!data || data.length === 0) {
      return;
    }

    const headers = Object.keys(data[0]);
    const csvRows: string[] = [];

    // Header row
    csvRows.push(headers.map(h => this.formatCsvField(h)).join(';'));

    // Data rows
    for (const row of data) {
      const values = headers.map(header => {
        const val = row[header];
        if (val === null || val === undefined) {
          return '';
        }
        if (Array.isArray(val)) {
          return val.join(', ');
        }
        if (typeof val === 'object') {
          return JSON.stringify(val);
        }
        return String(val);
      });
      csvRows.push(values.map(v => this.formatCsvField(v)).join(';'));
    }

    // Adiciona UTF-8 BOM (\uFEFF) para garantir caracteres corretos no Excel
    const csvString = '\uFEFF' + csvRows.join('\r\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    this.downloadBlob(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
  }

  /**
   * Exporta qualquer dado estruturado para JSON.
   */
  exportToJson(data: any, filename: string): void {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
    this.downloadBlob(blob, filename.endsWith('.json') ? filename : `${filename}.json`);
  }

  /**
   * Exporta texto puro (ex: relatório sumarizado).
   */
  exportToText(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    this.downloadBlob(blob, filename.endsWith('.txt') ? filename : `${filename}.txt`);
  }

  private formatCsvField(field: string): string {
    const escaped = field.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
