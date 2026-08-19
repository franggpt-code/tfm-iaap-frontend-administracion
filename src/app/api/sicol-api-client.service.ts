import { HttpClient, HttpResponse } from "@angular/common/http";
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
  Colaborador,
  ColaboradorCreate,
  ColaboradorPatch,
  PaginaColaboradores,
  EstadoColaborador,
  CambioEstadoColaboradores,
  PerfilColaboracion,
  PerfilColaboracionCreateUpdate,
  ImportacionColaboradoresResultado,
  AsignacionColaborador,
  AsignacionColaboradorCreate,
  AsignacionColaboradorPatch,
  CambioHorasAsignaciones,
  ContextoAsignacion,
  ExamenAula,
  CentroExamen,
  ResumenColaboraciones,
  HojasFirma,
  PagosColaboradores,
  ConfiguracionInformes,
  ConfiguracionInformesUpdate,
  UsuarioAdmin,
  UsuarioAdminCreateUpdate,
  ColaboradorPortalPatch,
  ConfirmacionAsignacionPortalUpdate,
  CuadroMandoAdministracion,
} from "./sicol.types";

@Injectable({ providedIn: "root" })
export class SicolApiClient {
  private readonly http = inject(HttpClient);
  private readonly adminUrl = `${environment.apiBaseUrl}/admin`;
  private readonly portalUrl = `${environment.apiBaseUrl}/portal`;

  listUsuarios(): Observable<UsuarioAdmin[]> {
    return this.http.get<UsuarioAdmin[]>(`${this.adminUrl}/usuarios`);
  }

  createUsuario(payload: UsuarioAdminCreateUpdate): Observable<UsuarioAdmin> {
    return this.http.post<UsuarioAdmin>(`${this.adminUrl}/usuarios`, payload);
  }

  updateUsuario(id: string, payload: UsuarioAdminCreateUpdate): Observable<UsuarioAdmin> {
    return this.http.put<UsuarioAdmin>(`${this.adminUrl}/usuarios/${id}`, payload);
  }

  deleteUsuario(id: string): Observable<void> {
    return this.http.delete<void>(`${this.adminUrl}/usuarios/${id}`);
  }

  getCuadroMandoAdministracion(): Observable<CuadroMandoAdministracion> {
    return this.http.get<CuadroMandoAdministracion>(`${this.adminUrl}/cuadro-mando`);
  }

  getMiPerfil(): Observable<Colaborador> {
    return this.http.get<Colaborador>(`${this.portalUrl}/mi-perfil`);
  }

  updateMiPerfil(payload: ColaboradorPortalPatch): Observable<Colaborador> {
    return this.http.patch<Colaborador>(`${this.portalUrl}/mi-perfil`, payload);
  }

  listMisAsignaciones(): Observable<AsignacionColaborador[]> {
    return this.http.get<AsignacionColaborador[]>(`${this.portalUrl}/mis-asignaciones`);
  }

  updateMiConfirmacion(id: string, payload: ConfirmacionAsignacionPortalUpdate): Observable<AsignacionColaborador> {
    return this.http.patch<AsignacionColaborador>(`${this.portalUrl}/mis-asignaciones/${id}/confirmacion`, payload);
  }

  listMisConvocadosAulaResponsable(asignacionId: string): Observable<ConvocadoExamen[]> {
    return this.http.get<ConvocadoExamen[]>(`${this.portalUrl}/mis-asignaciones/${asignacionId}/convocados`);
  }

  updateAsistenciaMiAulaResponsable(asignacionId: string, convocadoId: string, payload: AsistenciaUpdate): Observable<ConvocadoExamen> {
    return this.http.patch<ConvocadoExamen>(
      `${this.portalUrl}/mis-asignaciones/${asignacionId}/convocados/${convocadoId}/asistencia`,
      payload,
    );
  }

  listProcesos(page = 0, size = 100, search = ""): Observable<PaginaProcesosSelectivos> {
    const params: Record<string, string | number> = { page, size };
    if (search.trim()) params["search"] = search.trim();
    return this.http.get<PaginaProcesosSelectivos>(`${this.adminUrl}/procesos-selectivos`, {
      params,
    });
  }

  getProceso(id: string): Observable<ProcesoSelectivo> {
    return this.http.get<ProcesoSelectivo>(`${this.adminUrl}/procesos-selectivos/${id}`);
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

  listContextosAsignacion(fecha: string): Observable<ContextoAsignacion[]> {
    return this.http.get<ContextoAsignacion[]>(`${this.adminUrl}/asignaciones/contextos`, { params: { fecha } });
  }

  listExamenAulas(examenId: string): Observable<ExamenAula[]> {
    return this.http.get<ExamenAula[]>(`${this.adminUrl}/examenes/${examenId}/aulas`);
  }

  listCentrosByExamen(examenId: string): Observable<CentroExamen[]> {
    return this.http.get<CentroExamen[]>(`${this.adminUrl}/examenes/${examenId}/centros`);
  }

  listAsignaciones(examenId: string): Observable<AsignacionColaborador[]> {
    return this.http.get<AsignacionColaborador[]>(`${this.adminUrl}/examenes/${examenId}/asignaciones`);
  }

  createAsignacion(examenId: string, payload: AsignacionColaboradorCreate): Observable<AsignacionColaborador> {
    return this.http.post<AsignacionColaborador>(`${this.adminUrl}/examenes/${examenId}/asignaciones`, payload);
  }

  updateAsignacion(id: string, payload: AsignacionColaboradorPatch): Observable<AsignacionColaborador> {
    return this.http.patch<AsignacionColaborador>(`${this.adminUrl}/asignaciones/${id}`, payload);
  }

  updateAssignmentHours(payload: CambioHorasAsignaciones): Observable<void> {
    return this.http.patch<void>(`${this.adminUrl}/asignaciones/horas`, payload);
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

  exportHojasFirmaPdf(examenId: string): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.adminUrl}/examenes/${examenId}/hojas-firma.pdf`, {
      observe: "response",
      responseType: "blob",
    });
  }

  exportPagosPdf(examenId: string): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.adminUrl}/examenes/${examenId}/pagos.pdf`, {
      observe: "response",
      responseType: "blob",
    });
  }

  getConfiguracionInformes(): Observable<ConfiguracionInformes> {
    return this.http.get<ConfiguracionInformes>(`${this.adminUrl}/configuracion-informes`);
  }

  updateConfiguracionInformes(payload: ConfiguracionInformesUpdate): Observable<ConfiguracionInformes> {
    return this.http.put<ConfiguracionInformes>(`${this.adminUrl}/configuracion-informes`, payload);
  }

  deleteAsignacion(id: string): Observable<void> {
    return this.http.delete<void>(`${this.adminUrl}/asignaciones/${id}`);
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

  listPerfilesColaboracion(): Observable<PerfilColaboracion[]> {
    return this.http.get<PerfilColaboracion[]>(`${this.adminUrl}/perfiles-colaboracion`);
  }

  createPerfilColaboracion(payload: PerfilColaboracionCreateUpdate): Observable<PerfilColaboracion> {
    return this.http.post<PerfilColaboracion>(`${this.adminUrl}/perfiles-colaboracion`, payload);
  }

  updatePerfilColaboracion(id: string, payload: PerfilColaboracionCreateUpdate): Observable<PerfilColaboracion> {
    return this.http.put<PerfilColaboracion>(`${this.adminUrl}/perfiles-colaboracion/${id}`, payload);
  }

  deletePerfilColaboracion(id: string): Observable<void> {
    return this.http.delete<void>(`${this.adminUrl}/perfiles-colaboracion/${id}`);
  }

  listColaboradores(filters: {
    search?: string;
    provincia?: string;
    localidad?: string;
    rol?: string;
    estado?: EstadoColaborador | "";
    page?: number;
    size?: number;
  } = {}): Observable<PaginaColaboradores> {
    const params: Record<string, string | number> = { page: filters.page ?? 0, size: filters.size ?? 20 };
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== "" && key !== "page" && key !== "size") params[key] = value;
    }
    return this.http.get<PaginaColaboradores>(`${this.adminUrl}/colaboradores`, { params });
  }

  createColaborador(payload: ColaboradorCreate): Observable<Colaborador> {
    return this.http.post<Colaborador>(`${this.adminUrl}/colaboradores`, payload);
  }

  updateColaborador(id: string, payload: ColaboradorPatch): Observable<Colaborador> {
    return this.http.patch<Colaborador>(`${this.adminUrl}/colaboradores/${id}`, payload);
  }

  deleteColaborador(id: string): Observable<void> {
    return this.http.delete<void>(`${this.adminUrl}/colaboradores/${id}`);
  }

  cambiarEstadoColaboradores(payload: CambioEstadoColaboradores): Observable<void> {
    return this.http.patch<void>(`${this.adminUrl}/colaboradores/estado`, payload);
  }

  simularImportacionColaboradores(fichero: File): Observable<ImportacionColaboradoresResultado> {
    return this.http.post<ImportacionColaboradoresResultado>(
      `${this.adminUrl}/colaboradores/importacion-excel/simulacion`, this.toSingleFileFormData(fichero),
    );
  }

  confirmarImportacionColaboradores(fichero: File): Observable<ImportacionColaboradoresResultado> {
    return this.http.post<ImportacionColaboradoresResultado>(
      `${this.adminUrl}/colaboradores/importacion-excel`, this.toSingleFileFormData(fichero),
    );
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
