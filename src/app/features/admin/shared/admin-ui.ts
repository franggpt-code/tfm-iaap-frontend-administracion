import { ApiError } from "../../../core/api.models";

export function errorMessage(error: ApiError | unknown, fallback: string): string {
  const apiError = error as ApiError;
  return apiError?.message ?? fallback;
}

export function conflictMessage(error: ApiError | unknown, fallback: string): string {
  const apiError = error as ApiError;
  if (apiError?.status === 409) {
    return "El colaborador ya tiene una asignación en este examen. Revisa la asignación existente antes de crear otra.";
  }
  return apiError?.message ?? fallback;
}

export function formatMoney(value: number | null | undefined): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value ?? 0);
}
