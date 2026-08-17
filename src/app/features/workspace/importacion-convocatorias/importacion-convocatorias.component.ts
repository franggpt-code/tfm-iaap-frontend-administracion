import { Component, computed, ElementRef, inject, signal, ViewChild } from "@angular/core";
import { RouterLink } from "@angular/router";
import { finalize } from "rxjs";
import { apiErrorMessage } from "../../../api/api-error";
import { SicolApiClient } from "../../../api/sicol-api-client.service";
import { ImportacionDatamartResultado } from "../../../api/sicol.types";

@Component({
  selector: "app-importacion-convocatorias",
  imports: [RouterLink],
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
    this.confirmed.set(null);
    this.simulating.set(true);
    this.api.simularImportacionDatamart(file).pipe(finalize(() => this.simulating.set(false))).subscribe({
      next: (result) => this.simulation.set(result),
      error: (error: unknown) => this.error.set(apiErrorMessage(error)),
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
    this.confirming.set(true);
    this.api.confirmarImportacionDatamart(file).pipe(finalize(() => this.confirming.set(false))).subscribe({
      next: (result) => {
        this.confirmed.set(result);
        this.simulation.set(null);
        this.closeConfirmation();
      },
      error: (error: unknown) => {
        this.error.set(apiErrorMessage(error));
        this.closeConfirmation();
      },
    });
  }

  private invalidateResult(): void {
    this.simulation.set(null);
    this.confirmed.set(null);
  }
}
