export interface LoginRequest {
  usuario: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
  user: AuthenticatedUser;
}

export interface AuthenticatedUser {
  idUsuario: string;
  login: string;
  nombreCompleto: string;
  email: string;
  activo: boolean;
  roles: string[];
  permisos: string[];
  colaboradorId?: string;
}

export interface ApiPage<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface Colaborador {
  id: string;
  dni: string;
  letra: string;
  nombreCompleto: string;
  sexo: string;
  iban?: string;
  correoCorporativo: string;
  telefono?: string;
  observaciones?: string;
  perteneceCentroDirectivo: boolean;
  provincia: string;
  localidad: string;
  rolesPreferidos: string[];
  disponibilidad: Disponibilidad[];
  estado: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ColaboradorCreate {
  dni: string;
  letra: string;
  nombreCompleto: string;
  sexo: string;
  iban: string;
  correoCorporativo: string;
  telefono: string;
  observaciones?: string;
  perteneceCentroDirectivo: boolean;
  provincia?: string;
  localidad?: string;
  rolesPreferidos?: string[];
  disponibilidad?: Disponibilidad[];
}

export interface ColaboradorPatch {
  dni?: string;
  letra?: string;
  nombreCompleto?: string;
  sexo?: string;
  iban?: string;
  correoCorporativo?: string;
  telefono?: string;
  observaciones?: string;
  perteneceCentroDirectivo?: boolean;
  provincia?: string;
  localidad?: string;
  rolesPreferidos?: string[];
  disponibilidad?: Disponibilidad[];
  estado?: string;
}

export interface Disponibilidad {
  desde: string;
  hasta: string;
}

export interface ProcesoSelectivo {
  id: string;
  nombre: string;
  oep: string;
  acceso: string;
  cuerpo: string;
  modo: string;
  estado: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProcesoSelectivoCreate {
  nombre: string;
  oep?: string;
  acceso?: string;
  cuerpo?: string;
  modo?: string;
}

export interface ProcesoSelectivoPatch extends Partial<ProcesoSelectivoCreate> {
  estado?: string;
}

export interface Examen {
  id: string;
  procesoSelectivoId: string;
  nombre: string;
  fechaHora: string;
  numeroEjercicio: number;
  observaciones?: string;
}

export interface ExamenCreate {
  nombre: string;
  fechaHora: string;
  numeroEjercicio: number;
  observaciones?: string;
}

export type ExamenPatch = Partial<ExamenCreate>;

export interface ImportacionDatosBaseResultado {
  perfilesImportados: number;
  procesosDetectados: number;
  examenesImportados: number;
  aulasImportadas: number;
  colaboradoresImportados: number;
}

export interface ExamenAula {
  id: string;
  examenId: string;
  aulaId: string;
  aulaNombre: string;
  centroNombre?: string;
  provincia?: string;
  colaboradoresAsignados?: string[];
}

export interface PerfilColaboracion {
  id: string;
  codigo: string;
  denominacion: string;
  importeHora: number;
}

export interface CentroExamen {
  nombre: string;
  provincia?: string;
  aulas: ExamenAula[];
}

export interface AsignacionColaborador {
  id: string;
  examenId: string;
  examenAulaId: string;
  colaboradorId: string;
  colaboradorNombre?: string;
  colaboradorDocumento?: string;
  perfilId: string;
  perfilCodigo?: string;
  perfilDenominacion: string;
  centroNombre?: string;
  aulaNombre?: string;
  horasRealizadas?: number | null;
  importeHora: number;
  importeTotal?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AsignacionColaboradorCreate {
  examenAulaId: string;
  colaboradorId: string;
  perfilId: string;
  horasRealizadas?: number | null;
}

export interface AsignacionColaboradorPatch {
  examenAulaId?: string;
  perfilId?: string;
  horasRealizadas?: number | null;
}

export interface ImporteAsignacion {
  asignacionId: string;
  horasRealizadas?: number | null;
  importeHora: number;
  importeTotal?: number | null;
}

export interface ResumenColaboraciones {
  examenId: string;
  totalAsignaciones: number;
  totalHoras: number;
  totalImporte: number;
  duplicidades: DuplicidadColaborador[];
  lineas: ResumenColaboracionesLinea[];
}

export interface ResumenColaboracionesLinea {
  centroNombre: string;
  aulaNombre: string;
  perfilDenominacion: string;
  totalAsignaciones: number;
  totalHoras: number;
  totalImporte: number;
}

export interface DuplicidadColaborador {
  colaboradorId: string;
  nombreCompleto: string;
  numeroAsignaciones: number;
}

export interface HojasFirma {
  examenId: string;
  centros: HojaFirmaCentro[];
}

export interface HojaFirmaCentro {
  centroNombre: string;
  provincia?: string;
  aulas: HojaFirmaAula[];
}

export interface HojaFirmaAula {
  aulaNombre: string;
  colaboradores: HojaFirmaColaborador[];
}

export interface HojaFirmaColaborador {
  dni: string;
  nombreCompleto: string;
  perfilDenominacion: string;
  telefono?: string;
  sexo?: string;
  correoCorporativo?: string;
}

export interface PagosColaboradores {
  examenId: string;
  totalImporte: number;
  pagos: PagoColaborador[];
}

export interface PagoColaborador {
  dni: string;
  nombreCompleto: string;
  perfilDenominacion: string;
  iban?: string;
  horasRealizadas: number;
  importeHora: number;
  importeTotal: number;
  codigoPerfil?: string;
}

export interface ApiError {
  code?: string;
  message?: string;
  status?: number;
  details?: string[];
}
