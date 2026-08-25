import { Component, computed, ElementRef, inject, OnInit, signal, ViewChild } from "@angular/core";
import { RouterLink } from "@angular/router";
import { finalize } from "rxjs";
import { apiErrorMessage, ImportErrorDiagnostic, importErrorDiagnostic } from "../../../api/api-error";
import { SicolApiClient } from "../../../api/sicol-api-client.service";
import { Examen, ImportacionAsignacionesHistoricasResultado, ProcesoSelectivo } from "../../../api/sicol.types";
import { ImportErrorPanelComponent } from "../../../shared/import-error-panel.component";

@Component({
  selector: "app-importacion-asignaciones-historicas",
  imports: [RouterLink, ImportErrorPanelComponent],
  templateUrl: "./importacion-asignaciones-historicas.component.html",
  styleUrl: "./importacion-asignaciones-historicas.component.scss",
})
export class ImportacionAsignacionesHistoricasComponent implements OnInit {
  @ViewChild("confirmationDialog") private confirmationDialog?: ElementRef<HTMLDialogElement>;
  private readonly api = inject(SicolApiClient);

  readonly procesos = signal<ProcesoSelectivo[]>([]);
  readonly examenes = signal<Examen[]>([]);
  readonly procesoId = signal("");
  readonly examenId = signal("");
  readonly fichero = signal<File | null>(null);
  readonly loading = signal(true);
  readonly loadingExamenes = signal(false);
  readonly simulating = signal(false);
  readonly confirming = signal(false);
  readonly fileError = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly importDiagnostic = signal<ImportErrorDiagnostic | null>(null);
  readonly simulation = signal<ImportacionAsignacionesHistoricasResultado | null>(null);
  readonly confirmed = signal<ImportacionAsignacionesHistoricasResultado | null>(null);
  readonly selectedProceso = computed(() => this.procesos().find((item) => item.id === this.procesoId()));
  readonly selectedExamen = computed(() => this.examenes().find((item) => item.id === this.examenId()));
  readonly canSimulate = computed(() => !!this.procesoId() && !!this.examenId() && !!this.fichero() && !this.simulating() && !this.confirming());

  ngOnInit(): void {
    this.api.listProcesos(0, 200).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (page) => this.procesos.set(page.content),
      error: (error: unknown) => this.setError(error, "Carga de procesos selectivos"),
    });
  }

  onProcesoChange(value: string): void {
    this.procesoId.set(value);
    this.examenId.set("");
    this.examenes.set([]);
    this.invalidate();
    if (!value) return;
    this.loadingExamenes.set(true);
    this.api.listExamenes(value).pipe(finalize(() => this.loadingExamenes.set(false))).subscribe({
      next: (items) => this.examenes.set(items),
      error: (error: unknown) => this.setError(error, "Carga de ejercicios"),
    });
  }

  onExamenChange(value: string): void { this.examenId.set(value); this.invalidate(); }

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.fileError.set(null);
    if (file && !/\.xlsx?$/i.test(file.name)) {
      this.fileError.set("Selecciona un fichero con extensión .xls o .xlsx.");
      input.value = "";
      this.fichero.set(null);
    } else {
      this.fichero.set(file);
    }
    this.invalidate();
  }

  simulate(): void {
    const file = this.fichero();
    if (!file || !this.canSimulate()) return;
    this.error.set(null); this.importDiagnostic.set(null); this.confirmed.set(null); this.simulating.set(true);
    this.api.simularImportacionAsignacionesHistoricas(this.procesoId(), this.examenId(), file)
      .pipe(finalize(() => this.simulating.set(false))).subscribe({
        next: (result) => this.simulation.set(result),
        error: (error: unknown) => this.setError(error, "Simulación de asignaciones históricas"),
      });
  }

  openConfirmation(): void { if (this.simulation()) this.confirmationDialog?.nativeElement.showModal(); }
  closeConfirmation(): void { this.confirmationDialog?.nativeElement.close(); }

  confirm(): void {
    const file = this.fichero();
    if (!file || !this.simulation() || this.confirming()) return;
    this.error.set(null); this.importDiagnostic.set(null); this.confirming.set(true);
    this.api.confirmarImportacionAsignacionesHistoricas(this.procesoId(), this.examenId(), file)
      .pipe(finalize(() => this.confirming.set(false))).subscribe({
        next: (result) => { this.confirmed.set(result); this.simulation.set(null); this.closeConfirmation(); },
        error: (error: unknown) => { this.setError(error, "Confirmación de asignaciones históricas"); this.closeConfirmation(); },
      });
  }

  private invalidate(): void { this.simulation.set(null); this.confirmed.set(null); this.importDiagnostic.set(null); }

  private setError(error: unknown, operation: string): void {
    const diagnostic = importErrorDiagnostic(error, operation, [
      { label: "Fichero", value: this.fichero()?.name },
      { label: "Proceso", value: this.selectedProceso()?.nombre },
      { label: "Ejercicio", value: this.selectedExamen()?.nombre },
    ]);
    this.importDiagnostic.set(diagnostic);
    this.error.set(apiErrorMessage(error));
  }
}