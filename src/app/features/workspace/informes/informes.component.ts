import { Component, computed, DestroyRef, inject, OnInit, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { RouterLink } from "@angular/router";
import { catchError, debounceTime, distinctUntilChanged, finalize, forkJoin, of, startWith, Subject, switchMap } from "rxjs";
import { apiErrorMessage } from "../../../api/api-error";
import { SicolApiClient } from "../../../api/sicol-api-client.service";
import {
  AsignacionColaborador,
  ConfiguracionInformes,
  ConvocadoExamen,
  CuadroMandoEjercicio,
  Examen,
  HojasFirma,
  PagosColaboradores,
  ProcesoSelectivo,
  ResumenColaboraciones,
} from "../../../api/sicol.types";

export type ReportTypeId = "firmas" | "pagos";
export type ReportCategory = "operativo" | "economico" | "certificacion";
export type QuickExercisePeriod = "proximos" | "anteriores";

export interface ReportCatalogItem {
  id: ReportTypeId;
  title: string;
  subtitle: string;
  category: ReportCategory;
  categoryLabel: string;
  phase: "pre-examen" | "post-examen";
  phaseLabel: string;
  defaultPeriod: QuickExercisePeriod;
  description: string;
  badgeClass: string;
}

export interface SignaturePreviewRow {
  center: string;
  location: string;
  dni: string;
  name: string;
  profile: string;
}

export type SignatureSortField = "center" | "location" | "dni" | "name" | "profile";
export type PaymentSortField = "dni" | "nombreCompleto" | "perfilDenominacion" | "iban" | "horasRealizadas" | "importeTotal";
export type SortDirection = "asc" | "desc";
export type FirmaExportSortOrder = "centro" | "aula" | "perfil" | "nombre";

export const REPORT_CATALOG: ReportCatalogItem[] = [
  {
    id: "firmas",
    title: "Control de firmas",
    subtitle: "Asistencia manuscrita",
    category: "operativo",
    categoryLabel: "Operativo",
    phase: "pre-examen",
    phaseLabel: "Pre-examen",
    defaultPeriod: "proximos",
    description: "Hojas de firmas y horas de entrada/salida por aula.",
    badgeClass: "badge--operativo",
  },
  {
    id: "pagos",
    title: "Informe de pagos",
    subtitle: "Certificación y liquidación",
    category: "economico",
    categoryLabel: "Económico",
    phase: "post-examen",
    phaseLabel: "Post-examen",
    defaultPeriod: "anteriores",
    description: "Cálculo de importes económicos, IBAN y responsables.",
    badgeClass: "badge--economico",
  },
];

@Component({
  selector: "app-informes",
  imports: [RouterLink],
  templateUrl: "./informes.component.html",
  styleUrl: "./informes.component.scss",
})
export class InformesComponent implements OnInit {
  private readonly api = inject(SicolApiClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly processSearchTerms = new Subject<string>();

  readonly catalog = signal<ReportCatalogItem[]>(REPORT_CATALOG);
  readonly reportType = signal<ReportTypeId>("firmas");
  readonly quickExercisePeriod = signal<QuickExercisePeriod>("proximos");
  readonly selectionCollapsed = signal(false);
  readonly previewFilter = signal("");

  readonly signatureSortField = signal<SignatureSortField>("center");
  readonly signatureSortDirection = signal<SortDirection>("asc");
  readonly paymentSortField = signal<PaymentSortField>("nombreCompleto");
  readonly paymentSortDirection = signal<SortDirection>("asc");
  readonly firmaExportSortOrder = signal<FirmaExportSortOrder>("centro");

  readonly procesos = signal<ProcesoSelectivo[]>([]);
  readonly examenes = signal<Examen[]>([]);
  readonly upcomingExercises = signal<CuadroMandoEjercicio[]>([]);
  readonly previousExercises = signal<CuadroMandoEjercicio[]>([]);
  readonly asignaciones = signal<AsignacionColaborador[]>([]);
  readonly convocados = signal<ConvocadoExamen[]>([]);
  readonly resumen = signal<ResumenColaboraciones | null>(null);
  readonly hojasFirma = signal<HojasFirma | null>(null);
  readonly pagos = signal<PagosColaboradores | null>(null);
  readonly reportConfiguration = signal<ConfiguracionInformes | null>(null);

  readonly selectedProcesoId = signal("");
  readonly selectedExamenId = signal("");
  readonly selectedProcess = signal<ProcesoSelectivo | null>(null);
  readonly processQuery = signal("");
  readonly processResultsOpen = signal(false);
  readonly activeProcessIndex = signal(0);
  readonly processTotal = signal(0);
  readonly processSearchLoading = signal(true);
  readonly processSearchError = signal<string | null>(null);

  readonly loading = signal(true);
  readonly reportLoading = signal(false);
  readonly exporting = signal<ReportTypeId | null>(null);
  readonly error = signal<string | null>(null);

  /* Metadatos computados del informe seleccionado */
  readonly currentReportMeta = computed(() =>
    this.catalog().find((item) => item.id === this.reportType()) ?? this.catalog()[0]
  );

  readonly selectedExam = computed(() =>
    this.examenes().find((item) => item.id === this.selectedExamenId())
  );

  readonly quickExercises = computed(() =>
    this.quickExercisePeriod() === "proximos" ? this.upcomingExercises() : this.previousExercises()
  );

  readonly activeConvokedCount = computed(() =>
    this.convocados().filter((item) => item.activo).length
  );

  readonly missingOrZeroHours = computed(() =>
    this.asignaciones().filter(
      (item) => item.horasRealizadas == null || item.horasRealizadas <= 0
    ).length
  );

  readonly missingHours = computed(() => this.missingOrZeroHours());

  readonly totalHours = computed(() =>
    this.asignaciones().reduce((acc, item) => acc + (item.horasRealizadas ?? 0), 0)
  );

  readonly paymentHoursStatus = computed(() => {
    const total = this.asignaciones().length;
    if (total === 0) {
      return {
        isReady: false,
        message: "No hay colaboradores asignados en este ejercicio.",
      };
    }
    const pendingOrZero = this.missingOrZeroHours();
    if (pendingOrZero === total) {
      return {
        isReady: false,
        message: "Ninguna asignación tiene horas registradas (están vacías o a 0 h).",
      };
    }
    if (pendingOrZero > 0) {
      return {
        isReady: false,
        message: `${pendingOrZero} ${pendingOrZero === 1 ? "asignación tiene" : "asignaciones tienen"} las horas pendientes o a 0 (de ${total} totales).`,
      };
    }
    return {
      isReady: true,
      message: `Todas las asignaciones tienen horas calculadas (${total} asignaciones con ${this.totalHours()} h).`,
    };
  });

  readonly missingIban = computed(() =>
    this.pagos()?.pagos.filter((item) => !item.iban?.trim()).length || 0
  );

  readonly missingReportParameters = computed(() => {
    const config = this.reportConfiguration();
    if (!config) return true;
    return [
      config.organismo,
      config.localidadFirma,
      config.nombreCertifica,
      config.cargoCertifica,
      config.nombreVistoBueno,
      config.cargoVistoBueno,
    ].some(
      (value) =>
        !value?.trim() || value.toLocaleLowerCase("es").includes("pendiente de configurar")
    );
  });

  readonly signatureRows = computed<SignaturePreviewRow[]>(() => {
    const rows: SignaturePreviewRow[] = [];
    for (const center of this.hojasFirma()?.centros || []) {
      for (const room of center.aulas) {
        for (const person of room.colaboradores) {
          rows.push({
            center: center.centroNombre === "AMBITO_GENERAL" ? "Ámbito general" : center.centroNombre,
            location: room.aulaNombre === "AMBITO_GENERAL" ? "Sin subcategoría" : room.aulaNombre,
            dni: this.maskDni(person.dni),
            name: person.nombreCompleto,
            profile: person.perfilDenominacion,
          });
        }
      }
    }
    return rows;
  });

  readonly filteredSignatureRows = computed<SignaturePreviewRow[]>(() => {
    const query = this.previewFilter().trim().toLowerCase();
    let rows = this.signatureRows();
    if (query) {
      rows = rows.filter(
        (row) =>
          row.name.toLowerCase().includes(query) ||
          row.dni.toLowerCase().includes(query) ||
          row.center.toLowerCase().includes(query) ||
          row.location.toLowerCase().includes(query) ||
          row.profile.toLowerCase().includes(query)
      );
    }
    const field = this.signatureSortField();
    const dir = this.signatureSortDirection() === "asc" ? 1 : -1;
    return [...rows].sort((left, right) => {
      const valA = left[field] ?? "";
      const valB = right[field] ?? "";
      return valA.localeCompare(valB, "es", { sensitivity: "base" }) * dir;
    });
  });

  readonly filteredPaymentRows = computed(() => {
    const query = this.previewFilter().trim().toLowerCase();
    let payments = this.pagos()?.pagos || [];
    if (query) {
      payments = payments.filter(
        (payment) =>
          payment.nombreCompleto.toLowerCase().includes(query) ||
          payment.dni.toLowerCase().includes(query) ||
          payment.perfilDenominacion.toLowerCase().includes(query) ||
          (payment.iban && payment.iban.toLowerCase().includes(query))
      );
    }
    const field = this.paymentSortField();
    const dir = this.paymentSortDirection() === "asc" ? 1 : -1;
    return [...payments].sort((left, right) => {
      if (field === "horasRealizadas") {
        const valA = left.horasRealizadas ?? -1;
        const valB = right.horasRealizadas ?? -1;
        return (valA - valB) * dir;
      }
      if (field === "importeTotal") {
        const valA = left.importeTotal ?? -1;
        const valB = right.importeTotal ?? -1;
        return (valA - valB) * dir;
      }
      const valA = (left[field] as string) || "";
      const valB = (right[field] as string) || "";
      return valA.localeCompare(valB, "es", { sensitivity: "base" }) * dir;
    });
  });

  toggleSignatureSort(field: SignatureSortField): void {
    if (this.signatureSortField() === field) {
      this.signatureSortDirection.update((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      this.signatureSortField.set(field);
      this.signatureSortDirection.set("asc");
    }
  }

  togglePaymentSort(field: PaymentSortField): void {
    if (this.paymentSortField() === field) {
      this.paymentSortDirection.update((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      this.paymentSortField.set(field);
      this.paymentSortDirection.set("asc");
    }
  }

  readonly commonGaps = computed(() => {
    const process = this.selectedProcess();
    const exam = this.selectedExam();
    const gaps: string[] = [];
    if (!process?.cuerpo) gaps.push("Cuerpo o especialidad");
    if (!process?.tipoAcceso) gaps.push("Sistema de acceso");
    if (!process?.oeps?.length) gaps.push("Oferta de empleo público");
    if (!exam?.fechaHora) gaps.push("Fecha de celebración");
    return gaps;
  });

  ngOnInit(): void {
    this.processSearchTerms
      .pipe(
        startWith(""),
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((search) => {
          this.processSearchLoading.set(true);
          this.processSearchError.set(null);
          this.procesos.set([]);
          this.processTotal.set(0);
          return this.api.listProcesos(0, 20, search).pipe(
            catchError((error: unknown) => {
              this.processSearchError.set(apiErrorMessage(error));
              return of(null);
            }),
            finalize(() => this.processSearchLoading.set(false))
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((page) => {
        if (!page) return;
        this.procesos.set(page.content);
        this.processTotal.set(page.totalElements);
        this.activeProcessIndex.set(page.content.length ? 0 : -1);
      });

    forkJoin({
      configuration: this.api.getConfiguracionInformes(),
      dashboard: this.api.getCuadroMandoAdministracion(),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => {
          this.reportConfiguration.set(result.configuration);
          this.upcomingExercises.set(result.dashboard.proximosEjercicios.slice(0, 4));
          this.previousExercises.set(result.dashboard.anterioresEjercicios.slice(0, 4));
        },
        error: (error) => this.error.set(apiErrorMessage(error)),
      });
  }

  /* Paso 1: Selección del Tipo de Informe */
  selectReportType(id: ReportTypeId): void {
    if (this.reportType() === id) return;
    this.reportType.set(id);
    const meta = this.catalog().find((item) => item.id === id);
    if (meta) {
      this.quickExercisePeriod.set(meta.defaultPeriod);
    }
  }

  /* Paso 2: Selección de Proceso y Ejercicio */
  onProcessSearch(value: string): void {
    this.processQuery.set(value);
    this.processResultsOpen.set(true);
    this.activeProcessIndex.set(0);
    const selected = this.selectedProcess();
    if (!selected || value !== this.processLabel(selected)) {
      this.selectedProcesoId.set("");
      this.selectedProcess.set(null);
      this.selectedExamenId.set("");
      this.examenes.set([]);
      this.clearReport();
    }
    this.processSearchTerms.next(value);
  }

  openProcessResults(): void {
    if (!this.loading() && !this.reportLoading()) this.processResultsOpen.set(true);
  }

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

  selectProcess(process: ProcesoSelectivo, requestedExam = ""): void {
    this.selectedProcesoId.set(process.id);
    this.selectedProcess.set(process);
    this.processQuery.set(this.processLabel(process));
    this.processResultsOpen.set(false);
    this.selectedExamenId.set("");
    this.clearReport();
    this.reportLoading.set(true);
    this.api.listExamenes(process.id).subscribe({
      next: (exams) => {
        this.examenes.set(exams);
        if (requestedExam && exams.some((exam) => exam.id === requestedExam)) {
          this.selectExam(requestedExam);
          return;
        }
        this.reportLoading.set(false);
      },
      error: (error) => {
        this.reportLoading.set(false);
        this.error.set(apiErrorMessage(error));
      },
    });
  }

  clearProcess(): void {
    this.selectedProcesoId.set("");
    this.selectedProcess.set(null);
    this.processQuery.set("");
    this.selectedExamenId.set("");
    this.examenes.set([]);
    this.clearReport();
    this.selectionCollapsed.set(false);
    this.processResultsOpen.set(true);
    this.processSearchTerms.next("");
  }

  setQuickExercisePeriod(period: QuickExercisePeriod): void {
    this.quickExercisePeriod.set(period);
  }

  selectQuickExercise(item: CuadroMandoEjercicio): void {
    if (this.loading() || this.reportLoading()) return;
    const selected = this.procesos().find((process) => process.id === item.procesoSelectivoId);
    if (selected) {
      this.selectProcess(selected, item.examenId);
      return;
    }
    this.reportLoading.set(true);
    this.api.getProceso(item.procesoSelectivoId).subscribe({
      next: (process) => this.selectProcess(process, item.examenId),
      error: (error) => {
        this.reportLoading.set(false);
        this.error.set(apiErrorMessage(error));
      },
    });
  }

  selectExam(id: string): void {
    this.selectedExamenId.set(id);
    this.clearReport();
    if (!id) return;
    this.selectionCollapsed.set(true);
    this.reportLoading.set(true);
    this.error.set(null);
    forkJoin({
      asignaciones: this.api.listAsignaciones(id),
      convocados: this.api.listConvocadosByExamen(id),
      resumen: this.api.getResumenColaboraciones(id),
      hojasFirma: this.api.getHojasFirma(id),
      pagos: this.api.getPagos(id),
    })
      .pipe(finalize(() => this.reportLoading.set(false)))
      .subscribe({
        next: (result) => {
          this.asignaciones.set(result.asignaciones);
          this.convocados.set(result.convocados);
          this.resumen.set(result.resumen);
          this.hojasFirma.set(result.hojasFirma);
          this.pagos.set(result.pagos);
        },
        error: (error) => this.error.set(apiErrorMessage(error)),
      });
  }

  toggleSelectionCollapse(): void {
    this.selectionCollapsed.update((v) => !v);
  }

  expandSelection(): void {
    this.selectionCollapsed.set(false);
  }

  /* Paso 3: Exportación y Filtrado */
  onPreviewFilterChange(value: string): void {
    this.previewFilter.set(value);
  }

  exportPdf(type: ReportTypeId): void {
    const examId = this.selectedExamenId();
    if (!examId || this.exporting()) return;
    this.exporting.set(type);
    this.error.set(null);
    const request =
      type === "firmas"
        ? this.api.exportHojasFirmaPdf(examId, this.firmaExportSortOrder())
        : this.api.exportPagosPdf(examId);

    request.pipe(finalize(() => this.exporting.set(null))).subscribe({
      next: (response) => {
        if (!response.body) {
          this.error.set("El informe se ha generado sin contenido.");
          return;
        }
        const url = URL.createObjectURL(response.body);
        const link = document.createElement("a");
        link.href = url;
        link.download = this.downloadFilename(response.headers.get("Content-Disposition"), type);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: (error) => this.error.set(apiErrorMessage(error)),
    });
  }

  formatDate(value?: string | null): string {
    return value
      ? new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(new Date(value))
      : "Pendiente";
  }

  formatDateTime(value?: string | null): string {
    return value
      ? new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(
          new Date(value)
        )
      : "Fecha pendiente";
  }

  money(value?: number | null): string {
    return value == null
      ? "—"
      : value.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
  }

  processLabel(process: ProcesoSelectivo): string {
    return `${process.codigoSirhus ? process.codigoSirhus + " · " : ""}${process.nombre}`;
  }

  private clearReport(): void {
    this.asignaciones.set([]);
    this.convocados.set([]);
    this.resumen.set(null);
    this.hojasFirma.set(null);
    this.pagos.set(null);
    this.previewFilter.set("");
    this.error.set(null);
  }

  private maskDni(value: string): string {
    return value.length <= 4 ? "***" : `***${value.slice(-4)}`;
  }

  private downloadFilename(disposition: string | null, type: ReportTypeId): string {
    const match = disposition?.match(/filename="?([^";]+)"?/i);
    return match?.[1] || (type === "firmas" ? "control-firmas.pdf" : "informe-pagos.pdf");
  }
}

