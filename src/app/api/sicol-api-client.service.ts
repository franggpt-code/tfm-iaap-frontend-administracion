import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { environment } from "../../environments/environment";
import {
  AsistenciaUpdate,
  Aula,
  Centro,
  ConvocadoExamen,
  Examen,
  ImportacionArchivos,
  ImportacionResultado,
  PaginaProcesosSelectivos,
  PersonaOpositora,
  Provincia,
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

  listExamenes(procesoId: string): Observable<Examen[]> {
    return this.http.get<Examen[]>(`${this.adminUrl}/procesos-selectivos/${procesoId}/examenes`);
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
}
