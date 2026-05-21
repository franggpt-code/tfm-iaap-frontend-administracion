import { Component, computed, inject, signal } from "@angular/core";
import { finalize } from "rxjs";
import { AdminApiService } from "../../../core/admin-api.service";
import { ImportacionDatosBaseResultado } from "../../../core/api.models";
import { errorMessage } from "../shared/admin-ui";

interface ImportacionContador {
  label: string;
  value: number;
}

@Component({
  selector: "app-importaciones",
  templateUrl: "./importaciones.component.html",
  styleUrl: "../admin-pages.scss",
})
export class ImportacionesComponent {
  private static readonly allowedExtensions = [".ods", ".xlsx", ".xlsm", ".xls"];
  private readonly api = inject(AdminApiService);

  readonly selectedFile = signal<File | null>(null);
  readonly fileError = signal<string | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly result = signal<ImportacionDatosBaseResultado | null>(null);

  readonly selectedFileName = computed(() => this.selectedFile()?.name ?? "Ningún fichero seleccionado");
  readonly canImport = computed(() => !!this.selectedFile() && !this.fileError() && !this.loading());
  readonly counters = computed<ImportacionContador[]>(() => {
    const result = this.result();
    if (!result) {
      return [];
    }
    return [
      { label: "Perfiles importados", value: result.perfilesImportados },
      { label: "Procesos detectados", value: result.procesosDetectados },
      { label: "Exámenes importados", value: result.examenesImportados },
      { label: "Aulas importadas", value: result.aulasImportadas },
      { label: "Colaboradores importados", value: result.colaboradoresImportados },
    ];
  });

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.result.set(null);
    this.error.set(null);
    this.fileError.set(null);
    this.selectedFile.set(file);

    if (!file) {
      return;
    }

    const fileName = file.name.toLowerCase();
    const isAllowed = ImportacionesComponent.allowedExtensions.some((extension) => fileName.endsWith(extension));
    if (!isAllowed) {
      this.selectedFile.set(null);
      this.fileError.set("Selecciona un fichero .ods, .xlsx, .xlsm o .xls.");
      input.value = "";
    }
  }

  clearFile(input: HTMLInputElement): void {
    input.value = "";
    this.selectedFile.set(null);
    this.fileError.set(null);
    this.result.set(null);
    this.error.set(null);
  }

  import(): void {
    const file = this.selectedFile();
    if (!file) {
      this.fileError.set("Selecciona un fichero antes de iniciar la importación.");
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.result.set(null);
    this.api
      .importDatosBase(file)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => this.result.set(result),
        error: (error) => this.error.set(errorMessage(error, "No se ha podido importar la plantilla. Revisa el formato y vuelve a intentarlo.")),
      });
  }
}
