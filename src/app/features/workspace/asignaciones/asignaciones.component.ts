import { Component, computed, DestroyRef, ElementRef, inject, OnInit, signal, ViewChild } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { catchError, debounceTime, distinctUntilChanged, finalize, forkJoin, of, startWith, Subject, switchMap } from "rxjs";
import { apiErrorMessage } from "../../../api/api-error";
import { SicolApiClient } from "../../../api/sicol-api-client.service";
import { AuthService } from "../../../core/auth.service";
import {
  AsignacionColaborador, Aula, Centro, Colaborador, ContextoAsignacion, ConvocadoExamen, CuadroMandoEjercicio, Examen, ExamenAula,
  EstadoConfirmacionAsignacion, PerfilColaboracion, ProcesoSelectivo, Provincia,
} from "../../../api/sicol.types";

type SelectionMode = "proceso" | "fecha";
type ViewMode = "tabla" | "aulas";
type QuickExercisePeriod = "proximos" | "anteriores";
export type AssignmentSortColumn = "ambito" | "colaborador" | "perfil" | "confirmacion" | "horas" | "importe";
export type SortDirection = "asc" | "desc";

@Component({
  selector: "app-asignaciones",
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: "./asignaciones.component.html",
  styleUrl: "./asignaciones.component.scss",
})
export class AsignacionesComponent implements OnInit {
  private readonly api = inject(SicolApiClient);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private collaboratorSearchTimer?: ReturnType<typeof setTimeout>;
  private readonly processSearchTerms = new Subject<string>();
  private collaboratorSearchRequest = 0;
  private examSearchRequest = 0;
  private assignmentLoadRequest = 0;
  private upcomingSelectionRequest = 0;

  @ViewChild("deleteDialog") private deleteDialog?: ElementRef<HTMLDialogElement>;
  @ViewChild("deleteAulaDialog") private deleteAulaDialog?: ElementRef<HTMLDialogElement>;

  readonly isAdmin = this.auth.isAdmin;
  readonly canManageAulas = computed(() => this.auth.isAdmin() || this.auth.isManager());

  readonly selectionMode = signal<SelectionMode>("proceso");
  readonly viewMode = signal<ViewMode>("aulas");
  readonly selectionCollapsed = signal(false);
  readonly drawerExpanded = signal(false);
  readonly roomCoverageFilter = signal<"" | "COVERED" | "UNCOVERED">("");
  readonly roomSearch = signal("");

  // Estado del Panel Lateral de Creación de Aula Extraordinaria/Incidencias
  readonly createAulaDrawerOpen = signal(false);
  readonly modalProvincias = signal<Provincia[]>([]);
  readonly modalCentros = signal<Centro[]>([]);
  readonly modalCentrosLoading = signal(false);
  readonly createAulaProvinciaId = signal("");
  readonly createAulaCentroId = signal("");
  readonly createAulaIsNewCentro = signal(false);
  readonly createAulaNuevoCentroNombre = signal("");
  readonly createAulaNombre = signal("");
  readonly createAulaSaving = signal(false);
  readonly createAulaError = signal<string | null>(null);

  // Estado del Panel Lateral de Renombrar Aula
  readonly renameAulaDrawerOpen = signal(false);
  readonly renameTargetExamenAula = signal<ExamenAula | null>(null);
  readonly renameAulaNombre = signal("");
  readonly renameAulaSaving = signal(false);
  readonly renameAulaError = signal<string | null>(null);

  // Estado de Eliminación de Aula
  readonly deleteAulaTarget = signal<ExamenAula | null>(null);
  readonly deleteAulaSaving = signal(false);
  readonly deleteAulaError = signal<string | null>(null);

  readonly assignmentSearch = signal("");
  readonly filtersExpanded = signal(false);
  readonly profileFilter = signal("");
  readonly scopeFilter = signal<"" | "GENERAL" | "AULA">("");
  readonly confirmationFilter = signal<"" | EstadoConfirmacionAsignacion>("");
  readonly centerFilter = signal("");
  readonly sortBy = signal<AssignmentSortColumn>("colaborador");
  readonly sortDirection = signal<SortDirection>("asc");

  readonly procesos = signal<ProcesoSelectivo[]>([]);
  readonly proximosEjercicios = signal<CuadroMandoEjercicio[]>([]);
  readonly anterioresEjercicios = signal<CuadroMandoEjercicio[]>([]);
  readonly examenes = signal<Examen[]>([]);
  readonly contextosFecha = signal<ContextoAsignacion[]>([]);
  readonly fechasDisponibles = signal<string[]>([]);
  readonly perfiles = signal<PerfilColaboracion[]>([]);
  readonly colaboradores = signal<Colaborador[]>([]);
  readonly convocados = signal<ConvocadoExamen[]>([]);
  readonly aulas = signal<ExamenAula[]>([]);
  readonly asignaciones = signal<AsignacionColaborador[]>([]);
  readonly selectedProcesoId = signal("");
  readonly selectedProceso = signal<ProcesoSelectivo | null>(null);
  readonly selectedExamenId = signal("");
  readonly processQuery = signal("");
  readonly processResultsOpen = signal(false);
  readonly processSearchLoading = signal(false);
  readonly processSearchError = signal<string | null>(null);
  readonly activeProcessIndex = signal(0);
  readonly processTotal = signal(0);
  readonly upcomingExercisesLoading = signal(true);
  readonly quickExercisePeriod = signal<QuickExercisePeriod>("proximos");
  readonly selectingUpcomingExerciseId = signal<string | null>(null);
  readonly selectedCenter = signal("");
  readonly selectedCollaboratorId = signal("");
  readonly collaboratorQuery = signal("");
  readonly collaboratorResultsOpen = signal(false);
  readonly collaboratorSearchLoading = signal(false);
  readonly collaboratorSearchError = signal<string | null>(null);
  readonly selectedDate = signal("");
  readonly availableDatesLoading = signal(true);
  readonly selectedAssignmentIds = signal<Set<string>>(new Set());
  readonly bulkHours = signal<number | null>(null);
  readonly bulkMinutes = signal(0);
  readonly bulkUpdating = signal(false);
  readonly loading = signal(true);
  readonly contextLoading = signal(false);
  readonly examLoading = signal(false);
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
    ambito: ["AULA" as "AULA" | "GENERAL"],
    centro: [""],
    examenAulaId: [""],
    colaboradorId: [""],
    perfilId: [""],
    subcategoriaGeneral: [""],
    estadoConfirmacion: ["PENDIENTE" as EstadoConfirmacionAsignacion],
    horasRealizadas: [null as number | null],
  });

  readonly centers = computed(() =>
    [...new Set(this.aulas().map((item) => item.centroNombre || "Sin centro"))].sort((a, b) =>
      a.localeCompare(b, "es")
    )
  );

  readonly availableRooms = computed(() => {
    const center = this.selectedCenter();
    return this.aulas()
      .filter((item) => (item.centroNombre || "Sin centro") === center)
      .sort((a, b) => a.aulaNombre.localeCompare(b.aulaNombre, "es", { numeric: true }));
  });

  readonly selectedExam = computed(() =>
    this.examenes().find((item) => item.id === this.selectedExamenId())
  );

  readonly selectedCollaborator = computed(() =>
    this.colaboradores().find((c) => c.id === this.selectedCollaboratorId())
  );

  readonly quickExercises = computed(() =>
    this.quickExercisePeriod() === "proximos"
      ? this.proximosEjercicios()
      : this.anterioresEjercicios()
  );

  readonly activeFiltersCount = computed(() =>
    [
      this.profileFilter(),
      this.scopeFilter(),
      this.confirmationFilter(),
      this.centerFilter(),
    ].filter(Boolean).length
  );

  readonly filteredAssignments = computed(() => {
    const query = this.assignmentSearch().trim().toLocaleLowerCase("es");
    const profile = this.profileFilter();
    const scope = this.scopeFilter();
    const confirmation = this.confirmationFilter();
    const center = this.centerFilter();

    const filtered = this.asignaciones().filter((item) => {
      if (profile && item.perfilId !== profile) return false;
      if (scope === "GENERAL" && item.examenAulaId) return false;
      if (scope === "AULA" && !item.examenAulaId) return false;
      if (confirmation && item.estadoConfirmacion !== confirmation) return false;
      if (center && (item.centroNombre || "Sin centro") !== center) return false;
      if (!query) return true;
      return [
        item.colaboradorNombre,
        item.colaboradorDocumento,
        item.centroNombre,
        item.aulaNombre,
        item.subcategoriaGeneral,
        item.perfilDenominacion,
        this.confirmationLabel(item.estadoConfirmacion),
        item.examenAulaId ? "" : "Ámbito general",
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("es")
        .includes(query);
    });

    const col = this.sortBy();
    const dir = this.sortDirection() === "asc" ? 1 : -1;

    return filtered.sort((a, b) => {
      let comp = 0;
      switch (col) {
        case "ambito": {
          const locA = a.examenAulaId ? `${a.centroNombre || ""} ${a.aulaNombre || ""}` : `Ámbito general ${a.subcategoriaGeneral || ""}`;
          const locB = b.examenAulaId ? `${b.centroNombre || ""} ${b.aulaNombre || ""}` : `Ámbito general ${b.subcategoriaGeneral || ""}`;
          comp = locA.localeCompare(locB, "es", { sensitivity: "base" });
          break;
        }
        case "colaborador":
          comp = (a.colaboradorNombre || "").localeCompare(b.colaboradorNombre || "", "es", { sensitivity: "base" });
          break;
        case "perfil":
          comp = (a.perfilDenominacion || "").localeCompare(b.perfilDenominacion || "", "es", { sensitivity: "base" });
          break;
        case "confirmacion":
          comp = a.estadoConfirmacion.localeCompare(b.estadoConfirmacion, "es");
          break;
        case "horas": {
          const hA = a.horasRealizadas ?? -1;
          const hB = b.horasRealizadas ?? -1;
          comp = hA - hB;
          break;
        }
        case "importe": {
          const iA = a.importeTotal ?? -1;
          const iB = b.importeTotal ?? -1;
          comp = iA - iB;
          break;
        }
      }
      return comp * dir;
    });
  });

  readonly allFilteredSelected = computed(
    () =>
      this.filteredAssignments().length > 0 &&
      this.filteredAssignments().every((item) => this.selectedAssignmentIds().has(item.id))
  );

  readonly someFilteredSelected = computed(() =>
    this.filteredAssignments().some((item) => this.selectedAssignmentIds().has(item.id))
  );

  readonly processAssignments = computed(() =>
    this.asignaciones().filter((item) => !item.examenAulaId)
  );

  readonly roomGroups = computed(() =>
    this.aulas().map((aula) => ({
      aula,
      assignments: this.asignaciones().filter((item) => item.examenAulaId === aula.id),
      responsibleCount: this.asignaciones().filter(
        (item) => item.examenAulaId === aula.id && this.isResponsableAula(item.perfilCodigo)
      ).length,
      convocadosCount: this.convocados().filter(
        (item) => item.examenAulaId === aula.id && item.activo
      ).length,
    }))
  );

  readonly filteredRoomGroups = computed(() => {
    const search = this.roomSearch().trim().toLocaleLowerCase("es");
    const coverage = this.roomCoverageFilter();
    return this.roomGroups().filter((group) => {
      if (coverage === "COVERED" && group.responsibleCount === 0) return false;
      if (coverage === "UNCOVERED" && group.responsibleCount > 0) return false;
      if (!search) return true;
      const matchHeader = [group.aula.aulaNombre, group.aula.centroNombre]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("es")
        .includes(search);
      if (matchHeader) return true;
      return group.assignments.some((item) =>
        [item.colaboradorNombre, item.colaboradorDocumento, item.perfilDenominacion]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("es")
          .includes(search)
      );
    });
  });

  readonly coverage = computed(() => {
    const total = this.aulas().length;
    const covered = this.roomGroups().filter((item) => item.responsibleCount > 0).length;
    return {
      total,
      covered,
      pending: total - covered,
      percentage: total ? Math.round((covered * 100) / total) : 0,
    };
  });

  readonly confirmationSummary = computed(() => ({
    total: this.asignaciones().length,
    confirmed: this.asignaciones().filter((item) => item.estadoConfirmacion === "CONFIRMADA").length,
    pending: this.asignaciones().filter((item) => item.estadoConfirmacion === "PENDIENTE").length,
    rejected: this.asignaciones().filter((item) => item.estadoConfirmacion === "RECHAZADA").length,
  }));

  readonly duplicateCollaborators = computed(() => {
    const grouped = new Map<string, AsignacionColaborador[]>();
    for (const item of this.asignaciones())
      grouped.set(item.colaboradorId, [...(grouped.get(item.colaboradorId) || []), item]);
    return [...grouped.values()]
      .filter((items) => items.length > 1)
      .sort((a, b) =>
        (a[0].colaboradorNombre || "").localeCompare(b[0].colaboradorNombre || "", "es")
      );
  });

  ngOnInit(): void {
    this.processSearchTerms.pipe(
      startWith(""),
      debounceTime(250),
      distinctUntilChanged(),
      switchMap((search) => {
        this.processSearchLoading.set(true);
        this.processSearchError.set(null);
        this.procesos.set([]);
        this.processTotal.set(0);
        this.activeProcessIndex.set(-1);
        return this.api.listProcesos(0, 20, search).pipe(
          catchError((error: unknown) => {
            this.processSearchError.set(apiErrorMessage(error));
            return of(null);
          }),
          finalize(() => this.processSearchLoading.set(false)),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((page) => {
      if (!page) return;
      this.procesos.set(page.content);
      this.processTotal.set(page.totalElements);
      this.activeProcessIndex.set(page.content.length ? 0 : -1);
    });

    forkJoin({ perfiles: this.api.listPerfilesColaboracion(), colaboradores: this.api.listColaboradores({ estado: "ACTIVO", size: 100 }), fechas: this.api.listFechasAsignacion() })
      .pipe(finalize(() => { this.loading.set(false); this.availableDatesLoading.set(false); })).subscribe({
        next: ({ perfiles, colaboradores, fechas }) => { this.perfiles.set(perfiles); this.colaboradores.set(colaboradores.content); this.fechasDisponibles.set(fechas); },
        error: (error: unknown) => this.error.set(apiErrorMessage(error)),
      });

    this.api.getCuadroMandoAdministracion().pipe(finalize(() => this.upcomingExercisesLoading.set(false))).subscribe({
      next: (resumen) => {
        this.proximosEjercicios.set(resumen.proximosEjercicios.slice(0, 3));
        this.anterioresEjercicios.set(resumen.anterioresEjercicios.slice(0, 3));
      },
      error: () => {
        this.proximosEjercicios.set([]);
        this.anterioresEjercicios.set([]);
      },
    });
  }

  setSelectionMode(mode: SelectionMode): void {
    this.selectionMode.set(mode); this.clearContext(); this.error.set(null); this.success.set(null);
  }

  onProcessSearch(value: string): void {
    this.processQuery.set(value);
    this.upcomingSelectionRequest++; this.selectingUpcomingExerciseId.set(null);
    this.processResultsOpen.set(true);
    this.activeProcessIndex.set(0);
    const selected = this.selectedProceso();
    if (!selected || value !== this.processOptionLabel(selected)) this.clearProcessSelection();
    this.processSearchTerms.next(value);
  }

  openProcessResults(): void { this.processResultsOpen.set(true); }

  closeProcessResults(event: FocusEvent): void {
    const container = event.currentTarget as HTMLElement;
    const nextTarget = event.relatedTarget as Node | null;
    if (!nextTarget || !container.contains(nextTarget)) this.processResultsOpen.set(false);
  }

  onProcessKeydown(event: KeyboardEvent): void {
    const results = this.procesos();
    if (event.key === "Escape") {
      this.processResultsOpen.set(false);
      return;
    }
    if (!results.length || !["ArrowDown", "ArrowUp", "Enter"].includes(event.key)) return;
    if (event.key === "Enter") {
      if (this.processResultsOpen() && this.activeProcessIndex() >= 0) {
        event.preventDefault();
        this.selectProcess(results[this.activeProcessIndex()]);
      }
      return;
    }
    event.preventDefault();
    this.processResultsOpen.set(true);
    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = this.activeProcessIndex() + direction;
    this.activeProcessIndex.set(Math.max(0, Math.min(results.length - 1, nextIndex)));
  }

  selectProcess(proceso: ProcesoSelectivo, requestedExamenId = ""): void {
    this.selectedProcesoId.set(proceso.id);
    this.selectedProceso.set(proceso);
    this.processQuery.set(this.processOptionLabel(proceso));
    this.processResultsOpen.set(false);
    this.selectedExamenId.set("");
    this.examenes.set([]);
    this.clearAssignments();
    this.loadExamenes(proceso.id, requestedExamenId);
  }

  clearProcess(): void {
    this.processQuery.set("");
    this.upcomingSelectionRequest++; this.selectingUpcomingExerciseId.set(null);
    this.clearProcessSelection();
    this.processResultsOpen.set(true);
    this.processSearchTerms.next("");
  }

  setQuickExercisePeriod(period: QuickExercisePeriod): void {
    this.quickExercisePeriod.set(period);
  }

  selectQuickExercise(item: CuadroMandoEjercicio): void {
    const requestId = ++this.upcomingSelectionRequest;
    this.selectingUpcomingExerciseId.set(item.examenId);
    const proceso = this.procesos().find(value => value.id === item.procesoSelectivoId);
    if (proceso) {
      this.selectProcess(proceso, item.examenId);
      this.selectingUpcomingExerciseId.set(null);
      return;
    }
    this.api.getProceso(item.procesoSelectivoId).pipe(finalize(() => {
      if (requestId === this.upcomingSelectionRequest) this.selectingUpcomingExerciseId.set(null);
    })).subscribe({
      next: (loaded) => {
        if (requestId !== this.upcomingSelectionRequest) return;
        if (!this.procesos().some(value => value.id === loaded.id)) this.procesos.update(values => [...values, loaded]);
        this.selectProcess(loaded, item.examenId);
      },
      error: (error: unknown) => {
        if (requestId === this.upcomingSelectionRequest) this.error.set(apiErrorMessage(error));
      },
    });
  }

  onAvailableDateSelected(value: string): void {
    this.selectedDate.set(value);
    this.clearContext();
    if (value) this.loadByDate();
  }

  loadByDate(): void {    const date = this.selectedDate(); if (!date) return;
    this.clearAssignments(); this.contextLoading.set(true);
    this.api.listContextosAsignacion(date).pipe(finalize(() => this.contextLoading.set(false))).subscribe({
      next: contexts => this.contextosFecha.set(contexts), error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
  }

  selectDateContext(examenId: string): void {
    const context = this.contextosFecha().find((item) => item.examenId === examenId);
    this.selectedExamenId.set(examenId);
    if (context) {
      this.selectedProcesoId.set(context.procesoSelectivoId);
      this.selectedProceso.set(null);
      this.examenes.set([
        {
          id: context.examenId,
          procesoSelectivoId: context.procesoSelectivoId,
          nombre: context.examenNombre,
          numeroEjercicio: context.numeroEjercicio,
          fechaHora: context.fechaHora,
        },
      ]);
    }
    if (examenId) this.selectionCollapsed.set(true);
    this.loadAssignments();
  }

  selectExam(examenId: string): void {
    this.selectedExamenId.set(examenId);
    if (examenId) this.selectionCollapsed.set(true);
    this.loadAssignments();
  }

  toggleSelectionCollapse(): void {
    this.selectionCollapsed.update((v) => !v);
  }

  expandSelection(): void {
    this.selectionCollapsed.set(false);
  }

  toggleDrawerExpand(): void {
    this.drawerExpanded.update((v) => !v);
  }

  loadAssignments(): void {
    const examId = this.selectedExamenId();
    if (!examId) {
      this.clearAssignments();
      return;
    }
    const requestId = ++this.assignmentLoadRequest;
    this.contextLoading.set(true);
    this.closeForm();
    this.error.set(null);
    forkJoin({
      aulas: this.api.listExamenAulas(examId),
      asignaciones: this.api.listAsignaciones(examId),
      convocados: this.api.listConvocadosByExamen(examId),
    }).subscribe({
      next: ({ aulas, asignaciones, convocados }) => {
        if (requestId !== this.assignmentLoadRequest || examId !== this.selectedExamenId()) return;
        this.aulas.set(aulas);
        this.asignaciones.set(asignaciones);
        this.convocados.set(convocados);
        this.clearTableSelection();
        this.contextLoading.set(false);
      },
      error: (error: unknown) => {
        if (requestId !== this.assignmentLoadRequest || examId !== this.selectedExamenId()) return;
        this.contextLoading.set(false);
        this.error.set(apiErrorMessage(error));
      },
    });
  }

  startCreate(aula?: ExamenAula): void {
    this.startCreateForScope(aula ? "AULA" : "GENERAL", aula);
  }

  startCreateForScope(scope: "AULA" | "GENERAL", aula?: ExamenAula): void {
    const center = aula?.centroNombre || (scope === "AULA" ? this.centers()[0] || "" : "");
    this.closeCreateAulaDrawer();
    this.closeRenameAulaDrawer();
    this.editing.set(null);
    this.fieldErrors.set({});
    this.selectedCenter.set(center);
    this.resetCollaboratorSearch();
    this.form.reset({
      ambito: scope,
      centro: center,
      examenAulaId: aula?.id || "",
      colaboradorId: "",
      perfilId: "",
      subcategoriaGeneral: "",
      estadoConfirmacion: "PENDIENTE",
      horasRealizadas: null,
    });
    this.formOpen.set(true);
    this.resetDrawerScroll();
    this.success.set(null);
  }

  startEdit(item: AsignacionColaborador): void {
    this.closeCreateAulaDrawer();
    this.closeRenameAulaDrawer();
    const room = this.aulas().find(aula => aula.id === item.examenAulaId);
    this.editing.set(item); this.fieldErrors.set({});
    this.selectedCenter.set(room?.centroNombre || "");
    this.selectedCollaboratorId.set(item.colaboradorId);
    this.collaboratorQuery.set(`${item.colaboradorNombre ?? "Colaborador"} · ${item.colaboradorDocumento ?? ""}`.trim());
    this.collaboratorResultsOpen.set(false); this.collaboratorSearchError.set(null);
    this.form.reset({ ambito: room ? "AULA" : "GENERAL", centro: room?.centroNombre || "", examenAulaId: item.examenAulaId || "", colaboradorId: item.colaboradorId, perfilId: item.perfilId, subcategoriaGeneral: item.subcategoriaGeneral || "", estadoConfirmacion: item.estadoConfirmacion, horasRealizadas: item.horasRealizadas ?? null });
    this.ensureCollaboratorOption(item);
    this.formOpen.set(true);
    this.resetDrawerScroll();
    this.success.set(null);
  }

  private resetDrawerScroll(): void {
    setTimeout(() => {
      const el = document.querySelector(".drawer-body");
      if (el) el.scrollTop = 0;
    }, 0);
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



  setAssignmentSearch(value: string): void { this.assignmentSearch.set(value); this.clearTableSelection(); }
  setProfileFilter(value: string): void { this.profileFilter.set(value); this.clearTableSelection(); }
  setScopeFilter(value: "" | "GENERAL" | "AULA"): void { this.scopeFilter.set(value); this.clearTableSelection(); }
  setConfirmationFilter(value: "" | EstadoConfirmacionAsignacion): void { this.confirmationFilter.set(value); this.clearTableSelection(); }
  setCenterFilter(value: string): void { this.centerFilter.set(value); this.clearTableSelection(); }
  toggleFilters(): void { this.filtersExpanded.update(v => !v); }
  resetFilters(): void {
    this.assignmentSearch.set("");
    this.profileFilter.set("");
    this.scopeFilter.set("");
    this.confirmationFilter.set("");
    this.centerFilter.set("");
    this.clearTableSelection();
  }
  clearAssignmentFilters(): void {
    this.resetFilters();
  }
  toggleSort(column: AssignmentSortColumn): void {
    if (this.sortBy() === column) {
      this.sortDirection.update(dir => dir === "asc" ? "desc" : "asc");
    } else {
      this.sortBy.set(column);
      this.sortDirection.set("asc");
    }
  }
  bulkHoursPart(): number { return Math.floor(this.bulkHours() ?? 0); }
  bulkMinutesPart(): number { return this.bulkHours() === null ? 0 : Math.round(((this.bulkHours() ?? 0) % 1) * 60); }
  setBulkTime(hours: string, minutes: string): void {
    if (hours === "" && minutes === "") { this.bulkHours.set(null); this.bulkMinutes.set(0); return; }
    const h = Math.max(0, Number(hours) || 0);
    const m = Math.min(59, Math.max(0, Number(minutes) || 0));
    this.bulkHours.set(h + m / 60);
    this.bulkMinutes.set(m);
  }
  cancelBulkSelection(): void { this.clearTableSelection(); this.bulkHours.set(null); this.bulkMinutes.set(0); }

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
    if (value.ambito === "GENERAL" && this.isResponsableAula(profile?.codigo)) errors["ambito"] = "El perfil responsable de aula requiere un aula concreta.";
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

  isResponsableAula(codigo?: string | null): boolean {
    if (!codigo) return false;
    const c = codigo.toUpperCase().trim();
    return c === "RESPONSABLE_DE_AULA" || c === "RESP_AULA_ADAP_INC" || c === "RESP. AULA ADAP_INC.";
  }

  confirmationShortLabel(value: EstadoConfirmacionAsignacion): string {
    return value === "CONFIRMADA" ? "Confirmada" : value === "RECHAZADA" ? "Rechazada" : "Pendiente";
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
    const selected = this.selectedProceso();
    const item = selected?.id === id ? selected : this.procesos().find(process => process.id === id);
    if (item) return `${item.codigoSirhus ? item.codigoSirhus + " · " : ""}${item.nombre}`;
    const context = this.contextosFecha().find(value => value.procesoSelectivoId === id);
    return context ? `${context.codigoSirhus ? context.codigoSirhus + " · " : ""}${context.procesoNombre}` : "Proceso selectivo";
  }
  formatAvailableDate(value: string): string {
    return new Intl.DateTimeFormat("es-ES", { dateStyle: "full" }).format(new Date(`${value}T12:00:00`));
  }

  formatDate(value?: string | null): string { return value ? new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Fecha pendiente"; }
  money(value?: number | null): string { return value == null ? "—" : value.toLocaleString("es-ES", { style: "currency", currency: "EUR" }); }
  maskDocument(value?: string | null): string {
    const document = (value ?? "").replace(/\s/g, "");
    return document.length >= 5 ? `****${document.slice(-5, -1)}*` : "*****";
  }
  formatHoursMinutes(value?: number | null): string {
    if (value == null) return "—";
    const totalMinutes = Math.round(value * 60);
    return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
  }
  assignmentHours(): number { return Math.floor(this.form.controls.horasRealizadas.value ?? 0); }
  assignmentMinutes(): number { return Math.round(((this.form.controls.horasRealizadas.value ?? 0) % 1) * 60); }
  setAssignmentTime(hours: string, minutes: string): void {
    const h = Math.max(0, Number(hours) || 0);
    const m = Math.min(59, Math.max(0, Number(minutes) || 0));
    this.form.controls.horasRealizadas.setValue(h + (m / 60));
  }
  setPresetHours(hours: number, minutes: number = 0): void {
    this.setAssignmentTime(hours.toString(), minutes.toString());
  }
  calculatedTotal(): { hoursFormatted: string; amountFormatted: string | null } | null {
    const rawHours = this.form.controls.horasRealizadas.value;
    if (rawHours == null || rawHours <= 0) return null;
    const h = Math.floor(rawHours);
    const m = Math.round((rawHours % 1) * 60);
    const hoursFormatted = m > 0 ? `${h} h ${m} min (${rawHours.toFixed(2)} h)` : `${h} h`;

    const perfilId = this.form.controls.perfilId.value;
    const profile = this.perfiles().find((p) => p.id === perfilId);
    const amountFormatted = profile
      ? (profile.importeHora * rawHours).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"
      : null;

    return { hoursFormatted, amountFormatted };
  }
  processOptionLabel(proceso: ProcesoSelectivo): string { return `${proceso.codigoSirhus || "Sin código SIRHUS"} · ${proceso.nombre}`; }

  // --- Panel Lateral de Creación de Aula Extraordinaria/Incidencias ---
  openCreateAulaDrawer(): void {
    if (!this.selectedExamenId()) return;
    this.closeForm();
    this.createAulaError.set(null);
    this.createAulaNombre.set("");
    this.createAulaNuevoCentroNombre.set("");
    this.createAulaIsNewCentro.set(false);
    this.createAulaCentroId.set("");

    this.api.listProvincias().subscribe({
      next: (provincias) => {
        this.modalProvincias.set(provincias);
        const existingAulaWithProv = this.aulas().find((a) => !!a.provincia);
        let defaultProv = provincias.find(
          (p) => p.nombre.toLowerCase() === existingAulaWithProv?.provincia?.toLowerCase()
        );
        if (!defaultProv && provincias.length > 0) {
          defaultProv = provincias[0];
        }
        if (defaultProv) {
          this.createAulaProvinciaId.set(defaultProv.id);
          this.loadModalCentros(defaultProv.id);
        }
      },
      error: (err) => this.createAulaError.set(apiErrorMessage(err)),
    });

    this.createAulaDrawerOpen.set(true);
    this.resetDrawerScroll();
  }

  onModalProvinciaChange(provinciaId: string): void {
    this.createAulaProvinciaId.set(provinciaId);
    this.createAulaCentroId.set("");
    this.createAulaIsNewCentro.set(false);
    this.createAulaNuevoCentroNombre.set("");
    this.loadModalCentros(provinciaId);
  }

  loadModalCentros(provinciaId: string): void {
    if (!provinciaId) {
      this.modalCentros.set([]);
      return;
    }
    this.modalCentrosLoading.set(true);
    this.api
      .listCentros(provinciaId)
      .pipe(finalize(() => this.modalCentrosLoading.set(false)))
      .subscribe({
        next: (centros) => {
          this.modalCentros.set(centros);
          const existingCenterName = this.centers()[0];
          const match = centros.find(
            (c) => c.nombre.toLowerCase() === existingCenterName?.toLowerCase()
          );
          if (match) {
            this.createAulaCentroId.set(match.id);
          } else if (centros.length > 0) {
            this.createAulaCentroId.set(centros[0].id);
          }
        },
        error: (err) => this.createAulaError.set(apiErrorMessage(err)),
      });
  }

  onModalCentroSelectChange(value: string): void {
    if (value === "__NEW__") {
      this.createAulaIsNewCentro.set(true);
      this.createAulaCentroId.set("");
    } else {
      this.createAulaIsNewCentro.set(false);
      this.createAulaCentroId.set(value);
    }
  }

  setAulaNamePreset(preset: string): void {
    this.createAulaNombre.set(preset);
  }

  closeCreateAulaDrawer(): void {
    this.createAulaDrawerOpen.set(false);
    this.createAulaError.set(null);
  }

  saveCreateAula(): void {
    const examId = this.selectedExamenId();
    if (!examId) {
      this.createAulaError.set("No hay ningún ejercicio seleccionado.");
      return;
    }
    const aulaNombre = this.createAulaNombre().trim();
    if (!aulaNombre) {
      this.createAulaError.set("Debes indicar el nombre del aula.");
      return;
    }

    const provinciaId = this.createAulaProvinciaId();
    const provincia = this.modalProvincias().find((p) => p.id === provinciaId);
    if (!provinciaId || !provincia) {
      this.createAulaError.set("Selecciona una provincia.");
      return;
    }

    this.createAulaSaving.set(true);
    this.createAulaError.set(null);

    if (this.createAulaIsNewCentro()) {
      const nuevoCentroNombre = this.createAulaNuevoCentroNombre().trim();
      if (!nuevoCentroNombre) {
        this.createAulaSaving.set(false);
        this.createAulaError.set("Debes indicar el nombre del nuevo centro.");
        return;
      }

      this.api
        .createCentro(provinciaId, { nombre: nuevoCentroNombre, activo: true })
        .pipe(
          switchMap((createdCentro) =>
            this.api
              .createAula(createdCentro.id, { nombre: aulaNombre, activo: true })
              .pipe(
                switchMap((createdAula) =>
                  this.api.createExamenAula(examId, {
                    aulaId: createdAula.id,
                    aulaNombre: createdAula.nombre,
                    centroNombre: createdCentro.nombre,
                    provincia: provincia.nombre,
                  })
                )
              )
          ),
          finalize(() => this.createAulaSaving.set(false))
        )
        .subscribe({
          next: () => {
            this.closeCreateAulaDrawer();
            this.loadAssignments();
            this.success.set(`Aula "${aulaNombre}" creada y añadida al ejercicio correctamente.`);
          },
          error: (err: unknown) => {
            this.createAulaError.set(apiErrorMessage(err));
          },
        });
    } else {
      const centroId = this.createAulaCentroId();
      const centro = this.modalCentros().find((c) => c.id === centroId);
      if (!centroId || !centro) {
        this.createAulaSaving.set(false);
        this.createAulaError.set("Selecciona un centro.");
        return;
      }

      this.api
        .createAula(centro.id, { nombre: aulaNombre, activo: true })
        .pipe(
          switchMap((createdAula) =>
            this.api.createExamenAula(examId, {
              aulaId: createdAula.id,
              aulaNombre: createdAula.nombre,
              centroNombre: centro.nombre,
              provincia: provincia.nombre,
            })
          ),
          finalize(() => this.createAulaSaving.set(false))
        )
        .subscribe({
          next: () => {
            this.closeCreateAulaDrawer();
            this.loadAssignments();
            this.success.set(`Aula "${aulaNombre}" creada y añadida al ejercicio correctamente.`);
          },
          error: (err: unknown) => {
            this.createAulaError.set(apiErrorMessage(err));
          },
        });
    }
  }

  // --- Panel Lateral de Renombrar Aula ---
  openRenameAulaDrawer(aula: ExamenAula): void {
    this.closeForm();
    this.closeCreateAulaDrawer();
    this.renameTargetExamenAula.set(aula);
    this.renameAulaNombre.set(aula.aulaNombre || "");
    this.renameAulaError.set(null);
    this.renameAulaDrawerOpen.set(true);
    this.resetDrawerScroll();
  }

  closeRenameAulaDrawer(): void {
    this.renameAulaDrawerOpen.set(false);
    this.renameTargetExamenAula.set(null);
    this.renameAulaError.set(null);
  }

  saveRenameAula(): void {
    const target = this.renameTargetExamenAula();
    if (!target) return;
    const newName = this.renameAulaNombre().trim();
    if (!newName) {
      this.renameAulaError.set("Debes indicar el nombre del aula.");
      return;
    }

    this.renameAulaSaving.set(true);
    this.renameAulaError.set(null);

    this.api
      .updateAula(target.aulaId, { nombre: newName, activo: true })
      .pipe(finalize(() => this.renameAulaSaving.set(false)))
      .subscribe({
        next: () => {
          this.closeRenameAulaDrawer();
          this.loadAssignments();
          this.success.set(`Aula renombrada correctamente a "${newName}".`);
        },
        error: (err: unknown) => {
          this.renameAulaError.set(apiErrorMessage(err));
        },
      });
  }

  // --- Eliminación de Aula del Ejercicio ---
  askDeleteAula(aula: ExamenAula): void {
    this.deleteAulaTarget.set(aula);
    this.deleteAulaError.set(null);
    this.deleteAulaDialog?.nativeElement.showModal();
  }

  closeDeleteAula(): void {
    this.deleteAulaDialog?.nativeElement.close();
    this.deleteAulaTarget.set(null);
    this.deleteAulaError.set(null);
  }

  confirmDeleteAula(): void {
    const target = this.deleteAulaTarget();
    if (!target) return;

    this.deleteAulaSaving.set(true);
    this.deleteAulaError.set(null);

    this.api
      .deleteExamenAula(target.id)
      .pipe(finalize(() => this.deleteAulaSaving.set(false)))
      .subscribe({
        next: () => {
          this.closeDeleteAula();
          this.loadAssignments();
          this.success.set(`Aula "${target.aulaNombre}" eliminada del ejercicio.`);
        },
        error: (err: unknown) => {
          this.deleteAulaError.set(apiErrorMessage(err));
        },
      });
  }

  private loadExamenes(procesoId: string, requestedExamenId = ""): void {
    const requestId = ++this.examSearchRequest;
    this.examLoading.set(true); this.error.set(null);
    this.api.listExamenes(procesoId).subscribe({
      next: (examenes) => {
        if (requestId !== this.examSearchRequest || procesoId !== this.selectedProcesoId()) return;
        this.examenes.set(examenes); this.examLoading.set(false);
        if (requestedExamenId && examenes.some(examen => examen.id === requestedExamenId)) this.selectExam(requestedExamenId);
        else if (requestedExamenId) this.error.set("El ejercicio seleccionado ya no está disponible.");
      },
      error: (error: unknown) => {
        if (requestId !== this.examSearchRequest || procesoId !== this.selectedProcesoId()) return;
        this.examenes.set([]); this.examLoading.set(false); this.error.set(apiErrorMessage(error));
      },
    });
  }
  private clearContext(): void {
    this.upcomingSelectionRequest++; this.selectingUpcomingExerciseId.set(null);
    this.processQuery.set(""); this.processResultsOpen.set(false); this.clearProcessSelection();
    this.contextosFecha.set([]);
  }
  private clearProcessSelection(): void {
    this.examSearchRequest++; this.examLoading.set(false);
    this.selectedProcesoId.set(""); this.selectedProceso.set(null); this.selectedExamenId.set(""); this.examenes.set([]); this.clearAssignments();
  }
  private clearAssignments(): void {
    this.assignmentLoadRequest++; this.contextLoading.set(false);
    this.aulas.set([]); this.asignaciones.set([]); this.convocados.set([]); this.clearTableSelection(); this.closeForm();
  }
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
