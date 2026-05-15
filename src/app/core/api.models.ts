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
  nombreCompleto: string;
  email: string;
  telefono?: string;
  provincia: string;
  localidad: string;
  rolesPreferidos: string[];
  disponibilidad: Disponibilidad[];
  estado: string;
  createdAt?: string;
  updatedAt?: string;
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

export interface Examen {
  id: string;
  procesoSelectivoId: string;
  nombre: string;
  fechaHora: string;
  numeroEjercicio: number;
  observaciones?: string;
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

export interface ApiError {
  code?: string;
  message?: string;
  status?: number;
  details?: string[];
}
