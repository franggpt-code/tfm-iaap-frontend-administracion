import type { components } from "./generated/sicol-api";

export type PaginaProcesosSelectivos = components["schemas"]["PaginaProcesosSelectivos"];
export type ProcesoSelectivo = components["schemas"]["ProcesoSelectivo"];
export type ProcesoSelectivoCreate = components["schemas"]["ProcesoSelectivoCreate"];
export type ProcesoSelectivoPatch = components["schemas"]["ProcesoSelectivoPatch"];
export type Examen = components["schemas"]["Examen"];
export type ExamenCreate = components["schemas"]["ExamenCreate"];
export type ExamenPatch = components["schemas"]["ExamenPatch"];
export type PersonaOpositora = components["schemas"]["PersonaOpositora"];
export type ConvocadoExamen = components["schemas"]["ConvocadoExamen"];
export type EstadoAsistencia = components["schemas"]["EstadoAsistenciaConvocado"];
export type AsistenciaUpdate = components["schemas"]["AsistenciaConvocadoUpdate"];
export type Provincia = components["schemas"]["Provincia"];
export type Centro = components["schemas"]["Centro"];
export type Aula = components["schemas"]["Aula"];
export type ImportacionResultado = components["schemas"]["ImportacionOpositoresAulasResultado"];
export type ImportacionAviso = components["schemas"]["ImportacionOpositoresAulasAviso"];
export type ApiError = components["schemas"]["Error"];
export type LoginRequest = components["schemas"]["LoginRequest"];
export type LoginResponse = components["schemas"]["LoginResponse"];
export type AuthenticatedUser = components["schemas"]["AuthenticatedUser"];
export type Oep = components["schemas"]["Oep"];
export type OepCreateUpdate = components["schemas"]["OepCreateUpdate"];
export type TipoAcceso = components["schemas"]["TipoAcceso"];
export type TipoAccesoCreateUpdate = components["schemas"]["TipoAccesoCreateUpdate"];
export type TipoVinculacion = components["schemas"]["TipoVinculacion"];
export type TipoVinculacionCreateUpdate = components["schemas"]["TipoVinculacionCreateUpdate"];
export type Cuerpo = components["schemas"]["Cuerpo"];
export type CuerpoCreateUpdate = components["schemas"]["CuerpoCreateUpdate"];
export type ImportacionProcesosResultado = components["schemas"]["ImportacionProcesosSelectivosResultado"];
export type ImportacionDatamartResultado = components["schemas"]["ImportacionDatamartConvocatoriasResultado"];
export type ImportacionDatamartAviso = components["schemas"]["ImportacionDatamartConvocatoriasAviso"];

export interface ImportacionArchivos {
  procesoSelectivoId: string;
  examenId: string;
  ficheroSirhus: File;
  ficheroCaronte?: File | null;
}
