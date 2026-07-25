import { HttpClient, HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { forkJoin, Observable } from "rxjs";
import { environment } from "../../environments/environment";
import {
  ApiPage,
  AsignacionColaborador,
  AsignacionColaboradorCreate,
  AsignacionColaboradorPatch,
  CentroExamen,
  Colaborador,
  ColaboradorCreate,
  ColaboradorPatch,
  Cuerpo,
  CuerpoCreateUpdate,
  Examen,
  ExamenAula,
  ExamenCreate,
  ExamenPatch,
  HojasFirma,
  ImporteAsignacion,
  ImportacionDatosBaseResultado,
  ImportacionProcesosSelectivosResultado,
  Oep,
  OepCreateUpdate,
  PagosColaboradores,
  PerfilColaboracion,
  ProcesoSelectivo,
  ProcesoSelectivoCreate,
  ProcesoSelectivoPatch,
  ResumenColaboraciones,
  TipoAcceso,
  TipoAccesoCreateUpdate,
  TipoVinculacion,
  TipoVinculacionCreateUpdate,
  UsuarioAdmin,
  UsuarioAdminCreateUpdate,
} from "./api.models";

@Injectable({ providedIn: "root" })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly adminUrl = `${environment.apiBaseUrl}/admin`;

  listUsuariosAdmin(): Observable<UsuarioAdmin[]> {
    return this.http.get<UsuarioAdmin[]>(`${this.adminUrl}/usuarios`);
  }

  createUsuarioAdmin(request: UsuarioAdminCreateUpdate): Observable<UsuarioAdmin> {
    return this.http.post<UsuarioAdmin>(`${this.adminUrl}/usuarios`, request);
  }

  updateUsuarioAdmin(idUsuario: string, request: UsuarioAdminCreateUpdate): Observable<UsuarioAdmin> {
    return this.http.put<UsuarioAdmin>(`${this.adminUrl}/usuarios/${idUsuario}`, request);
  }

  deleteUsuarioAdmin(idUsuario: string): Observable<void> {
    return this.http.delete<void>(`${this.adminUrl}/usuarios/${idUsuario}`);
  }

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

  createColaborador(request: ColaboradorCreate): Observable<Colaborador> {
    return this.http.post<Colaborador>(`${this.adminUrl}/colaboradores`, request);
  }

  importColaboradores(request: ColaboradorCreate[]): Observable<Colaborador[]> {
    return this.http.post<Colaborador[]>(`${this.adminUrl}/colaboradores/importacion`, request);
  }

  patchColaborador(id: string, request: ColaboradorPatch): Observable<Colaborador> {
    return this.http.patch<Colaborador>(`${this.adminUrl}/colaboradores/${id}`, request);
  }

  deleteColaborador(id: string): Observable<void> {
    return this.http.delete<void>(`${this.adminUrl}/colaboradores/${id}`);
  }

  listOep(): Observable<Oep[]> {
    return this.http.get<Oep[]>(`${this.adminUrl}/oep`);
  }

  createOep(request: OepCreateUpdate): Observable<Oep> {
    return this.http.post<Oep>(`${this.adminUrl}/oep`, request);
  }

  updateOep(idOep: number, request: OepCreateUpdate): Observable<Oep> {
    return this.http.put<Oep>(`${this.adminUrl}/oep/${idOep}`, request);
  }

  deleteOep(idOep: number): Observable<void> {
    return this.http.delete<void>(`${this.adminUrl}/oep/${idOep}`);
  }

  listTiposAcceso(): Observable<TipoAcceso[]> {
    return this.http.get<TipoAcceso[]>(`${this.adminUrl}/tipos-acceso`);
  }

  createTipoAcceso(request: TipoAccesoCreateUpdate): Observable<TipoAcceso> {
    return this.http.post<TipoAcceso>(`${this.adminUrl}/tipos-acceso`, request);
  }

  updateTipoAcceso(idTipoAcceso: number, request: TipoAccesoCreateUpdate): Observable<TipoAcceso> {
    return this.http.put<TipoAcceso>(`${this.adminUrl}/tipos-acceso/${idTipoAcceso}`, request);
  }

  deleteTipoAcceso(idTipoAcceso: number): Observable<void> {
    return this.http.delete<void>(`${this.adminUrl}/tipos-acceso/${idTipoAcceso}`);
  }

  listTiposVinculacion(): Observable<TipoVinculacion[]> {
    return this.http.get<TipoVinculacion[]>(`${this.adminUrl}/tipos-vinculacion`);
  }

  createTipoVinculacion(request: TipoVinculacionCreateUpdate): Observable<TipoVinculacion> {
    return this.http.post<TipoVinculacion>(`${this.adminUrl}/tipos-vinculacion`, request);
  }

  updateTipoVinculacion(idTipoVinculacion: number, request: TipoVinculacionCreateUpdate): Observable<TipoVinculacion> {
    return this.http.put<TipoVinculacion>(`${this.adminUrl}/tipos-vinculacion/${idTipoVinculacion}`, request);
  }

  deleteTipoVinculacion(idTipoVinculacion: number): Observable<void> {
    return this.http.delete<void>(`${this.adminUrl}/tipos-vinculacion/${idTipoVinculacion}`);
  }

  listCuerpos(): Observable<Cuerpo[]> {
    return this.http.get<Cuerpo[]>(`${this.adminUrl}/cuerpos`);
  }

  createCuerpo(request: CuerpoCreateUpdate): Observable<Cuerpo> {
    return this.http.post<Cuerpo>(`${this.adminUrl}/cuerpos`, request);
  }

  updateCuerpo(idCuerpo: number, request: CuerpoCreateUpdate): Observable<Cuerpo> {
    return this.http.put<Cuerpo>(`${this.adminUrl}/cuerpos/${idCuerpo}`, request);
  }

  deleteCuerpo(idCuerpo: number): Observable<void> {
    return this.http.delete<void>(`${this.adminUrl}/cuerpos/${idCuerpo}`);
  }

  listProcesosSelectivos(page = 0, size = 10): Observable<ApiPage<ProcesoSelectivo>> {
    return this.http.get<ApiPage<ProcesoSelectivo>>(`${this.adminUrl}/procesos-selectivos`, {
      params: this.toParams({ page, size }),
    });
  }

  getProcesoSelectivo(id: string): Observable<ProcesoSelectivo> {
    return this.http.get<ProcesoSelectivo>(`${this.adminUrl}/procesos-selectivos/${id}`);
  }

  createProcesoSelectivo(request: ProcesoSelectivoCreate): Observable<ProcesoSelectivo> {
    return this.http.post<ProcesoSelectivo>(`${this.adminUrl}/procesos-selectivos`, request);
  }

  importProcesosSelectivos(request: ProcesoSelectivoCreate[]): Observable<ProcesoSelectivo[]> {
    return this.http.post<ProcesoSelectivo[]>(`${this.adminUrl}/procesos-selectivos/importacion`, request);
  }

  patchProcesoSelectivo(id: string, request: ProcesoSelectivoPatch): Observable<ProcesoSelectivo> {
    return this.http.patch<ProcesoSelectivo>(`${this.adminUrl}/procesos-selectivos/${id}`, request);
  }

  deleteProcesoSelectivo(id: string): Observable<void> {
    return this.http.delete<void>(`${this.adminUrl}/procesos-selectivos/${id}`);
  }

  listExamenes(procesoSelectivoId: string): Observable<Examen[]> {
    return this.http.get<Examen[]>(`${this.adminUrl}/procesos-selectivos/${procesoSelectivoId}/examenes`);
  }

  createExamen(procesoSelectivoId: string, request: ExamenCreate): Observable<Examen> {
    return this.http.post<Examen>(`${this.adminUrl}/procesos-selectivos/${procesoSelectivoId}/examenes`, request);
  }

  importExamenes(procesoSelectivoId: string, request: ExamenCreate[]): Observable<Examen[]> {
    return this.http.post<Examen[]>(`${this.adminUrl}/procesos-selectivos/${procesoSelectivoId}/examenes/importacion`, request);
  }

  patchExamen(id: string, request: ExamenPatch): Observable<Examen> {
    return this.http.patch<Examen>(`${this.adminUrl}/examenes/${id}`, request);
  }

  deleteExamen(id: string): Observable<void> {
    return this.http.delete<void>(`${this.adminUrl}/examenes/${id}`);
  }

  importDatosBase(fichero: File, anonimizarPersonas = true): Observable<ImportacionDatosBaseResultado> {
    const formData = new FormData();
    formData.append("fichero", fichero);
    const params = new HttpParams().set("anonimizarPersonas", anonimizarPersonas);
    return this.http.post<ImportacionDatosBaseResultado>(
      `${this.adminUrl}/importaciones/datos-base`,
      formData,
      { params },
    );
  }

  importProcesosSelectivosXlsx(fichero: File): Observable<ImportacionProcesosSelectivosResultado> {
    const formData = new FormData();
    formData.append("fichero", fichero);
    return this.http.post<ImportacionProcesosSelectivosResultado>(`${this.adminUrl}/importaciones/procesos-selectivos`, formData);
  }

  listAulas(examenId: string): Observable<ExamenAula[]> {
    return this.http.get<ExamenAula[]>(`${this.adminUrl}/examenes/${examenId}/aulas`);
  }

  listCentros(examenId: string): Observable<CentroExamen[]> {
    return this.http.get<CentroExamen[]>(`${this.adminUrl}/examenes/${examenId}/centros`);
  }

  listPerfilesColaboracion(): Observable<PerfilColaboracion[]> {
    return this.http.get<PerfilColaboracion[]>(`${this.adminUrl}/perfiles-colaboracion`);
  }

  listAsignaciones(examenId: string): Observable<AsignacionColaborador[]> {
    return this.http.get<AsignacionColaborador[]>(`${this.adminUrl}/examenes/${examenId}/asignaciones`);
  }

  createAsignacion(examenId: string, request: AsignacionColaboradorCreate): Observable<AsignacionColaborador> {
    return this.http.post<AsignacionColaborador>(`${this.adminUrl}/examenes/${examenId}/asignaciones`, request);
  }

  getAsignacion(asignacionId: string): Observable<AsignacionColaborador> {
    return this.http.get<AsignacionColaborador>(`${this.adminUrl}/asignaciones/${asignacionId}`);
  }

  patchAsignacion(asignacionId: string, request: AsignacionColaboradorPatch): Observable<AsignacionColaborador> {
    return this.http.patch<AsignacionColaborador>(`${this.adminUrl}/asignaciones/${asignacionId}`, request);
  }

  getImporteAsignacion(asignacionId: string): Observable<ImporteAsignacion> {
    return this.http.get<ImporteAsignacion>(`${this.adminUrl}/asignaciones/${asignacionId}/importe`);
  }

  getResumenColaboraciones(examenId: string): Observable<ResumenColaboraciones> {
    return this.http.get<ResumenColaboraciones>(`${this.adminUrl}/examenes/${examenId}/resumen-colaboraciones`);
  }

  getHojasFirma(examenId: string): Observable<HojasFirma> {
    return this.http.get<HojasFirma>(`${this.adminUrl}/examenes/${examenId}/hojas-firma`);
  }

  getPagos(examenId: string): Observable<PagosColaboradores> {
    return this.http.get<PagosColaboradores>(`${this.adminUrl}/examenes/${examenId}/pagos`);
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
