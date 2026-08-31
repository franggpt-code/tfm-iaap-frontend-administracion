import { Component, computed, ElementRef, inject, OnInit, signal, ViewChild } from "@angular/core";
import { FormsModule, NgForm } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { catchError, finalize, forkJoin, map, of } from "rxjs";
import { apiErrorMessage } from "../../../api/api-error";
import { SicolApiClient } from "../../../api/sicol-api-client.service";
import { Cuerpo, Examen, ExamenCreate, Oep, ProcesoSelectivo, ProcesoSelectivoCreate, TipoAcceso, TipoVinculacion } from "../../../api/sicol.types";
import { AuthService } from "../../../core/auth.service";

type FormMode = "create" | "edit";
type ProcessStatusFilter = "ACTIVOS" | "CERRADO" | "TODOS";

interface ProcessFormValue {
  nombre: string;
  codigoSirhus: string;
  urlWebProceso: string;
  estado: "BORRADOR" | "PUBLICADO" | "CERRADO";
  oepIds: number[];
  idTipoAcceso: number | null;
  idCuerpo: number | null;
  idTipoVinculacion: number | null;
}

interface ExamFormValue {
  nombre: string;
  numeroEjercicio: number;
  fechaHora: string;
  observaciones: string;
}

@Component({
  selector: "app-procesos-explorer",
  imports: [RouterLink, FormsModule],
  templateUrl: "./procesos-explorer.component.html",
  styleUrl: "./procesos-explorer.component.scss",
})
export class ProcesosExplorerComponent implements OnInit {
  private readonly api = inject(SicolApiClient);
  private readonly auth = inject(AuthService);

  @ViewChild("deleteExamDialog") private deleteExamDialog?: ElementRef<HTMLDialogElement>;

  readonly isAdmin = this.auth.isAdmin;
  readonly isGestor = this.auth.isManager;
  readonly canCreateProcess = this.auth.isAdmin;
  readonly canEditProcess = computed(() => this.auth.isAdmin() || this.auth.isManager());
  readonly canCreateExam = computed(() => this.auth.isAdmin() || this.auth.isManager());
  readonly canEditExam = computed(() => this.auth.isAdmin() || this.auth.isManager());
  readonly canDeleteExam = this.auth.isAdmin;

  readonly procesos = signal<ProcesoSelectivo[]>([]);
  readonly selected = signal<ProcesoSelectivo | null>(null);
  readonly examenes = signal<Examen[]>([]);
  readonly convocadosCount = signal<Record<string, number>>({});
  readonly oeps = signal<Oep[]>([]);
  readonly accesos = signal<TipoAcceso[]>([]);
  readonly vinculaciones = signal<TipoVinculacion[]>([]);
  readonly cuerpos = signal<Cuerpo[]>([]);
  readonly loading = signal(true);
  readonly loadingExamenes = signal(false);
  readonly saving = signal(false);
  readonly deletingExam = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly search = signal("");
  readonly statusFilter = signal<ProcessStatusFilter>("ACTIVOS");
  readonly processFormOpen = signal(false);
  readonly processFormMode = signal<FormMode>("create");
  readonly processDrawerExpanded = signal(false);
  readonly examFormOpen = signal(false);
  readonly examFormMode = signal<FormMode>("create");
  readonly examDrawerExpanded = signal(false);
  readonly editingExamId = signal<string | null>(null);
  readonly deleteExamTarget = signal<Examen | null>(null);

  processForm: ProcessFormValue = this.emptyProcessForm();
  examForm: ExamFormValue = this.emptyExamForm();

  ngOnInit(): void {
    if (!this.canCreateProcess()) {
      this.api.listProcesos().pipe(finalize(() => this.loading.set(false))).subscribe({
        next: (procesos) => this.procesos.set(procesos.content),
        error: (error: unknown) => this.error.set(apiErrorMessage(error)),
      });
      return;
    }

    forkJoin({
      procesos: this.api.listProcesos(),
      oeps: this.api.listOep(),
      accesos: this.api.listTiposAcceso(),
      vinculaciones: this.api.listTiposVinculacion(),
      cuerpos: this.api.listCuerpos(),
    }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: ({ procesos, oeps, accesos, vinculaciones, cuerpos }) => {
        this.procesos.set(procesos.content);
        this.oeps.set(oeps);
        this.accesos.set(accesos);
        this.vinculaciones.set(vinculaciones);
        this.cuerpos.set(cuerpos);
      },
      error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
  }

  filteredProcesos(): ProcesoSelectivo[] {
    const term = this.search().trim().toLocaleLowerCase("es");
    return this.procesos().filter((item) => {
      const matchesStatus = this.statusFilter() === "TODOS"
        || (this.statusFilter() === "ACTIVOS" ? item.estado !== "CERRADO" : item.estado === this.statusFilter());
      const matchesSearch = !term || `${item.nombre} ${item.codigoSirhus ?? ""}`.toLocaleLowerCase("es").includes(term);
      return matchesStatus && matchesSearch;
    });
  }

  statusLabel(status: ProcesoSelectivo["estado"]): string {
    return { BORRADOR: "Borrador", PUBLICADO: "Publicado", CERRADO: "Cerrado" }[status];
  }

  tipoAccesoLabel(proceso: ProcesoSelectivo): string {
    return proceso.tipoAcceso?.descripcion || proceso.tipoAcceso?.codigo || "";
  }

  processCount(filter: ProcessStatusFilter): number {
    if (filter === "TODOS") return this.procesos().length;
    if (filter === "CERRADO") return this.procesos().filter((item) => item.estado === "CERRADO").length;
    return this.procesos().filter((item) => item.estado !== "CERRADO").length;
  }

  selectProceso(proceso: ProcesoSelectivo): void {
    this.selected.set(proceso);
    this.closeForms();
    this.clearMessages();
    this.loadExamenes(proceso.id);
  }

  openCreateProcess(): void {
    if (!this.canCreateProcess()) return;
    this.clearMessages();
    this.processFormMode.set("create");
    this.processForm = this.emptyProcessForm();
    this.examFormOpen.set(false);
    this.processDrawerExpanded.set(false);
    this.processFormOpen.set(true);
  }

  openEditProcess(): void {
    if (!this.canEditProcess()) return;
    const proceso = this.selected();
    if (!proceso) return;
    this.clearMessages();
    this.processFormMode.set("edit");
    this.processForm = {
      nombre: proceso.nombre,
      codigoSirhus: proceso.codigoSirhus ?? "",
      urlWebProceso: proceso.urlWebProceso ?? "",
      estado: proceso.estado,
      oepIds: proceso.oeps?.map((item) => item.idOep) ?? [],
      idTipoAcceso: proceso.tipoAcceso?.idTipoAcceso ?? null,
      idCuerpo: proceso.cuerpo?.idCuerpo ?? null,
      idTipoVinculacion: proceso.tipoVinculacion?.idTipoVinculacion ?? null,
    };
    this.examFormOpen.set(false);
    this.processDrawerExpanded.set(false);
    this.processFormOpen.set(true);
  }

  isOepSelected(oepId: number): boolean {
    return this.processForm.oepIds.includes(oepId);
  }

  toggleOep(oepId: number, selected: boolean): void {
    this.processForm.oepIds = selected
      ? [...new Set([...this.processForm.oepIds, oepId])]
      : this.processForm.oepIds.filter((id) => id !== oepId);
  }

  saveProcess(form: NgForm): void {
    if (this.processFormMode() === "create" && !this.canCreateProcess()) return;
    if (this.processFormMode() === "edit" && !this.canEditProcess()) return;
    if (form.invalid || this.saving()) return;
    const payload: ProcesoSelectivoCreate = {
      nombre: this.processForm.nombre.trim(),
      codigoSirhus: this.optional(this.processForm.codigoSirhus),
      urlWebProceso: this.optional(this.processForm.urlWebProceso),
      oepIds: this.processForm.oepIds,
      idTipoAcceso: this.processForm.idTipoAcceso ?? undefined,
      idCuerpo: this.processForm.idCuerpo ?? undefined,
      idTipoVinculacion: this.processForm.idTipoVinculacion ?? undefined,
    };
    this.saving.set(true);
    this.clearMessages();
    const selected = this.selected();
    const request = this.processFormMode() === "edit" && selected
      ? this.api.updateProceso(selected.id, { ...payload, estado: this.processForm.estado })
      : this.api.createProceso(payload);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (saved) => {
        this.procesos.update((items) => this.upsert(items, saved));
        this.selected.set(saved);
        this.processFormOpen.set(false);
        this.success.set(this.processFormMode() === "edit" ? "Proceso actualizado correctamente." : "Proceso creado correctamente.");
        if (this.processFormMode() === "create") this.loadExamenes(saved.id);
      },
      error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
  }

  openCreateExam(): void {
    if (!this.canCreateExam() || !this.selected()) return;
    this.clearMessages();
    this.examFormMode.set("create");
    this.editingExamId.set(null);
    this.examForm = { ...this.emptyExamForm(), numeroEjercicio: this.nextExamNumber() };
    this.processFormOpen.set(false);
    this.examDrawerExpanded.set(false);
    this.examFormOpen.set(true);
  }

  openEditExam(examen: Examen): void {
    if (!this.canEditExam()) return;
    this.clearMessages();
    this.examFormMode.set("edit");
    this.editingExamId.set(examen.id);
    this.examForm = {
      nombre: examen.nombre,
      numeroEjercicio: examen.numeroEjercicio,
      fechaHora: this.toLocalDateTime(examen.fechaHora),
      observaciones: examen.observaciones ?? "",
    };
    this.processFormOpen.set(false);
    this.examDrawerExpanded.set(false);
    this.examFormOpen.set(true);
  }

  saveExam(form: NgForm): void {
    const proceso = this.selected();
    if (!proceso || form.invalid || this.saving()) return;
    if (this.examFormMode() === "create" && !this.canCreateExam()) return;
    if (this.examFormMode() === "edit" && !this.canEditExam()) return;
    const payload: ExamenCreate = {
      nombre: this.examForm.nombre.trim(),
      numeroEjercicio: Number(this.examForm.numeroEjercicio),
      fechaHora: this.examForm.fechaHora ? new Date(this.examForm.fechaHora).toISOString() : undefined,
      observaciones: this.optional(this.examForm.observaciones),
    };
    this.saving.set(true);
    this.clearMessages();
    const editingId = this.editingExamId();
    const request = this.examFormMode() === "edit" && editingId
      ? this.api.updateExamen(editingId, payload)
      : this.api.createExamen(proceso.id, payload);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (saved) => {
        this.examenes.update((items) => this.upsert(items, saved).sort((a, b) => a.numeroEjercicio - b.numeroEjercicio));
        this.examFormOpen.set(false);
        this.success.set(this.examFormMode() === "edit" ? "Ejercicio actualizado correctamente." : "Ejercicio creado correctamente.");
      },
      error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
  }

  askDeleteCurrentExam(): void {
    const id = this.editingExamId();
    if (!id || !this.canDeleteExam()) return;
    const target = this.examenes().find((item) => item.id === id);
    if (target) {
      this.askDeleteExam(target);
    }
  }

  askDeleteExam(examen: Examen): void {
    if (!this.canDeleteExam()) return;
    this.clearMessages();
    this.deleteExamTarget.set(examen);
    this.deleteExamDialog?.nativeElement.showModal();
  }

  closeDeleteExam(): void {
    this.deleteExamDialog?.nativeElement.close();
    this.deleteExamTarget.set(null);
  }

  confirmDeleteExam(): void {
    const examen = this.deleteExamTarget();
    if (!examen || this.deletingExam()) return;
    this.deletingExam.set(true);
    this.clearMessages();
    this.api.deleteExamen(examen.id).pipe(finalize(() => this.deletingExam.set(false))).subscribe({
      next: () => {
        this.examenes.update((items) => items.filter((item) => item.id !== examen.id));
        this.convocadosCount.update((counts) => {
          const updated = { ...counts };
          delete updated[examen.id];
          return updated;
        });
        if (this.editingExamId() === examen.id) this.closeForms();
        this.closeDeleteExam();
        this.success.set("El ejercicio y sus datos operativos se han eliminado.");
      },
      error: (error: unknown) => {
        this.closeDeleteExam();
        this.error.set(apiErrorMessage(error));
      },
    });
  }

  getConvocadosCount(examenId: string): number {
    return this.convocadosCount()[examenId] ?? 0;
  }

  closeForms(): void {
    this.processFormOpen.set(false);
    this.examFormOpen.set(false);
    this.processDrawerExpanded.set(false);
    this.examDrawerExpanded.set(false);
  }

  toggleProcessDrawerExpand(): void {
    this.processDrawerExpanded.update((v) => !v);
  }

  toggleExamDrawerExpand(): void {
    this.examDrawerExpanded.update((v) => !v);
  }

  formatDate(value?: string): string {
    return value ? new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Fecha pendiente";
  }

  private loadExamenes(procesoId: string): void {
    this.examenes.set([]);
    this.convocadosCount.set({});
    this.loadingExamenes.set(true);
    this.api.listExamenes(procesoId).pipe(finalize(() => this.loadingExamenes.set(false))).subscribe({
      next: (items) => {
        const sorted = items.sort((a, b) => a.numeroEjercicio - b.numeroEjercicio);
        this.examenes.set(sorted);
        this.loadConvocadosCounts(sorted);
      },
      error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
  }

  private loadConvocadosCounts(examenes: Examen[]): void {
    if (!examenes.length) {
      this.convocadosCount.set({});
      return;
    }
    const requests = examenes.map((e) =>
      this.api.listConvocadosByExamen(e.id).pipe(
        map((convocados) => ({ examId: e.id, count: convocados.length })),
        catchError(() => of({ examId: e.id, count: 0 })),
      ),
    );
    forkJoin(requests).subscribe((results) => {
      const counts: Record<string, number> = {};
      for (const r of results) {
        counts[r.examId] = r.count;
      }
      this.convocadosCount.set(counts);
    });
  }

  private emptyProcessForm(): ProcessFormValue {
    return { nombre: "", codigoSirhus: "", urlWebProceso: "", estado: "BORRADOR", oepIds: [], idTipoAcceso: null, idCuerpo: null, idTipoVinculacion: null };
  }

  private emptyExamForm(): ExamFormValue {
    return { nombre: "", numeroEjercicio: 1, fechaHora: "", observaciones: "" };
  }

  private nextExamNumber(): number {
    return Math.max(0, ...this.examenes().map((item) => item.numeroEjercicio)) + 1;
  }

  private toLocalDateTime(value?: string): string {
    if (!value) return "";
    const date = new Date(value);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  }

  private optional(value: string): string | undefined {
    return value.trim() || undefined;
  }

  private upsert<T extends { id: string }>(items: T[], saved: T): T[] {
    const index = items.findIndex((item) => item.id === saved.id);
    return index < 0 ? [...items, saved] : items.map((item) => item.id === saved.id ? saved : item);
  }

  private clearMessages(): void {
    this.error.set(null);
    this.success.set(null);
  }
}
