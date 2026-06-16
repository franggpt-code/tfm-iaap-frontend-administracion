import { DatePipe } from "@angular/common";
import { Component, computed, inject, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { finalize, forkJoin } from "rxjs";
import { AdminApiService } from "../../../core/admin-api.service";
import {
  AsignacionColaborador,
  Colaborador,
  Examen,
  ExamenAula,
  ImporteAsignacion,
  PerfilColaboracion,
  ProcesoSelectivo,
} from "../../../core/api.models";
import { conflictMessage, errorMessage, formatMoney, formatProcesoCuerpo, formatProcesoOeps } from "../shared/admin-ui";

@Component({
  selector: "app-asignaciones",
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: "./asignaciones.component.html",
  styleUrl: "../admin-pages.scss",
})
export class AsignacionesComponent {
  private readonly api = inject(AdminApiService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly procesos = signal<ProcesoSelectivo[]>([]);
  readonly examenes = signal<Examen[]>([]);
  readonly aulas = signal<ExamenAula[]>([]);
  readonly colaboradores = signal<Colaborador[]>([]);
  readonly perfiles = signal<PerfilColaboracion[]>([]);
  readonly asignaciones = signal<AsignacionColaborador[]>([]);
  readonly selectedProceso = signal<ProcesoSelectivo | null>(null);
  readonly selectedExamen = signal<Examen | null>(null);
  readonly importes = signal<Record<string, ImporteAsignacion>>({});
  readonly money = formatMoney;
  readonly formatOeps = formatProcesoOeps;
  readonly formatCuerpo = formatProcesoCuerpo;

  readonly createForm = this.fb.nonNullable.group({
    examenAulaId: ["", Validators.required],
    colaboradorId: ["", Validators.required],
    perfilId: ["", Validators.required],
    horasRealizadas: [null as number | null],
  });

  readonly horasForm = this.fb.nonNullable.group({
    asignacionId: ["", Validators.required],
    horasRealizadas: [null as number | null, [Validators.min(0)]],
  });

  readonly selectedPerfil = computed(() => {
    const perfilId = this.createForm.controls.perfilId.value;
    return this.perfiles().find((perfil) => perfil.id === perfilId) ?? null;
  });

  constructor() {
    this.loadInitialData();
  }

  loadInitialData(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      procesos: this.api.listProcesosSelectivos(0, 50),
      colaboradores: this.api.listColaboradores({ page: 0, size: 100 }),
      perfiles: this.api.listPerfilesColaboracion(),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ procesos, colaboradores, perfiles }) => {
          this.procesos.set(procesos.content);
          this.colaboradores.set(colaboradores.content);
          this.perfiles.set(perfiles);
          const first = procesos.content.at(0) ?? null;
          if (first) {
            this.selectProceso(first);
          }
        },
        error: (error) => this.error.set(errorMessage(error, "No se han podido cargar los datos base de asignaciones.")),
      });
  }

  selectProceso(proceso: ProcesoSelectivo): void {
    this.selectedProceso.set(proceso);
    this.selectedExamen.set(null);
    this.examenes.set([]);
    this.aulas.set([]);
    this.asignaciones.set([]);
    this.api.listExamenes(proceso.id).subscribe({
      next: (examenes) => {
        this.examenes.set(examenes);
        const first = examenes.at(0) ?? null;
        if (first) {
          this.selectExamen(first);
        }
      },
      error: (error) => this.error.set(errorMessage(error, "No se han podido cargar los exámenes del proceso.")),
    });
  }

  selectExamen(examen: Examen): void {
    this.selectedExamen.set(examen);
    this.createForm.reset();
    this.horasForm.reset();
    this.loadExamData();
  }

  loadExamData(): void {
    const examen = this.selectedExamen();
    if (!examen) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      aulas: this.api.listAulas(examen.id),
      asignaciones: this.api.listAsignaciones(examen.id),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ aulas, asignaciones }) => {
          this.aulas.set(aulas);
          this.asignaciones.set(asignaciones);
        },
        error: (error) => this.error.set(errorMessage(error, "No se han podido cargar las asignaciones del examen.")),
      });
  }

  createAsignacion(): void {
    const examen = this.selectedExamen();
    if (!examen || this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.api
      .createAsignacion(examen.id, this.createForm.getRawValue())
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.success.set("Asignación creada correctamente.");
          this.createForm.reset();
          this.loadExamData();
        },
        error: (error) => this.error.set(conflictMessage(error, "No se ha podido crear la asignación.")),
      });
  }

  selectAsignacion(asignacion: AsignacionColaborador): void {
    this.horasForm.setValue({
      asignacionId: asignacion.id,
      horasRealizadas: asignacion.horasRealizadas ?? null,
    });
  }

  saveHoras(): void {
    if (this.horasForm.invalid) {
      this.horasForm.markAllAsTouched();
      return;
    }
    const { asignacionId, horasRealizadas } = this.horasForm.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.api
      .patchAsignacion(asignacionId, { horasRealizadas })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (asignacion) => {
          this.success.set("Horas registradas correctamente.");
          this.asignaciones.update((items) => items.map((item) => (item.id === asignacion.id ? asignacion : item)));
          this.loadImporte(asignacion.id);
        },
        error: (error) => this.error.set(errorMessage(error, "No se han podido registrar las horas.")),
      });
  }

  loadImporte(asignacionId: string): void {
    this.api.getImporteAsignacion(asignacionId).subscribe({
      next: (importe) => this.importes.update((values) => ({ ...values, [asignacionId]: importe })),
      error: (error) => this.error.set(errorMessage(error, "No se ha podido consultar el importe de la asignación.")),
    });
  }
}
