import { DatePipe, DecimalPipe } from "@angular/common";
import { Component, computed, inject, OnInit, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { finalize, forkJoin } from "rxjs";
import { apiErrorMessage } from "../../api/api-error";
import { SicolApiClient } from "../../api/sicol-api-client.service";
import { AsignacionColaborador, Colaborador, ColaboradorPortalPatch, EstadoConfirmacionAsignacion } from "../../api/sicol.types";

type MiEspacioSection = "datos" | "proximas" | "historico";

@Component({
  selector: "app-mi-espacio",
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule, RouterLink],
  templateUrl: "./mi-espacio.component.html",
  styleUrl: "./mi-espacio.component.scss",
})
export class MiEspacioComponent implements OnInit {
  private readonly api = inject(SicolApiClient);
  private readonly fb = inject(FormBuilder);

  readonly perfil = signal<Colaborador | null>(null);
  readonly asignaciones = signal<AsignacionColaborador[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly pending = signal(new Set<string>());
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly activeSection = signal<MiEspacioSection>("proximas");
  readonly proximasAsignaciones = computed(() => this.asignaciones()
    .filter((item) => !item.fechaHora || new Date(item.fechaHora).getTime() >= Date.now())
    .sort((a, b) => this.assignmentTime(a) - this.assignmentTime(b)));
  readonly asignacionesHistoricas = computed(() => this.asignaciones()
    .filter((item) => item.fechaHora && new Date(item.fechaHora).getTime() < Date.now())
    .sort((a, b) => this.assignmentTime(b) - this.assignmentTime(a)));

  readonly form = this.fb.nonNullable.group({
    sexo: ["NO_INFORMA"],
    iban: ["", Validators.maxLength(34)],
    telefono: ["", Validators.maxLength(50)],
    correoCorporativo: ["", [Validators.required, Validators.email]],
    provincia: [""],
    localidad: [""],
    observaciones: [""],
    disponibleDesde: [""],
    disponibleHasta: [""],
  });

  ngOnInit(): void {
    forkJoin({ perfil: this.api.getMiPerfil(), asignaciones: this.api.listMisAsignaciones() })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ perfil, asignaciones }) => {
          this.perfil.set(perfil);
          this.asignaciones.set(asignaciones);
          const availability = perfil.disponibilidad?.[0];
          this.form.setValue({
            sexo: perfil.sexo,
            iban: perfil.iban ?? "",
            telefono: perfil.telefono ?? "",
            correoCorporativo: perfil.correoCorporativo,
            provincia: perfil.provincia ?? "",
            localidad: perfil.localidad ?? "",
            observaciones: perfil.observaciones ?? "",
            disponibleDesde: availability?.desde ?? "",
            disponibleHasta: availability?.hasta ?? "",
          });
        },
        error: error => this.error.set(apiErrorMessage(error)),
      });
  }

  saveProfile(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    const value = this.form.getRawValue();
    if ((value.disponibleDesde && !value.disponibleHasta) || (!value.disponibleDesde && value.disponibleHasta)) {
      this.error.set("Indica las dos fechas de disponibilidad o deja ambas vacías.");
      return;
    }
    if (value.disponibleDesde && value.disponibleHasta && value.disponibleHasta < value.disponibleDesde) {
      this.error.set("La fecha final de disponibilidad no puede ser anterior a la inicial.");
      return;
    }
    const payload: ColaboradorPortalPatch = {
      sexo: value.sexo as Colaborador["sexo"],
      iban: value.iban.trim(),
      telefono: value.telefono.trim(),
      correoCorporativo: value.correoCorporativo.trim(),
      provincia: value.provincia.trim(),
      localidad: value.localidad.trim(),
      observaciones: value.observaciones.trim(),
      disponibilidad: value.disponibleDesde && value.disponibleHasta
        ? [{ desde: value.disponibleDesde, hasta: value.disponibleHasta }]
        : [],
    };
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.api.updateMiPerfil(payload).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: profile => {
        this.perfil.set(profile);
        this.success.set("Tus datos se han guardado correctamente.");
      },
      error: error => this.error.set(apiErrorMessage(error)),
    });
  }

  updateConfirmation(assignment: AsignacionColaborador, state: Exclude<EstadoConfirmacionAsignacion, "PENDIENTE">): void {
    const nextPending = new Set(this.pending());
    nextPending.add(assignment.id);
    this.pending.set(nextPending);
    this.error.set(null);
    this.success.set(null);
    this.api.updateMiConfirmacion(assignment.id, { estadoConfirmacion: state })
      .pipe(finalize(() => {
        const result = new Set(this.pending());
        result.delete(assignment.id);
        this.pending.set(result);
      }))
      .subscribe({
        next: updated => {
          this.asignaciones.update(items => items.map(item => item.id === updated.id ? updated : item));
          this.success.set(state === "CONFIRMADA" ? "Has confirmado tu asistencia." : "Has rechazado la asignación.");
        },
        error: error => this.error.set(apiErrorMessage(error)),
      });
  }

  scopeLabel(item: AsignacionColaborador): string {
    if (item.aulaNombre) return `${item.centroNombre ?? "Centro"} · ${item.aulaNombre}`;
    return item.subcategoriaGeneral ? `Ámbito general · ${item.subcategoriaGeneral}` : "Ámbito general";
  }

  isResponsableAula(item: AsignacionColaborador): boolean {
    return item.perfilCodigo === "RESPONSABLE_DE_AULA" && !!item.examenAulaId;
  }

  confirmationLabel(item: AsignacionColaborador): string {
    if (item.estadoConfirmacion === "CONFIRMADA") return "Asistencia confirmada";
    if (item.estadoConfirmacion === "RECHAZADA") return "Asignación rechazada";
    return "Pendiente de respuesta";
  }

  private assignmentTime(item: AsignacionColaborador): number {
    return item.fechaHora ? new Date(item.fechaHora).getTime() : Number.MAX_SAFE_INTEGER;
  }
}
