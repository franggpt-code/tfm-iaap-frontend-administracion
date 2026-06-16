import { ApiError, ProcesoSelectivo } from "../../../core/api.models";

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

export function formatProcesoOeps(proceso: ProcesoSelectivo | null | undefined): string {
  const oeps = proceso?.oeps ?? [];
  if (!oeps.length) {
    return "-";
  }
  return oeps
    .map((oep) => oep.descripcion || `OEP ${oep.anio}`)
    .join(", ");
}

export function formatProcesoTipoAcceso(proceso: ProcesoSelectivo | null | undefined): string {
  return proceso?.tipoAcceso?.descripcion || proceso?.tipoAcceso?.codigo || "-";
}

export function formatProcesoTipoVinculacion(proceso: ProcesoSelectivo | null | undefined): string {
  return proceso?.tipoVinculacion?.descripcion || proceso?.tipoVinculacion?.codigo || "-";
}

export function formatProcesoCuerpo(proceso: ProcesoSelectivo | null | undefined): string {
  if (!proceso?.cuerpo) {
    return "-";
  }
  return `${proceso.cuerpo.codigo} · ${proceso.cuerpo.descripcion}`;
}
