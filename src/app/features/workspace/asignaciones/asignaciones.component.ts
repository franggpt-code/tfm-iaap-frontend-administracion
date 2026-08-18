import { Component, computed, ElementRef, inject, OnInit, signal, ViewChild } from "@angular/core";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { finalize, forkJoin } from "rxjs";
import { apiErrorMessage } from "../../../api/api-error";
import { SicolApiClient } from "../../../api/sicol-api-client.service";
import {
  AsignacionColaborador, Colaborador, ContextoAsignacion, ConvocadoExamen, Examen, ExamenAula,
  EstadoConfirmacionAsignacion, PerfilColaboracion, ProcesoSelectivo,
} from "../../../api/sicol.types";

type SelectionMode = "proceso" | "fecha";
type ViewMode = "tabla" | "aulas";

@Component({
  selector: "app-asignaciones",
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: "./asignaciones.component.html",
  styleUrl: "./asignaciones.component.scss",
})
export class AsignacionesComponent implements OnInit {
  private readonly api = inject(SicolApiClient);
  private readonly fb = inject(FormBuilder);
  private collaboratorSearchTimer?: ReturnType<typeof setTimeout>;
  private processSearchTimer?: ReturnType<typeof setTimeout>;
  private collaboratorSearchRequest = 0;
  @ViewChild("deleteDialog") private deleteDialog?: ElementRef<HTMLDialogElement>;

  readonly selectionMode = signal<SelectionMode>("proceso");
  readonly viewMode = signal<ViewMode>("tabla");
  readonly procesos = signal<ProcesoSelectivo[]>([]);
  readonly examenes = signal<Examen[]>([]);
  readonly contextosFecha = signal<ContextoAsignacion[]>([]);
  readonly perfiles = signal<PerfilColaboracion[]>([]);
  readonly colaboradores = signal<Colaborador[]>([]);
  readonly convocados = signal<ConvocadoExamen[]>([]);
  readonly aulas = signal<ExamenAula[]>([]);
  readonly asignaciones = signal<AsignacionColaborador[]>([]);
  readonly selectedProcesoId = signal("");
  readonly selectedExamenId = signal("");
  readonly selectedCenter = signal("");
  readonly selectedCollaboratorId = signal("");
  readonly collaboratorQuery = signal("");
  readonly collaboratorResultsOpen = signal(false);
  readonly collaboratorSearchLoading = signal(false);
  readonly collaboratorSearchError = signal<string | null>(null);
  readonly selectedDate = signal(new Date().toISOString().slice(0, 10));
  readonly assignmentSearch = signal("");
  readonly profileFilter = signal("");
  readonly scopeFilter = signal<"" | "GENERAL" | "AULA">("");
  readonly selectedAssignmentIds = signal<Set<string>>(new Set());
  readonly bulkHours = signal<number | null>(null);
  readonly bulkUpdating = signal(false);
  readonly loading = signal(true);
  readonly contextLoading = signal(false);
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly confirmationUpdating = signal<Set<string>>(new Set());
  readonly formOpen = signal(false);
  readonly editing = signal<AsignacionColaborador | null>(null);
  readonly deleteTarget = signal<AsignacionColaborador | null>(null);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly fieldErrors = signal<Record<string, string>>({});

  readonly form = this.fb.nonNullable.group({
    ambito: ["AULA" as "AULA" | "GENERAL"], centro: [""], examenAulaId: [""], colaboradorId: [""], perfilId: [""],
    subcategoriaGeneral: [""], estadoConfirmacion: ["PENDIENTE" as EstadoConfirmacionAsignacion], horasRealizadas: [null as number | null],
  });

  readonly centers = computed(() => [...new Set(this.aulas().map(item => item.centroNombre || "Sin centro"))].sort((a, b) => a.localeCompare(b, "es")));
  readonly availableRooms = computed(() => {
    const center = this.selectedCenter();
    return this.aulas()
      .filter(item => (item.centroNombre || "Sin centro") === center)
      .sort((a, b) => a.aulaNombre.localeCompare(b.aulaNombre, "es", { numeric: true }));
  });
  readonly selectedExam = computed(() => this.examenes().find(item => item.id === this.selectedExamenId()));
  readonly filteredAssignments = computed(() => {
    const query = this.assignmentSearch().trim().toLocaleLowerCase("es");
    const profile = this.profileFilter();
    const scope = this.scopeFilter();
    return this.asignaciones().filter(item => {
      if (profile && item.perfilId !== profile) return false;
      if (scope === "GENERAL" && item.examenAulaId) return false;
      if (scope === "AULA" && !item.examenAulaId) return false;
      if (!query) return true;
      return [item.colaboradorNombre, item.colaboradorDocumento, item.centroNombre, item.aulaNombre, item.subcategoriaGeneral, item.perfilDenominacion, this.confirmationLabel(item.estadoConfirmacion), item.examenAulaId ? "" : "Ámbito general"]
        .filter(Boolean).join(" ").toLocaleLowerCase("es").includes(query);
    });
  });
  readonly allFilteredSelected = computed(() => this.filteredAssignments().length > 0 && this.filteredAssignments().every(item => this.selectedAssignmentIds().has(item.id)));
  readonly someFilteredSelected = computed(() => this.filteredAssignments().some(item => this.selectedAssignmentIds().has(item.id)));
  readonly processAssignments = computed(() => this.asignaciones().filter(item => !item.examenAulaId));
  readonly roomGroups = computed(() => this.aulas().map(aula => ({
    aula,
    assignments: this.asignaciones().filter(item => item.examenAulaId === aula.id),
    responsibleCount: this.asignaciones().filter(item => item.examenAulaId === aula.id && item.perfilCodigo === "RESPONSABLE_DE_AULA").length,
    convocadosCount: this.convocados().filter(item => item.examenAulaId === aula.id && item.activo).length,
  })));
  readonly coverage = computed(() => {
    const total = this.aulas().length;
    const covered = this.roomGroups().filter(item => item.responsibleCount > 0).length;
    return { total, covered, pending: total - covered, percentage: total ? Math.round(covered * 100 / total) : 0 };
  });
  readonly confirmationSummary = computed(() => ({
    total: this.asignaciones().length,
    confirmed: this.asignaciones().filter(item => item.estadoConfirmacion === "CONFIRMADA").length,
    pending: this.asignaciones().filter(item => item.estadoConfirmacion === "PENDIENTE").length,
    rejected: this.asignaciones().filter(item => item.estadoConfirmacion === "RECHAZADA").length,
  }));
  readonly duplicateCollaborators = computed(() => {
    const grouped = new Map<string, AsignacionColaborador[]>();
    for (const item of this.asignaciones()) grouped.set(item.colaboradorId, [...(grouped.get(item.colaboradorId) || []), item]);
    return [...grouped.values()].filter(items => items.length > 1).sort((a, b) => (a[0].colaboradorNombre || "").localeCompare(b[0].colaboradorNombre || "", "es"));
  });

  ngOnInit(): void {
    forkJoin({ procesos: this.api.listProcesos(0, 200), perfiles: this.api.listPerfilesColaboracion(), colaboradores: this.api.listColaboradores({ estado: "ACTIVO", size: 100 }) })
      .pipe(finalize(() => this.loading.set(false))).subscribe({
        next: ({ procesos, perfiles, colaboradores }) => { this.procesos.set(procesos.content); this.perfiles.set(perfiles); this.colaboradores.set(colaboradores.content); },
        error: (error: unknown) => this.error.set(apiErrorMessage(error)),
      });
  }

  setSelectionMode(mode: SelectionMode): void {
    this.selectionMode.set(mode); this.clearContext(); this.error.set(null); this.success.set(null);
    if (mode === "fecha") this.loadByDate();
  }

  selectProcess(procesoId: string): void {
    this.selectedProcesoId.set(procesoId); this.selectedExamenId.set(""); this.clearAssignments();
    if (!procesoId) { this.examenes.set([]); return; }
    this.contextLoading.set(true);
    this.api.listExamenes(procesoId).pipe(finalize(() => this.contextLoading.set(false))).subscribe({
      next: exams => this.examenes.set(exams), error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
  }

  loadByDate(): void {
    const date = this.selectedDate(); if (!date) return;
    this.contextLoading.set(true); this.clearAssignments();
    this.api.listContextosAsignacion(date).pipe(finalize(() => this.contextLoading.set(false))).subscribe({
      next: contexts => this.contextosFecha.set(contexts), error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
  }

  selectDateContext(examenId: string): void {
    const context = this.contextosFecha().find(item => item.examenId === examenId);
    this.selectedExamenId.set(examenId);
    if (context) {
      this.selectedProcesoId.set(context.procesoSelectivoId);
      this.examenes.set([{ id: context.examenId, procesoSelectivoId: context.procesoSelectivoId, nombre: context.examenNombre, numeroEjercicio: context.numeroEjercicio, fechaHora: context.fechaHora }]);
    }
    this.loadAssignments();
  }

  selectExam(examenId: string): void { this.selectedExamenId.set(examenId); this.loadAssignments(); }

  loadAssignments(): void {
    const examId = this.selectedExamenId(); if (!examId) { this.clearAssignments(); return; }
    this.contextLoading.set(true); this.closeForm(); this.error.set(null);
    forkJoin({ aulas: this.api.listExamenAulas(examId), asignaciones: this.api.listAsignaciones(examId), convocados: this.api.listConvocadosByExamen(examId) })
      .pipe(finalize(() => this.contextLoading.set(false))).subscribe({
        next: ({ aulas, asignaciones, convocados }) => { this.aulas.set(aulas); this.asignaciones.set(asignaciones); this.convocados.set(convocados); this.clearTableSelection(); },
        error: (error: unknown) => this.error.set(apiErrorMessage(error)),
      });
  }

  startCreate(aula?: ExamenAula): void {
    const ambito = aula ? "AULA" : "GENERAL";
    const center = aula?.centroNombre || "";
    this.editing.set(null); this.fieldErrors.set({});
    this.selectedCenter.set(center); this.resetCollaboratorSearch();
    this.form.reset({ ambito, centro: center, examenAulaId: aula?.id || "", colaboradorId: "", perfilId: "", subcategoriaGeneral: "", estadoConfirmacion: "PENDIENTE", horasRealizadas: null });
    this.formOpen.set(true); this.success.set(null);
  }

  startEdit(item: AsignacionColaborador): void {
    const room = this.aulas().find(aula => aula.id === item.examenAulaId);
    this.editing.set(item); this.fieldErrors.set({});
    this.selectedCenter.set(room?.centroNombre || "");
    this.selectedCollaboratorId.set(item.colaboradorId);
    this.collaboratorQuery.set(`${item.colaboradorNombre ?? "Colaborador"} · ${item.colaboradorDocumento ?? ""}`.trim());
    this.collaboratorResultsOpen.set(false); this.collaboratorSearchError.set(null);
    this.form.reset({ ambito: room ? "AULA" : "GENERAL", centro: room?.centroNombre || "", examenAulaId: item.examenAulaId || "", colaboradorId: item.colaboradorId, perfilId: item.perfilId, subcategoriaGeneral: item.subcategoriaGeneral || "", estadoConfirmacion: item.estadoConfirmacion, horasRealizadas: item.horasRealizadas ?? null });
    this.ensureCollaboratorOption(item); this.formOpen.set(true); this.success.set(null);
  }

  closeForm(): void { this.formOpen.set(false); this.editing.set(null); this.fieldErrors.set({}); this.collaboratorResultsOpen.set(false); }
  centerChanged(center: string): void {
    this.selectedCenter.set(center);
    const rooms = this.aulas().filter(item => (item.centroNombre || "Sin centro") === center);
    this.form.controls.examenAulaId.setValue(rooms.length === 1 ? rooms[0].id : "");
    this.fieldErrors.update(errors => { const { examenAulaId: _, ...rest } = errors; return rest; });
  }
  scopeChanged(scope: "AULA" | "GENERAL"): void {
    this.form.controls.ambito.setValue(scope);
    if (scope === "GENERAL") {
      this.selectedCenter.set(""); this.form.controls.centro.setValue(""); this.form.controls.examenAulaId.setValue("");
    } else {
      this.form.controls.subcategoriaGeneral.setValue("");
      const center = this.centers()[0] || "";
      this.form.controls.centro.setValue(center); this.centerChanged(center);
    }
    this.fieldErrors.update(errors => { const { examenAulaId: _, ambito: __, ...rest } = errors; return rest; });
  }

  searchCollaborators(value: string): void {
    if (this.editing()) return;
    clearTimeout(this.collaboratorSearchTimer);
    const query = value.trim();
    this.collaboratorQuery.set(value);
    this.selectedCollaboratorId.set("");
    this.form.controls.colaboradorId.setValue("");
    this.fieldErrors.update(errors => { const { colaboradorId: _, ...rest } = errors; return rest; });
    this.collaboratorSearchError.set(null);
    if (query.length < 2) {
      this.collaboratorSearchRequest++;
      this.collaboratorSearchLoading.set(false); this.collaboratorResultsOpen.set(false);
      return;
    }
    this.collaboratorSearchLoading.set(true); this.collaboratorResultsOpen.set(true);
    const requestId = ++this.collaboratorSearchRequest;
    this.collaboratorSearchTimer = setTimeout(() => {
      this.api.listColaboradores({ search: query, estado: "ACTIVO", size: 20 }).subscribe({
        next: result => {
          if (requestId !== this.collaboratorSearchRequest) return;
          this.colaboradores.set(result.content); this.collaboratorSearchLoading.set(false);
        },
        error: () => {
          if (requestId !== this.collaboratorSearchRequest) return;
          this.colaboradores.set([]); this.collaboratorSearchLoading.set(false);
          this.collaboratorSearchError.set("No se han podido buscar colaboradores. Inténtalo de nuevo.");
        },
      });
    }, 250);
  }

  selectCollaborator(person: Colaborador): void {
    const document = `${person.dni}${person.letra}`;
    this.form.controls.colaboradorId.setValue(person.id);
    this.selectedCollaboratorId.set(person.id);
    this.collaboratorQuery.set(`${person.nombreCompleto} · ${document}`);
    this.collaboratorResultsOpen.set(false); this.collaboratorSearchError.set(null);
  }

  clearCollaborator(): void {
    if (this.editing()) return;
    this.form.controls.colaboradorId.setValue("");
    this.selectedCollaboratorId.set(""); this.collaboratorQuery.set("");
    this.collaboratorResultsOpen.set(false); this.collaboratorSearchError.set(null);
  }

  searchProcesses(value: string): void {
    clearTimeout(this.processSearchTimer);
    this.processSearchTimer = setTimeout(() => {
      this.api.listProcesos(0, 100, value.trim()).subscribe({ next: result => this.procesos.set(result.content) });
    }, 250);
  }

  setAssignmentSearch(value: string): void { this.assignmentSearch.set(value); this.clearTableSelection(); }
  setProfileFilter(value: string): void { this.profileFilter.set(value); this.clearTableSelection(); }
  setScopeFilter(value: "" | "GENERAL" | "AULA"): void { this.scopeFilter.set(value); this.clearTableSelection(); }
  clearAssignmentFilters(): void {
    this.assignmentSearch.set(""); this.profileFilter.set(""); this.scopeFilter.set(""); this.clearTableSelection();
  }
  cancelBulkSelection(): void { this.clearTableSelection(); this.bulkHours.set(null); }

  toggleAssignmentSelection(id: string, selected: boolean): void {
    this.selectedAssignmentIds.update(current => {
      const next = new Set(current);
      selected ? next.add(id) : next.delete(id);
      return next;
    });
  }

  toggleFilteredAssignments(selected: boolean): void {
    this.selectedAssignmentIds.update(current => {
      const next = new Set(current);
      for (const item of this.filteredAssignments()) selected ? next.add(item.id) : next.delete(item.id);
      return next;
    });
  }

  applyBulkHours(): void {
    const ids = [...this.selectedAssignmentIds()];
    const hours = this.bulkHours();
    if (!ids.length || hours === null || Number.isNaN(hours) || hours < 0) return;
    this.bulkUpdating.set(true); this.error.set(null);
    this.api.updateAssignmentHours({ ids, horasRealizadas: hours }).pipe(finalize(() => this.bulkUpdating.set(false))).subscribe({
      next: () => {
        this.asignaciones.update(items => items.map(item => ids.includes(item.id) ? { ...item, horasRealizadas: hours, importeTotal: Math.round(hours * item.importeHora * 100) / 100 } : item));
        this.success.set(`Se han establecido ${hours.toLocaleString("es-ES")} horas en ${ids.length} ${ids.length === 1 ? "asignación" : "asignaciones"}.`);
        this.clearTableSelection(); this.bulkHours.set(null);
      },
      error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
  }

  save(): void {
    const value = this.form.getRawValue(); const errors: Record<string, string> = {};
    if (value.ambito === "AULA" && !value.examenAulaId) errors["examenAulaId"] = "Selecciona un aula.";
    if (!value.colaboradorId) errors["colaboradorId"] = "Selecciona un colaborador.";
    if (!value.perfilId) errors["perfilId"] = "Selecciona un perfil.";
    const profile = this.perfiles().find(item => item.id === value.perfilId);
    if (value.ambito === "GENERAL" && profile?.codigo === "RESPONSABLE_DE_AULA") errors["ambito"] = "El perfil responsable de aula requiere un aula concreta.";
    if (value.horasRealizadas !== null && value.horasRealizadas < 0) errors["horasRealizadas"] = "Las horas no pueden ser negativas.";
    this.fieldErrors.set(errors); if (Object.keys(errors).length) return;
    const current = this.editing(); const examId = this.selectedExamenId(); if (!examId) return;
    this.saving.set(true); this.error.set(null);
    const request = current
      ? this.api.updateAsignacion(current.id, { ambitoGeneral: value.ambito === "GENERAL", examenAulaId: value.ambito === "AULA" ? value.examenAulaId : null, perfilId: value.perfilId, subcategoriaGeneral: value.ambito === "GENERAL" ? value.subcategoriaGeneral : "", estadoConfirmacion: value.estadoConfirmacion, horasRealizadas: value.horasRealizadas })
      : this.api.createAsignacion(examId, { ambitoGeneral: value.ambito === "GENERAL", examenAulaId: value.ambito === "AULA" ? value.examenAulaId : null, colaboradorId: value.colaboradorId, perfilId: value.perfilId, subcategoriaGeneral: value.ambito === "GENERAL" ? value.subcategoriaGeneral : null, estadoConfirmacion: value.estadoConfirmacion, horasRealizadas: value.horasRealizadas });
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => { this.success.set(current ? "La asignación se ha actualizado." : "La persona se ha asignado correctamente."); this.closeForm(); this.loadAssignments(); },
      error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
  }

  updateConfirmation(item: AsignacionColaborador, estado: EstadoConfirmacionAsignacion): void {
    if (item.estadoConfirmacion === estado || this.confirmationUpdating().has(item.id)) return;
    this.confirmationUpdating.update(current => new Set(current).add(item.id)); this.error.set(null);
    this.api.updateAsignacion(item.id, { estadoConfirmacion: estado }).pipe(finalize(() => {
      this.confirmationUpdating.update(current => { const next = new Set(current); next.delete(item.id); return next; });
    })).subscribe({
      next: updated => {
        this.asignaciones.update(items => items.map(value => value.id === updated.id ? updated : value));
        this.success.set(`Confirmación de ${item.colaboradorNombre ?? "la persona"} actualizada.`);
      },
      error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
  }

  confirmationLabel(value: EstadoConfirmacionAsignacion): string {
    return value === "CONFIRMADA" ? "Confirmada" : value === "RECHAZADA" ? "Rechazada" : "Pendiente";
  }

  askDelete(item: AsignacionColaborador): void { this.deleteTarget.set(item); this.deleteDialog?.nativeElement.showModal(); }
  closeDelete(): void { this.deleteDialog?.nativeElement.close(); this.deleteTarget.set(null); }
  confirmDelete(): void {
    const item = this.deleteTarget(); if (!item) return;
    this.deleting.set(true);
    this.error.set(null);
    this.api.deleteAsignacion(item.id).pipe(finalize(() => this.deleting.set(false))).subscribe({
      next: () => { this.success.set("La asignación se ha eliminado."); this.closeDelete(); this.loadAssignments(); },
      error: (error: unknown) => { this.error.set(apiErrorMessage(error)); this.closeDelete(); },
    });
  }

  processLabel(id: string): string {
    const item = this.procesos().find(process => process.id === id);
    if (item) return `${item.codigoSirhus ? item.codigoSirhus + " · " : ""}${item.nombre}`;
    const context = this.contextosFecha().find(value => value.procesoSelectivoId === id);
    return context ? `${context.codigoSirhus ? context.codigoSirhus + " · " : ""}${context.procesoNombre}` : "Proceso selectivo";
  }
  formatDate(value?: string): string { return value ? new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Fecha pendiente"; }
  money(value?: number | null): string { return value == null ? "—" : value.toLocaleString("es-ES", { style: "currency", currency: "EUR" }); }

  private clearContext(): void { this.selectedProcesoId.set(""); this.selectedExamenId.set(""); this.examenes.set([]); this.contextosFecha.set([]); this.clearAssignments(); }
  private clearAssignments(): void { this.aulas.set([]); this.asignaciones.set([]); this.convocados.set([]); this.clearTableSelection(); this.closeForm(); }
  private clearTableSelection(): void { this.selectedAssignmentIds.set(new Set()); }
  private resetCollaboratorSearch(): void {
    clearTimeout(this.collaboratorSearchTimer); this.collaboratorSearchRequest++;
    this.selectedCollaboratorId.set(""); this.collaboratorQuery.set("");
    this.collaboratorResultsOpen.set(false); this.collaboratorSearchLoading.set(false); this.collaboratorSearchError.set(null);
  }
  private ensureCollaboratorOption(item: AsignacionColaborador): void {
    if (!this.colaboradores().some(person => person.id === item.colaboradorId)) {
      this.colaboradores.update(values => [...values, { id: item.colaboradorId, dni: (item.colaboradorDocumento ?? "").slice(0, 8), letra: (item.colaboradorDocumento ?? " ").slice(8, 9), nombreCompleto: item.colaboradorNombre ?? "Colaborador", sexo: "NO_INFORMA", correoCorporativo: "", perteneceCentroDirectivo: false, estado: "ACTIVO" }]);
    }
  }
}
