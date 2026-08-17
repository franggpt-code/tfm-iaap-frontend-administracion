import type { components } from "./generated/sicol-api";

export type PaginaProcesosSelectivos = components["schemas"]["PaginaProcesosSelectivos"];
export type ProcesoSelectivo = components["schemas"]["ProcesoSelectivo"];
export type Examen = components["schemas"]["Examen"];
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

export interface ImportacionArchivos {
  procesoSelectivoId: string;
  examenId: string;
  ficheroSirhus: File;
  ficheroCaronte?: File | null;
}
