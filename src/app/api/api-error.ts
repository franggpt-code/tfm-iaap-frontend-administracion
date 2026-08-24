import { HttpErrorResponse } from "@angular/common/http";
import { ApiError } from "./sicol.types";

export interface ImportErrorContext {
  label: string;
  value: string | null | undefined;
}

export interface ImportErrorDiagnostic {
  summary: string;
  technicalMessage: string | null;
  status: number | null;
  code: string | null;
  traceId: string | null;
  details: Array<{ field?: string; issue: string; rejectedValue?: string }>;
  operation: string;
  context: ImportErrorContext[];
  occurredAt: string;
}

export function apiErrorMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return "Se ha producido un error inesperado. Inténtalo de nuevo.";
  }

  const body = errorBody(error);
  const backendMessage = body?.message ?? null;

  switch (error.status) {
    case 0:
      return "No se puede conectar con la API. Comprueba que el backend esté iniciado.";
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

export function importErrorDiagnostic(
  error: unknown,
  operation: string,
  context: ImportErrorContext[] = [],
): ImportErrorDiagnostic {
  const httpError = error instanceof HttpErrorResponse ? error : null;
  const body = httpError ? errorBody(httpError) : null;
  return {
    summary: apiErrorMessage(error),
    technicalMessage: body?.message ?? null,
    status: httpError && httpError.status > 0 ? httpError.status : null,
    code: body?.code ?? null,
    traceId: body?.traceId ?? null,
    details: Array.isArray(body?.details) ? body.details.filter(isErrorDetail) : [],
    operation,
    context: context.filter((item) => !!item.value),
    occurredAt: new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "medium" }).format(new Date()),
  };
}

function errorBody(error: HttpErrorResponse): Partial<ApiError> | null {
  if (!error.error || typeof error.error !== "object" || Array.isArray(error.error)) return null;
  return error.error as Partial<ApiError>;
}

function isErrorDetail(value: unknown): value is { field?: string; issue: string; rejectedValue?: string } {
  return !!value && typeof value === "object" && typeof (value as { issue?: unknown }).issue === "string";
}