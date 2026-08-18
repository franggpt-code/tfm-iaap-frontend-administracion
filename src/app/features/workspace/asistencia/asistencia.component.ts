import { Component, inject, OnInit, signal } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { finalize } from "rxjs";
import { apiErrorMessage } from "../../../api/api-error";
import { SicolApiClient } from "../../../api/sicol-api-client.service";
import { ConvocadoExamen, EstadoAsistencia } from "../../../api/sicol.types";

@Component({
  selector: "app-asistencia",
  imports: [RouterLink],
  templateUrl: "./asistencia.component.html",
  styleUrl: "./asistencia.component.scss",
})
export class AsistenciaComponent implements OnInit {
  private readonly api = inject(SicolApiClient);
  private readonly route = inject(ActivatedRoute);
  readonly examenAulaId = this.route.snapshot.paramMap.get("examenAulaId") ?? "";
  readonly asignacionId = this.route.snapshot.paramMap.get("asignacionId") ?? "";
  readonly portalResponsable = Boolean(this.asignacionId);
  readonly items = signal<ConvocadoExamen[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly pending = signal(new Set<string>());
  readonly observations = signal<Record<string, string>>({});
  readonly rowErrors = signal<Record<string, string>>({});

  ngOnInit(): void {
    const request = this.portalResponsable
      ? this.api.listMisConvocadosAulaResponsable(this.asignacionId)
      : this.api.listConvocadosByAula(this.examenAulaId);
    request.pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (items) => {
        this.items.set(items);
        this.observations.set(Object.fromEntries(items.map((item) => [item.id, item.asistenciaObservaciones ?? ""])));
      },
      error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
  }

  setObservation(id: string, value: string): void {
    this.observations.update((current) => ({ ...current, [id]: value }));
  }

  update(item: ConvocadoExamen, estado: EstadoAsistencia): void {
    if (this.pending().has(item.id)) return;
    const previous = item;
    const optimistic = { ...item, estadoAsistencia: estado, asistenciaObservaciones: this.observations()[item.id] || undefined };
    this.items.update((items) => items.map((candidate) => candidate.id === item.id ? optimistic : candidate));
    this.pending.update((current) => new Set(current).add(item.id));
    this.rowErrors.update((current) => ({ ...current, [item.id]: "" }));

    const request = this.portalResponsable
      ? this.api.updateAsistenciaMiAulaResponsable(this.asignacionId, item.id, { estado })
      : this.api.updateAsistencia(item.id, { estado, observaciones: this.observations()[item.id] || undefined });
    request
      .pipe(finalize(() => this.pending.update((current) => { const next = new Set(current); next.delete(item.id); return next; })))
      .subscribe({
        next: (updated) => this.items.update((items) => items.map((candidate) => candidate.id === item.id ? updated : candidate)),
        error: (error: unknown) => {
          this.items.update((items) => items.map((candidate) => candidate.id === item.id ? previous : candidate));
          this.rowErrors.update((current) => ({ ...current, [item.id]: apiErrorMessage(error) }));
        },
      });
  }

  formatAudit(value?: string): string {
    return value ? new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "Sin registro";
  }
}
