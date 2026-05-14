import { HttpClient, HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { forkJoin, Observable } from "rxjs";
import { environment } from "../../environments/environment";
import { ApiPage, Colaborador, Examen, ExamenAula, ProcesoSelectivo } from "./api.models";

@Injectable({ providedIn: "root" })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly adminUrl = `${environment.apiBaseUrl}/admin`;

  listColaboradores(filters: {
    provincia?: string;
    localidad?: string;
    estado?: string;
    page?: number;
    size?: number;
  }): Observable<ApiPage<Colaborador>> {
    return this.http.get<ApiPage<Colaborador>>(`${this.adminUrl}/colaboradores`, {
      params: this.toParams(filters),
    });
  }

  listProcesosSelectivos(page = 0, size = 10): Observable<ApiPage<ProcesoSelectivo>> {
    return this.http.get<ApiPage<ProcesoSelectivo>>(`${this.adminUrl}/procesos-selectivos`, {
      params: this.toParams({ page, size }),
    });
  }

  getProcesoSelectivo(id: string): Observable<ProcesoSelectivo> {
    return this.http.get<ProcesoSelectivo>(`${this.adminUrl}/procesos-selectivos/${id}`);
  }

  listExamenes(procesoSelectivoId: string): Observable<Examen[]> {
    return this.http.get<Examen[]>(`${this.adminUrl}/procesos-selectivos/${procesoSelectivoId}/examenes`);
  }

  listAulas(examenId: string): Observable<ExamenAula[]> {
    return this.http.get<ExamenAula[]>(`${this.adminUrl}/examenes/${examenId}/aulas`);
  }

  loadDashboard(): Observable<{
    colaboradores: ApiPage<Colaborador>;
    procesos: ApiPage<ProcesoSelectivo>;
  }> {
    return forkJoin({
      colaboradores: this.listColaboradores({ page: 0, size: 10 }),
      procesos: this.listProcesosSelectivos(0, 10),
    });
  }

  private toParams(values: Record<string, string | number | undefined>): HttpParams {
    let params = new HttpParams();
    Object.entries(values).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        params = params.set(key, String(value));
      }
    });
    return params;
  }
}
