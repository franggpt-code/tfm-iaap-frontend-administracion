import { Component, computed, ElementRef, inject, signal, ViewChild } from "@angular/core";
import { RouterLink } from "@angular/router";
import { finalize } from "rxjs";
import { ImportErrorDiagnostic, importErrorDiagnostic } from "../../../api/api-error";
import { SicolApiClient } from "../../../api/sicol-api-client.service";
import { ImportacionDatamartResultado } from "../../../api/sicol.types";
import { ImportErrorPanelComponent } from "../../../shared/import-error-panel.component";

@Component({
  selector: "app-importacion-convocatorias",
  imports: [RouterLink, ImportErrorPanelComponent],
  templateUrl: "./importacion-convocatorias.component.html",
  styleUrl: "./importacion-convocatorias.component.scss",
})
export class ImportacionConvocatoriasComponent {
  @ViewChild("confirmationDialog") private confirmationDialog?: ElementRef<HTMLDialogElement>;

  private readonly api = inject(SicolApiClient);

  readonly fichero = signal<File | null>(null);
  readonly simulating = signal(false);
  readonly confirming = signal(false);
  readonly error = signal<string | null>(null);
  readonly importDiagnostic = signal<ImportErrorDiagnostic | null>(null);
  readonly fileError = signal<string | null>(null);
  readonly simulation = signal<ImportacionDatamartResultado | null>(null);
  readonly confirmed = signal<ImportacionDatamartResultado | null>(null);
  readonly canSimulate = computed(() => !!this.fichero() && !this.simulating() && !this.confirming());

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.fileError.set(null);
    this.invalidateResult();

    if (file && !/\.xls$/i.test(file.name)) {
      this.fileError.set("Selecciona el fichero original del Datamart con extensión .xls.");
      input.value = "";
      this.fichero.set(null);
      return;
    }
    this.fichero.set(file);
  }

  simulate(): void {
    const file = this.fichero();
    if (!file || !this.canSimulate()) return;
    this.error.set(null);
    this.importDiagnostic.set(null);
    this.confirmed.set(null);
    this.simulating.set(true);
    this.api.simularImportacionDatamart(file).pipe(finalize(() => this.simulating.set(false))).subscribe({
      next: (result) => this.simulation.set(result),
      error: (error: unknown) => this.setImportError(error, "Simulación del Datamart de convocatorias"),
    });
  }

  openConfirmation(): void {
    if (this.simulation()) this.confirmationDialog?.nativeElement.showModal();
  }

  closeConfirmation(): void {
    this.confirmationDialog?.nativeElement.close();
  }

  confirm(): void {
    const file = this.fichero();
    if (!file || !this.simulation() || this.confirming()) return;
    this.error.set(null);
    this.importDiagnostic.set(null);
    this.confirming.set(true);
    this.api.confirmarImportacionDatamart(file).pipe(finalize(() => this.confirming.set(false))).subscribe({
      next: (result) => {
        this.confirmed.set(result);
        this.simulation.set(null);
        this.closeConfirmation();
      },
      error: (error: unknown) => {
        this.setImportError(error, "Confirmación del Datamart de convocatorias");
        this.closeConfirmation();
      },
    });
  }

  private setImportError(error: unknown, operation: string): void {
    const diagnostic = importErrorDiagnostic(error, operation, [
      { label: "Fichero Datamart", value: this.fichero()?.name },
    ]);
    this.importDiagnostic.set(diagnostic);
    this.error.set(diagnostic.summary);
  }

  private invalidateResult(): void {
    this.importDiagnostic.set(null);
    this.simulation.set(null);
    this.confirmed.set(null);
  }
}
