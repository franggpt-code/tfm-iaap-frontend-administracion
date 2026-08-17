import { HttpErrorResponse } from "@angular/common/http";
import { ApiError } from "./sicol.types";

export function apiErrorMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return "Se ha producido un error inesperado. Inténtalo de nuevo.";
  }

  const body = error.error as Partial<ApiError> | null;
  const backendMessage = body && typeof body.message === "string" ? body.message : null;

  switch (error.status) {
    case 0:
      return "No se puede conectar con la API. Comprueba que el backend está iniciado.";
    case 400:
      return backendMessage ?? "Los datos enviados no son válidos. Revisa los campos y los ficheros.";
    case 401:
      return "La sesión ha caducado. Vuelve a identificarte.";
    case 403:
      return "No tienes permisos para realizar esta operación.";
    case 404:
      return backendMessage ?? "No se ha encontrado el recurso solicitado.";
    default:
      return backendMessage ?? "La operación no ha podido completarse. Inténtalo de nuevo.";
  }
}
