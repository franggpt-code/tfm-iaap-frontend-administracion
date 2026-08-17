import { DatePipe } from "@angular/common";
import { Component, inject, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { finalize, forkJoin } from "rxjs";
import { AdminApiService } from "../../../core/admin-api.service";
import {
  CentroExamen,
  Cuerpo,
  Examen,
  ExamenAula,
  ExamenCreate,
  Oep,
  ProcesoSelectivo,
  ProcesoSelectivoCreate,
  TipoAcceso,
  TipoVinculacion,
} from "../../../core/api.models";
import {
  errorMessage,
  formatProcesoCuerpo,
  formatProcesoOeps,
  formatProcesoTipoAcceso,
  formatProcesoTipoVinculacion,
} from "../shared/admin-ui";

@Component({
  selector: "app-procesos",
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: "./procesos.component.html",
  styleUrl: "../admin-pages.scss",
})
export class ProcesosComponent {
  private readonly api = inject(AdminApiService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly loadingDetail = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly procesos = signal<ProcesoSelectivo[]>([]);
  readonly selectedProceso = signal<ProcesoSelectivo | null>(null);
  readonly selectedExamen = signal<Examen | null>(null);
  readonly examenes = signal<Examen[]>([]);
  readonly centros = signal<CentroExamen[]>([]);
  readonly aulas = signal<ExamenAula[]>([]);
  readonly procesoEditorOpen = signal(false);
  readonly examenEditorOpen = signal(false);
  readonly editingProcesoId = signal<string | null>(null);
  readonly editingExamenId = signal<string | null>(null);
  readonly availableOeps = signal<Oep[]>([]);
  readonly tiposAcceso = signal<TipoAcceso[]>([]);
  readonly tiposVinculacion = signal<TipoVinculacion[]>([]);
  readonly cuerpos = signal<Cuerpo[]>([]);

  readonly procesoForm = this.fb.group({
    nombre: ["", Validators.required],
    oepIds: [[] as number[]],
    idTipoAcceso: [null as number | null],
    idCuerpo: [null as number | null],
    codigoSirhus: [""],
    urlWebProceso: [""],
    idTipoVinculacion: [null as number | null],
    estado: ["BORRADOR"],
  });

  readonly examenForm = this.fb.nonNullable.group({
    nombre: ["", Validators.required],
    fechaHora: ["", Validators.required],
    numeroEjercicio: [1, [Validators.required, Validators.min(1)]],
    observaciones: [""],
  });

  constructor() {
    this.loadCatalogos();
    this.loadProcesos();
  }

  loadCatalogos(): void {
    forkJoin({
      oeps: this.api.listOep(),
      tiposAcceso: this.api.listTiposAcceso(),
      tiposVinculacion: this.api.listTiposVinculacion(),
      cuerpos: this.api.listCuerpos(),
    }).subscribe({
      next: ({ oeps, tiposAcceso, tiposVinculacion, cuerpos }) => {
        this.availableOeps.set(oeps);
        this.tiposAcceso.set(tiposAcceso);
        this.tiposVinculacion.set(tiposVinculacion);
        this.cuerpos.set(cuerpos);
      },
      error: (error) => this.error.set(errorMessage(error, "No se han podido cargar los datos maestros.")),
    });
  }

  loadProcesos(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .listProcesosSelectivos(0, 25)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (page) => {
          this.procesos.set(page.content);
          const selectedId = this.selectedProceso()?.id;
          const first = page.content.find((proceso) => proceso.id === selectedId) ?? page.content.at(0) ?? null;
          if (first) {
            this.selectProceso(first);
          } else {
            this.selectedProceso.set(null);
            this.examenes.set([]);
            this.selectedExamen.set(null);
            this.centros.set([]);
            this.aulas.set([]);
          }
        },
        error: (error) => this.error.set(errorMessage(error, "No se han podido cargar los procesos selectivos.")),
      });
  }

  selectProceso(proceso: ProcesoSelectivo): void {
    this.selectedProceso.set(proceso);
    this.selectedExamen.set(null);
    this.examenes.set([]);
    this.centros.set([]);
    this.aulas.set([]);
    this.loadingDetail.set(true);
    this.api
      .listExamenes(proceso.id)
      .pipe(finalize(() => this.loadingDetail.set(false)))
      .subscribe({
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
    this.loadingDetail.set(true);
    this.error.set(null);
    this.api
      .listCentros(examen.id)
      .pipe(finalize(() => this.loadingDetail.set(false)))
      .subscribe({
        next: (centros) => {
          this.centros.set(centros);
          this.aulas.set(centros.flatMap((centro) => centro.aulas));
        },
        error: () => {
          this.centros.set([]);
          this.api.listAulas(examen.id).subscribe({
            next: (aulas) => this.aulas.set(aulas),
            error: (error) => this.error.set(errorMessage(error, "No se han podido cargar centros y aulas del examen.")),
          });
        },
      });
  }

  newProceso(): void {
    this.editingProcesoId.set(null);
    this.procesoForm.reset({
      nombre: "",
      oepIds: [],
      idTipoAcceso: null,
      idCuerpo: null,
      codigoSirhus: "",
      urlWebProceso: "",
      idTipoVinculacion: null,
      estado: "BORRADOR",
    });
    this.procesoEditorOpen.set(true);
  }

  editProceso(proceso: ProcesoSelectivo): void {
    this.editingProcesoId.set(proceso.id);
    this.procesoForm.setValue({
      nombre: proceso.nombre,
      oepIds: proceso.oeps?.map((oep) => oep.idOep) ?? [],
      idTipoAcceso: proceso.tipoAcceso?.idTipoAcceso ?? null,
      idCuerpo: proceso.cuerpo?.idCuerpo ?? null,
      codigoSirhus: proceso.codigoSirhus ?? "",
      urlWebProceso: proceso.urlWebProceso ?? "",
      idTipoVinculacion: proceso.tipoVinculacion?.idTipoVinculacion ?? null,
      estado: proceso.estado,
    });
    this.procesoEditorOpen.set(true);
  }

  saveProceso(): void {
    if (this.procesoForm.invalid) {
      this.procesoForm.markAllAsTouched();
      return;
    }
    const id = this.editingProcesoId();
    const value = this.procesoForm.getRawValue();
    const request: ProcesoSelectivoCreate = {
      nombre: value.nombre ?? "",
      oepIds: value.oepIds ?? [],
      idTipoAcceso: value.idTipoAcceso,
      idCuerpo: value.idCuerpo,
      codigoSirhus: value.codigoSirhus ?? "",
      urlWebProceso: value.urlWebProceso ?? "",
      idTipoVinculacion: value.idTipoVinculacion,
    };
    const operation = id ? this.api.patchProcesoSelectivo(id, { ...request, estado: value.estado ?? undefined }) : this.api.createProcesoSelectivo(request);
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    operation.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (proceso) => {
        this.success.set(id ? "Proceso selectivo actualizado correctamente." : "Proceso selectivo creado correctamente.");
        this.procesoEditorOpen.set(false);
        this.selectedProceso.set(proceso);
        this.loadProcesos();
      },
      error: (error) => this.error.set(errorMessage(error, "No se ha podido guardar el proceso selectivo.")),
    });
  }

  deleteProceso(proceso: ProcesoSelectivo): void {
    const confirmed = window.confirm(`Eliminar el proceso ${proceso.nombre}?`);
    if (!confirmed) {
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.api
      .deleteProcesoSelectivo(proceso.id)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.success.set("Proceso selectivo eliminado correctamente.");
          this.loadProcesos();
        },
        error: (error) => this.error.set(errorMessage(error, "No se ha podido eliminar el proceso selectivo.")),
    });
  }

  formatOeps(proceso: ProcesoSelectivo | null | undefined): string {
    return formatProcesoOeps(proceso);
  }

  formatTipoAcceso(proceso: ProcesoSelectivo | null | undefined): string {
    return formatProcesoTipoAcceso(proceso);
  }

  formatCuerpo(proceso: ProcesoSelectivo | null | undefined): string {
    return formatProcesoCuerpo(proceso);
  }

  formatTipoVinculacion(proceso: ProcesoSelectivo | null | undefined): string {
    return formatProcesoTipoVinculacion(proceso);
  }

  isOepSelected(idOep: number): boolean {
    return (this.procesoForm.controls.oepIds.value ?? []).includes(idOep);
  }

  toggleOep(idOep: number, checked: boolean): void {
    const current = this.procesoForm.controls.oepIds.value ?? [];
    const next = checked
      ? Array.from(new Set([...current, idOep])).sort((a, b) => a - b)
      : current.filter((id) => id !== idOep);
    this.procesoForm.controls.oepIds.setValue(next);
    this.procesoForm.controls.oepIds.markAsDirty();
  }

  importProcesosJson(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    file.text().then((content) => {
      const parsed = JSON.parse(content) as ProcesoSelectivoCreate | ProcesoSelectivoCreate[];
      const items = Array.isArray(parsed) ? parsed : [parsed];
      this.saving.set(true);
      this.error.set(null);
      this.success.set(null);
      this.api
        .importProcesosSelectivos(items)
        .pipe(finalize(() => {
          this.saving.set(false);
          input.value = "";
        }))
        .subscribe({
          next: () => {
            this.success.set(`${items.length} procesos importados correctamente.`);
            this.loadProcesos();
          },
          error: (error) => this.error.set(errorMessage(error, "No se ha podido importar el fichero JSON.")),
        });
    }).catch(() => this.error.set("No se ha podido leer el fichero JSON."));
  }

  importExamenesJson(event: Event): void {
    const proceso = this.selectedProceso();
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !proceso) {
      if (!proceso) {
        this.error.set("Selecciona un proceso antes de importar exámenes.");
      }
      return;
    }
    file.text().then((content) => {
      const parsed = JSON.parse(content) as ExamenCreate | ExamenCreate[];
      const items = Array.isArray(parsed) ? parsed : [parsed];
      this.saving.set(true);
      this.error.set(null);
      this.success.set(null);
      this.api
        .importExamenes(proceso.id, items)
        .pipe(finalize(() => {
          this.saving.set(false);
          input.value = "";
        }))
        .subscribe({
          next: () => {
            this.success.set(`${items.length} exámenes importados correctamente.`);
            this.selectProceso(proceso);
          },
          error: (error) => this.error.set(errorMessage(error, "No se ha podido importar el fichero JSON.")),
        });
    }).catch(() => this.error.set("No se ha podido leer el fichero JSON."));
  }

  newExamen(): void {
    const proceso = this.selectedProceso();
    if (!proceso) {
      this.error.set("Selecciona un proceso antes de crear un examen.");
      return;
    }
    this.editingExamenId.set(null);
    this.examenForm.reset({
      nombre: "",
      fechaHora: "",
      numeroEjercicio: this.examenes().length + 1,
      observaciones: "",
    });
    this.examenEditorOpen.set(true);
  }

  editExamen(examen: Examen): void {
    this.editingExamenId.set(examen.id);
    this.examenForm.setValue({
      nombre: examen.nombre,
      fechaHora: this.toLocalDateTime(examen.fechaHora),
      numeroEjercicio: examen.numeroEjercicio,
      observaciones: examen.observaciones ?? "",
    });
    this.examenEditorOpen.set(true);
  }

  saveExamen(): void {
    const proceso = this.selectedProceso();
    if (!proceso) {
      this.error.set("Selecciona un proceso antes de guardar un examen.");
      return;
    }
    if (this.examenForm.invalid) {
      this.examenForm.markAllAsTouched();
      return;
    }
    const id = this.editingExamenId();
    const request = this.toExamenRequest();
    const operation = id ? this.api.patchExamen(id, request) : this.api.createExamen(proceso.id, request);
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    operation.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (examen) => {
        this.success.set(id ? "Examen actualizado correctamente." : "Examen creado correctamente.");
        this.examenEditorOpen.set(false);
        this.selectProceso(proceso);
        this.selectedExamen.set(examen);
      },
      error: (error) => this.error.set(errorMessage(error, "No se ha podido guardar el examen.")),
    });
  }

  deleteExamen(examen: Examen): void {
    const proceso = this.selectedProceso();
    const confirmed = window.confirm(`Eliminar el examen ${examen.nombre}?`);
    if (!confirmed || !proceso) {
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.api
      .deleteExamen(examen.id)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.success.set("Examen eliminado correctamente.");
          this.examenEditorOpen.set(false);
          this.selectProceso(proceso);
        },
        error: (error) => this.error.set(errorMessage(error, "No se ha podido eliminar el examen.")),
      });
  }

  private toExamenRequest(): ExamenCreate {
    const value = this.examenForm.getRawValue();
    return {
      nombre: value.nombre,
      fechaHora: new Date(value.fechaHora).toISOString(),
      numeroEjercicio: Number(value.numeroEjercicio),
      observaciones: value.observaciones,
    };
  }

  private toLocalDateTime(value: string): string {
    const date = new Date(value);
    const timezoneOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
  }
}
