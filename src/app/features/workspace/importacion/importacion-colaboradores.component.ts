import { Component, computed, ElementRef, inject, signal, ViewChild } from "@angular/core";
import { RouterLink } from "@angular/router";
import { finalize } from "rxjs";
import { ImportErrorDiagnostic, importErrorDiagnostic } from "../../../api/api-error";
import { SicolApiClient } from "../../../api/sicol-api-client.service";
import { ImportacionColaboradoresResultado } from "../../../api/sicol.types";
import { ImportErrorPanelComponent } from "../../../shared/import-error-panel.component";

@Component({
  selector: "app-importacion-colaboradores",
  imports: [RouterLink, ImportErrorPanelComponent],
  templateUrl: "./importacion-colaboradores.component.html",
  styleUrl: "./importacion-colaboradores.component.scss",
})
export class ImportacionColaboradoresComponent {
  @ViewChild("confirmationDialog") private confirmationDialog?: ElementRef<HTMLDialogElement>;
  private readonly api = inject(SicolApiClient);

  readonly fichero = signal<File | null>(null);
  readonly actualizarExistentes = signal(true);
  readonly simulating = signal(false);
  readonly confirming = signal(false);
  readonly fileError = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly diagnostic = signal<ImportErrorDiagnostic | null>(null);
  readonly simulation = signal<ImportacionColaboradoresResultado | null>(null);
  readonly confirmed = signal<ImportacionColaboradoresResultado | null>(null);
  readonly canSimulate = computed(() => !!this.fichero() && !this.simulating() && !this.confirming());

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.resetResults();
    this.fileError.set(null);
    if (file && !/\.(xlsx|xls|xlsm)$/i.test(file.name)) {
      this.fileError.set("Selecciona un fichero Excel con extensión XLSX, XLS o XLSM.");
      input.value = "";
      this.fichero.set(null);
      return;
    }
    this.fichero.set(file);
  }

  onActualizarExistentes(event: Event): void {
    this.actualizarExistentes.set((event.target as HTMLInputElement).checked);
    this.resetResults();
  }

  simulate(): void {
    const file = this.fichero();
    if (!file || !this.canSimulate()) return;
    this.error.set(null);
    this.diagnostic.set(null);
    this.simulating.set(true);
    this.api.simularImportacionColaboradores(file, this.actualizarExistentes())
      .pipe(finalize(() => this.simulating.set(false)))
      .subscribe({
        next: result => this.simulation.set(result),
        error: error => this.setError(error, "Simulación de colaboradores"),
      });
  }

  openConfirmation(): void { if (this.simulation()) this.confirmationDialog?.nativeElement.showModal(); }
  closeConfirmation(): void { this.confirmationDialog?.nativeElement.close(); }

  confirm(): void {
    const file = this.fichero();
    if (!file || !this.simulation() || this.confirming()) return;
    this.error.set(null);
    this.diagnostic.set(null);
    this.confirming.set(true);
    this.api.confirmarImportacionColaboradores(file, this.actualizarExistentes())
      .pipe(finalize(() => this.confirming.set(false)))
      .subscribe({
        next: result => { this.confirmed.set(result); this.simulation.set(null); this.closeConfirmation(); },
        error: error => { this.setError(error, "Importación de colaboradores"); this.closeConfirmation(); },
      });
  }

  private resetResults(): void {
    this.error.set(null); this.diagnostic.set(null); this.simulation.set(null); this.confirmed.set(null);
  }

  private setError(error: unknown, operation: string): void {
    const diagnostic = importErrorDiagnostic(error, operation, [{ label: "Fichero de colaboradores", value: this.fichero()?.name }]);
    this.diagnostic.set(diagnostic);
    this.error.set(diagnostic.summary);
  }
}
