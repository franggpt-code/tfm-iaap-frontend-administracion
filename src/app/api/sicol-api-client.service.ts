import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { environment } from "../../environments/environment";
import {
  AsistenciaUpdate,
  Aula,
  Centro,
  ConvocadoExamen,
  Cuerpo,
  CuerpoCreateUpdate,
  Examen,
  ExamenCreate,
  ExamenPatch,
  ImportacionArchivos,
  ImportacionDatamartResultado,
  ImportacionResultado,
  PaginaProcesosSelectivos,
  ProcesoSelectivo,
  ProcesoSelectivoCreate,
  ProcesoSelectivoPatch,
  PersonaOpositora,
  Provincia,
  Oep,
  OepCreateUpdate,
  TipoAcceso,
  TipoAccesoCreateUpdate,
  TipoVinculacion,
  TipoVinculacionCreateUpdate,
} from "./sicol.types";

@Injectable({ providedIn: "root" })
export class SicolApiClient {
  private readonly http = inject(HttpClient);
  private readonly adminUrl = `${environment.apiBaseUrl}/admin`;

  listProcesos(page = 0, size = 100): Observable<PaginaProcesosSelectivos> {
    return this.http.get<PaginaProcesosSelectivos>(`${this.adminUrl}/procesos-selectivos`, {
      params: { page, size },
    });
  }

  createProceso(payload: ProcesoSelectivoCreate): Observable<ProcesoSelectivo> {
    return this.http.post<ProcesoSelectivo>(`${this.adminUrl}/procesos-selectivos`, payload);
  }

  updateProceso(id: string, payload: ProcesoSelectivoPatch): Observable<ProcesoSelectivo> {
    return this.http.patch<ProcesoSelectivo>(`${this.adminUrl}/procesos-selectivos/${id}`, payload);
  }

  listExamenes(procesoId: string): Observable<Examen[]> {
    return this.http.get<Examen[]>(`${this.adminUrl}/procesos-selectivos/${procesoId}/examenes`);
  }

  createExamen(procesoId: string, payload: ExamenCreate): Observable<Examen> {
    return this.http.post<Examen>(`${this.adminUrl}/procesos-selectivos/${procesoId}/examenes`, payload);
  }

  updateExamen(id: string, payload: ExamenPatch): Observable<Examen> {
    return this.http.patch<Examen>(`${this.adminUrl}/examenes/${id}`, payload);
  }

  simularImportacion(payload: ImportacionArchivos): Observable<ImportacionResultado> {
    return this.http.post<ImportacionResultado>(
      `${this.adminUrl}/importaciones/opositores-aulas/simulacion`,
      this.toImportacionFormData(payload),
    );
  }

  confirmarImportacion(payload: ImportacionArchivos): Observable<ImportacionResultado> {
    return this.http.post<ImportacionResultado>(
      `${this.adminUrl}/importaciones/opositores-aulas`,
      this.toImportacionFormData(payload),
    );
  }

  simularImportacionDatamart(fichero: File): Observable<ImportacionDatamartResultado> {
    return this.http.post<ImportacionDatamartResultado>(
      `${this.adminUrl}/importaciones/datamart-convocatorias/simulacion`,
      this.toSingleFileFormData(fichero),
    );
  }

  confirmarImportacionDatamart(fichero: File): Observable<ImportacionDatamartResultado> {
    return this.http.post<ImportacionDatamartResultado>(
      `${this.adminUrl}/importaciones/datamart-convocatorias`,
      this.toSingleFileFormData(fichero),
    );
  }

  listConvocadosByExamen(examenId: string): Observable<ConvocadoExamen[]> {
    return this.http.get<ConvocadoExamen[]>(`${this.adminUrl}/examenes/${examenId}/convocados`);
  }

  listConvocadosByAula(examenAulaId: string): Observable<ConvocadoExamen[]> {
    return this.http.get<ConvocadoExamen[]>(`${this.adminUrl}/examenes-aula/${examenAulaId}/convocados`);
  }

  updateAsistencia(convocadoId: string, payload: AsistenciaUpdate): Observable<ConvocadoExamen> {
    return this.http.patch<ConvocadoExamen>(
      `${this.adminUrl}/convocados-examen/${convocadoId}/asistencia`,
      payload,
    );
  }

  getPersona(personaId: string): Observable<PersonaOpositora> {
    return this.http.get<PersonaOpositora>(`${this.adminUrl}/personas-opositoras/${personaId}`);
  }

  listProvincias(): Observable<Provincia[]> {
    return this.http.get<Provincia[]>(`${this.adminUrl}/provincias`);
  }

  listCentros(provinciaId: string): Observable<Centro[]> {
    return this.http.get<Centro[]>(`${this.adminUrl}/provincias/${provinciaId}/centros`);
  }

  listAulas(centroId: string): Observable<Aula[]> {
    return this.http.get<Aula[]>(`${this.adminUrl}/centros/${centroId}/aulas`);
  }

  listOep(): Observable<Oep[]> {
    return this.http.get<Oep[]>(`${this.adminUrl}/oep`);
  }

  createOep(payload: OepCreateUpdate): Observable<Oep> {
    return this.http.post<Oep>(`${this.adminUrl}/oep`, payload);
  }

  updateOep(id: number, payload: OepCreateUpdate): Observable<Oep> {
    return this.http.put<Oep>(`${this.adminUrl}/oep/${id}`, payload);
  }

  deleteOep(id: number): Observable<void> {
    return this.http.delete<void>(`${this.adminUrl}/oep/${id}`);
  }

  listTiposAcceso(): Observable<TipoAcceso[]> {
    return this.http.get<TipoAcceso[]>(`${this.adminUrl}/tipos-acceso`);
  }

  createTipoAcceso(payload: TipoAccesoCreateUpdate): Observable<TipoAcceso> {
    return this.http.post<TipoAcceso>(`${this.adminUrl}/tipos-acceso`, payload);
  }

  updateTipoAcceso(id: number, payload: TipoAccesoCreateUpdate): Observable<TipoAcceso> {
    return this.http.put<TipoAcceso>(`${this.adminUrl}/tipos-acceso/${id}`, payload);
  }

  deleteTipoAcceso(id: number): Observable<void> {
    return this.http.delete<void>(`${this.adminUrl}/tipos-acceso/${id}`);
  }

  listTiposVinculacion(): Observable<TipoVinculacion[]> {
    return this.http.get<TipoVinculacion[]>(`${this.adminUrl}/tipos-vinculacion`);
  }

  createTipoVinculacion(payload: TipoVinculacionCreateUpdate): Observable<TipoVinculacion> {
    return this.http.post<TipoVinculacion>(`${this.adminUrl}/tipos-vinculacion`, payload);
  }

  updateTipoVinculacion(id: number, payload: TipoVinculacionCreateUpdate): Observable<TipoVinculacion> {
    return this.http.put<TipoVinculacion>(`${this.adminUrl}/tipos-vinculacion/${id}`, payload);
  }

  deleteTipoVinculacion(id: number): Observable<void> {
    return this.http.delete<void>(`${this.adminUrl}/tipos-vinculacion/${id}`);
  }

  listCuerpos(): Observable<Cuerpo[]> {
    return this.http.get<Cuerpo[]>(`${this.adminUrl}/cuerpos`);
  }

  createCuerpo(payload: CuerpoCreateUpdate): Observable<Cuerpo> {
    return this.http.post<Cuerpo>(`${this.adminUrl}/cuerpos`, payload);
  }

  updateCuerpo(id: number, payload: CuerpoCreateUpdate): Observable<Cuerpo> {
    return this.http.put<Cuerpo>(`${this.adminUrl}/cuerpos/${id}`, payload);
  }

  deleteCuerpo(id: number): Observable<void> {
    return this.http.delete<void>(`${this.adminUrl}/cuerpos/${id}`);
  }

  private toImportacionFormData(payload: ImportacionArchivos): FormData {
    const formData = new FormData();
    formData.append("procesoSelectivoId", payload.procesoSelectivoId);
    formData.append("examenId", payload.examenId);
    formData.append("ficheroSirhus", payload.ficheroSirhus);
    if (payload.ficheroCaronte) {
      formData.append("ficheroCaronte", payload.ficheroCaronte);
    }
    return formData;
  }

  private toSingleFileFormData(fichero: File): FormData {
    const formData = new FormData();
    formData.append("fichero", fichero);
    return formData;
  }
}
