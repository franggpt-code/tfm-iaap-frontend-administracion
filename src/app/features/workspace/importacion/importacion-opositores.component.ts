import { Component, computed, DestroyRef, ElementRef, inject, OnInit, signal, ViewChild } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { catchError, debounceTime, distinctUntilChanged, finalize, of, startWith, Subject, switchMap } from "rxjs";
import { apiErrorMessage, ImportErrorDiagnostic, importErrorDiagnostic } from "../../../api/api-error";
import { SicolApiClient } from "../../../api/sicol-api-client.service";
import { Examen, ImportacionArchivos, ImportacionResultado, ProcesoSelectivo } from "../../../api/sicol.types";
import { ImportErrorPanelComponent } from "../../../shared/import-error-panel.component";

@Component({
  selector: "app-importacion-opositores",
  imports: [RouterLink, ImportErrorPanelComponent],
  templateUrl: "./importacion-opositores.component.html",
  styleUrl: "./importacion-opositores.component.scss",
})
export class ImportacionOpositoresComponent implements OnInit {
  @ViewChild("confirmationDialog") private confirmationDialog?: ElementRef<HTMLDialogElement>;

  private readonly api = inject(SicolApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly processSearchTerms = new Subject<string>();

  readonly procesos = signal<ProcesoSelectivo[]>([]);
  readonly examenes = signal<Examen[]>([]);
  readonly procesoId = signal("");
  readonly examenId = signal("");
  readonly processQuery = signal("");
  readonly processResultsOpen = signal(false);
  readonly activeProcessIndex = signal(0);
  readonly processTotal = signal(0);
  readonly processSearchError = signal<string | null>(null);
  readonly ficheroSirhus = signal<File | null>(null);
  readonly ficheroCaronte = signal<File | null>(null);
  readonly loadingProcesos = signal(true);
  readonly loadingExamenes = signal(false);
  readonly simulating = signal(false);
  readonly confirming = signal(false);
  readonly error = signal<string | null>(null);
  readonly importDiagnostic = signal<ImportErrorDiagnostic | null>(null);
  readonly fileError = signal<string | null>(null);
  readonly simulation = signal<ImportacionResultado | null>(null);
  readonly confirmed = signal<ImportacionResultado | null>(null);

  readonly canSimulate = computed(() =>
    !!this.procesoId() && !!this.examenId() && !!this.ficheroSirhus() && !this.simulating() && !this.confirming(),
  );

  readonly selectedProceso = signal<ProcesoSelectivo | null>(null);
  readonly selectedExamen = computed(() => this.examenes().find((item) => item.id === this.examenId()));

  ngOnInit(): void {
    const requestedProceso = this.route.snapshot.queryParamMap.get("procesoId") ?? "";
    const requestedExamen = this.route.snapshot.queryParamMap.get("examenId") ?? "";

    this.processSearchTerms.pipe(
      startWith(""),
      debounceTime(250),
      distinctUntilChanged(),
      switchMap((search) => {
        this.loadingProcesos.set(true);
        this.processSearchError.set(null);
        return this.api.listProcesos(0, 20, search).pipe(
          catchError((error: unknown) => {
            this.processSearchError.set(apiErrorMessage(error));
            return of(null);
          }),
          finalize(() => this.loadingProcesos.set(false)),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((page) => {
      if (!page) return;
      this.procesos.set(page.content);
      this.processTotal.set(page.totalElements);
      this.activeProcessIndex.set(page.content.length ? 0 : -1);
    });

    if (requestedProceso) {
      this.api.getProceso(requestedProceso).subscribe({
        next: (proceso) => this.selectProceso(proceso, requestedExamen),
        error: (error: unknown) => this.error.set(apiErrorMessage(error)),
      });
    }
  }

  onProcesoSearch(value: string): void {
    this.processQuery.set(value);
    this.processResultsOpen.set(true);
    this.activeProcessIndex.set(0);
    const selected = this.selectedProceso();
    if (!selected || value !== this.processLabel(selected)) {
      this.procesoId.set("");
      this.selectedProceso.set(null);
      this.examenId.set("");
      this.examenes.set([]);
      this.invalidateSimulation();
    }
    this.processSearchTerms.next(value);
  }

  openProcessResults(): void {
    if (!this.simulating() && !this.confirming()) this.processResultsOpen.set(true);
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
        this.selectProceso(results[this.activeProcessIndex()]);
      }
      return;
    }

    event.preventDefault();
    this.processResultsOpen.set(true);
    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = this.activeProcessIndex() + direction;
    this.activeProcessIndex.set(Math.max(0, Math.min(results.length - 1, nextIndex)));
  }

  selectProceso(proceso: ProcesoSelectivo, requestedExamen = ""): void {
    this.procesoId.set(proceso.id);
    this.selectedProceso.set(proceso);
    this.processQuery.set(this.processLabel(proceso));
    this.processResultsOpen.set(false);
    this.examenId.set("");
    this.examenes.set([]);
    this.invalidateSimulation();
    this.loadExamenes(proceso.id, requestedExamen);
  }

  clearProceso(): void {
    this.procesoId.set("");
    this.selectedProceso.set(null);
    this.processQuery.set("");
    this.examenId.set("");
    this.examenes.set([]);
    this.invalidateSimulation();
    this.processResultsOpen.set(true);
    this.processSearchTerms.next("");
  }

  processLabel(proceso: ProcesoSelectivo): string {
    return `${proceso.codigoSirhus || "Sin código SIRHUS"} · ${proceso.nombre}`;
  }

  formatProcessUpdatedAt(proceso: ProcesoSelectivo): string {
    const value = proceso.updatedAt ?? proceso.createdAt;
    return value
      ? `Actualizado ${new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(value))}`
      : "Sin fecha de actualización";
  }

  onExamenChange(value: string): void {
    this.examenId.set(value);
    this.invalidateSimulation();
  }

  onFile(event: Event, kind: "sirhus" | "caronte"): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.fileError.set(null);

    if (file && !/\.xlsx?$/i.test(file.name)) {
      this.fileError.set("Selecciona un fichero con extensión .xls o .xlsx.");
      input.value = "";
      if (kind === "sirhus") this.ficheroSirhus.set(null);
      else this.ficheroCaronte.set(null);
      this.invalidateSimulation();
      return;
    }

    if (kind === "sirhus") this.ficheroSirhus.set(file);
    else this.ficheroCaronte.set(file);
    this.invalidateSimulation();
  }

  simulate(): void {
    const payload = this.payload();
    if (!payload || !this.canSimulate()) return;

    this.error.set(null);
    this.importDiagnostic.set(null);
    this.confirmed.set(null);
    this.simulating.set(true);
    this.api.simularImportacion(payload).pipe(finalize(() => this.simulating.set(false))).subscribe({
      next: (result) => this.simulation.set(result),
      error: (error: unknown) => this.setImportError(error, "Simulación de convocados y aulas"),
    });
  }

  openConfirmation(): void {
    if (this.simulation()) this.confirmationDialog?.nativeElement.showModal();
  }

  closeConfirmation(): void {
    this.confirmationDialog?.nativeElement.close();
  }

  confirm(): void {
    const payload = this.payload();
    if (!payload || !this.simulation() || this.confirming()) return;

    this.error.set(null);
    this.importDiagnostic.set(null);
    this.confirming.set(true);
    this.api.confirmarImportacion(payload).pipe(finalize(() => this.confirming.set(false))).subscribe({
      next: (result) => {
        this.confirmed.set(result);
        this.simulation.set(null);
        this.closeConfirmation();
      },
      error: (error: unknown) => {
        this.setImportError(error, "Confirmación de convocados y aulas");
        this.closeConfirmation();
      },
    });
  }

  private setImportError(error: unknown, operation: string): void {
    const diagnostic = importErrorDiagnostic(error, operation, [
      { label: "Fichero SIRHUS", value: this.ficheroSirhus()?.name },
      { label: "Fichero Caronte", value: this.ficheroCaronte()?.name },
      { label: "Proceso", value: this.selectedProceso()?.nombre },
      { label: "Ejercicio", value: this.selectedExamen()?.nombre },
    ]);
    this.importDiagnostic.set(diagnostic);
    this.error.set(diagnostic.summary);
  }
  private loadExamenes(procesoId: string, requestedExamen = ""): void {
    this.loadingExamenes.set(true);
    this.api.listExamenes(procesoId).pipe(finalize(() => this.loadingExamenes.set(false))).subscribe({
      next: (items) => {
        this.examenes.set(items);
        if (requestedExamen && items.some((item) => item.id === requestedExamen)) {
          this.examenId.set(requestedExamen);
        }
      },
      error: (error: unknown) => this.setImportError(error, "Simulación de convocados y aulas"),
    });
  }

  private invalidateSimulation(): void {
    this.importDiagnostic.set(null);
    this.simulation.set(null);
    this.confirmed.set(null);
  }

  private payload(): ImportacionArchivos | null {
    const ficheroSirhus = this.ficheroSirhus();
    if (!this.procesoId() || !this.examenId() || !ficheroSirhus) return null;
    return {
      procesoSelectivoId: this.procesoId(),
      examenId: this.examenId(),
      ficheroSirhus,
      ficheroCaronte: this.ficheroCaronte(),
    };
  }
}
