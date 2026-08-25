import { Component, computed, ElementRef, inject, OnInit, signal, ViewChild } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { finalize, forkJoin } from "rxjs";
import { apiErrorMessage, ImportErrorDiagnostic, importErrorDiagnostic } from "../../../api/api-error";
import { SicolApiClient } from "../../../api/sicol-api-client.service";
import {
  Colaborador,
  ColaboradorCreate,
  ColaboradorPatch,
  EstadoColaborador,
  ImportacionColaboradoresResultado,
  PerfilColaboracion,
  SexoColaborador,
} from "../../../api/sicol.types";
import { ImportErrorPanelComponent } from "../../../shared/import-error-panel.component";

export type ColaboradorSortColumn = "colaborador" | "contacto" | "ubicacion" | "estado";
export type SortDirection = "asc" | "desc";

const ESTADOS: { value: EstadoColaborador; label: string }[] = [
  { value: "PENDIENTE_VALIDACION", label: "Pendiente de validación" },
  { value: "ACTIVO", label: "Activo" },
  { value: "SUSPENDIDO", label: "Suspendido" },
  { value: "BAJA", label: "Baja" },
];

export const PROVINCIAS_ANDALUCIA = [
  "Almería",
  "Cádiz",
  "Córdoba",
  "Granada",
  "Huelva",
  "Jaén",
  "Málaga",
  "Sevilla",
];

@Component({
  selector: "app-colaboradores",
  imports: [ReactiveFormsModule, RouterLink, ImportErrorPanelComponent],
  templateUrl: "./colaboradores.component.html",
  styleUrl: "./colaboradores.component.scss",
})
export class ColaboradoresComponent implements OnInit {
  private readonly api = inject(SicolApiClient);
  private readonly fb = inject(FormBuilder);

  @ViewChild("deleteDialog") private deleteDialog?: ElementRef<HTMLDialogElement>;
  @ViewChild("importFileInput") private importFileInput?: ElementRef<HTMLInputElement>;

  readonly estados = ESTADOS;
  readonly provincias = PROVINCIAS_ANDALUCIA;
  readonly perfiles = signal<PerfilColaboracion[]>([]);
  readonly colaboradores = signal<Colaborador[]>([]);
  readonly totalElements = signal(0);
  readonly totalPages = signal(0);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly bulkUpdating = signal(false);

  /* Paneles Laterales (Drawers) */
  readonly formOpen = signal(false);
  readonly importOpen = signal(false);
  readonly drawerExpanded = signal(false);
  readonly editing = signal<Colaborador | null>(null);
  readonly deleteTarget = signal<Colaborador | null>(null);

  /* Búsqueda y Filtros */
  readonly search = signal("");
  readonly filtersExpanded = signal(false);
  readonly estadoFilter = signal<EstadoColaborador | "">("");
  readonly rolFilter = signal<string>("");
  readonly provinciaFilter = signal<string>("");
  readonly centroDirectivoFilter = signal<"" | "yes" | "no">("");

  /* Ordenación y Paginación */
  readonly sortBy = signal<ColaboradorSortColumn>("colaborador");
  readonly sortDirection = signal<SortDirection>("asc");
  readonly pageSize = signal<20 | 50 | 100>(20);
  readonly currentPage = signal(1);

  /* Mensajes y Errores */
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly fieldErrors = signal<Record<string, string>>({});

  /* Selección masiva */
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly bulkState = signal<EstadoColaborador | "">("");

  /* Importación Excel */
  readonly selectedFile = signal<File | null>(null);
  readonly fileDragging = signal(false);
  readonly importFileError = signal<string | null>(null);
  readonly importDiagnostic = signal<ImportErrorDiagnostic | null>(null);
  readonly importResult = signal<ImportacionColaboradoresResultado | null>(null);
  readonly importBusy = signal(false);
  readonly actualizarExistentes = signal(true);

  /* Formulario Reactivo */
  readonly form = this.fb.nonNullable.group({
    dni: ["", [Validators.required, Validators.pattern(/^\d{8}$/)]],
    letra: ["", [Validators.required, Validators.pattern(/^[a-zA-Z]$/)]],
    nombreCompleto: ["", [Validators.required]],
    sexo: ["NO_INFORMA" as SexoColaborador],
    iban: ["", [Validators.required]],
    correoCorporativo: ["", [Validators.required, Validators.email]],
    telefono: ["", [Validators.required]],
    observaciones: [""],
    perteneceCentroDirectivo: [false],
    provincia: [""],
    localidad: [""],
    rolesPreferidos: [[] as string[]],
    estado: ["PENDIENTE_VALIDACION" as EstadoColaborador],
    disponibleDesde: [""],
    disponibleHasta: [""],
  });

  /* Propiedades Computadas */
  readonly activeFiltersCount = computed(() => {
    let count = 0;
    if (this.estadoFilter()) count++;
    if (this.rolFilter()) count++;
    if (this.provinciaFilter()) count++;
    if (this.centroDirectivoFilter()) count++;
    return count;
  });

  readonly allVisibleSelected = computed(() =>
    this.colaboradores().length > 0 && this.colaboradores().every(item => this.selectedIds().has(item.id))
  );

  readonly someVisibleSelected = computed(() =>
    this.colaboradores().some(item => this.selectedIds().has(item.id)) && !this.allVisibleSelected()
  );

  readonly sortedColaboradores = computed(() => {
    let list = [...this.colaboradores()];
    if (this.centroDirectivoFilter() === "yes") {
      list = list.filter(item => item.perteneceCentroDirectivo);
    } else if (this.centroDirectivoFilter() === "no") {
      list = list.filter(item => !item.perteneceCentroDirectivo);
    }

    const col = this.sortBy();
    const dir = this.sortDirection() === "asc" ? 1 : -1;

    return list.sort((a, b) => {
      let comp = 0;
      switch (col) {
        case "colaborador":
          comp = a.nombreCompleto.localeCompare(b.nombreCompleto, "es", { sensitivity: "base" });
          if (comp === 0) {
            comp = `${a.dni}${a.letra}`.localeCompare(`${b.dni}${b.letra}`, "es", { sensitivity: "base" });
          }
          break;
        case "contacto":
          comp = a.correoCorporativo.localeCompare(b.correoCorporativo, "es", { sensitivity: "base" });
          break;
        case "ubicacion":
          comp = (a.provincia || "").localeCompare(b.provincia || "", "es", { sensitivity: "base" });
          if (comp === 0) {
            comp = (a.localidad || "").localeCompare(b.localidad || "", "es", { sensitivity: "base" });
          }
          break;
        case "estado":
          comp = this.estadoLabel(a.estado).localeCompare(this.estadoLabel(b.estado), "es", { sensitivity: "base" });
          break;
      }
      return comp * dir;
    });
  });

  readonly startIndex = computed(() => {
    if (!this.totalElements()) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  });

  readonly endIndex = computed(() => {
    return Math.min(this.currentPage() * this.pageSize(), this.totalElements());
  });

  ngOnInit(): void {
    this.loadInitialData();
  }

  loadInitialData(): void {
    this.loading.set(true);
    forkJoin({
      perfiles: this.api.listPerfilesColaboracion(),
      pagina: this.api.listColaboradores({
        page: this.currentPage() - 1,
        size: this.pageSize(),
      }),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ perfiles, pagina }) => {
          this.perfiles.set(perfiles);
          this.applyPage(pagina);
        },
        error: (error: unknown) => this.error.set(apiErrorMessage(error)),
      });
  }

  fetchColaboradores(resetPage = true): void {
    if (resetPage) this.currentPage.set(1);
    this.clearSelection();
    this.loading.set(true);
    this.error.set(null);

    this.api
      .listColaboradores({
        search: this.search().trim(),
        estado: this.estadoFilter() as EstadoColaborador | "",
        rol: this.rolFilter(),
        provincia: this.provinciaFilter(),
        page: this.currentPage() - 1,
        size: this.pageSize(),
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => this.applyPage(result),
        error: (error: unknown) => this.error.set(apiErrorMessage(error)),
      });
  }

  /* Control de Filtros */
  onSearchChange(value: string): void {
    this.search.set(value);
    this.fetchColaboradores(true);
  }

  onEstadoFilterChange(value: string): void {
    this.estadoFilter.set(value as EstadoColaborador | "");
    this.fetchColaboradores(true);
  }

  onRolFilterChange(value: string): void {
    this.rolFilter.set(value);
    this.fetchColaboradores(true);
  }

  onProvinciaFilterChange(value: string): void {
    this.provinciaFilter.set(value);
    this.fetchColaboradores(true);
  }

  onCentroDirectivoFilterChange(value: string): void {
    this.centroDirectivoFilter.set(value as "" | "yes" | "no");
  }

  toggleFilters(): void {
    this.filtersExpanded.update((v) => !v);
  }

  resetFilters(): void {
    this.search.set("");
    this.estadoFilter.set("");
    this.rolFilter.set("");
    this.provinciaFilter.set("");
    this.centroDirectivoFilter.set("");
    this.fetchColaboradores(true);
  }

  /* Ordenación y Paginación */
  toggleSort(column: ColaboradorSortColumn): void {
    if (this.sortBy() === column) {
      this.sortDirection.update((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      this.sortBy.set(column);
      this.sortDirection.set("asc");
    }
  }

  setPage(pageNumber: number): void {
    if (pageNumber >= 1 && pageNumber <= this.totalPages() && pageNumber !== this.currentPage()) {
      this.currentPage.set(pageNumber);
      this.fetchColaboradores(false);
    }
  }

  setPageSize(value: string | number): void {
    const newSize = Number(value) as 20 | 50 | 100;
    if ([20, 50, 100].includes(newSize) && newSize !== this.pageSize()) {
      this.pageSize.set(newSize);
      this.fetchColaboradores(true);
    }
  }

  /* Control de Selección y Acciones Masivas */
  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggleSelection(id: string, checked: boolean): void {
    this.selectedIds.update((current) => {
      const next = new Set(current);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  }

  toggleAllVisible(checked: boolean): void {
    this.selectedIds.update((current) => {
      const next = new Set(current);
      this.colaboradores().forEach((item) => (checked ? next.add(item.id) : next.delete(item.id)));
      return next;
    });
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
    this.bulkState.set("");
  }

  applyBulkState(): void {
    const ids = [...this.selectedIds()];
    const estado = this.bulkState();
    if (!ids.length || !estado) return;

    this.bulkUpdating.set(true);
    this.error.set(null);
    this.api
      .cambiarEstadoColaboradores({ ids, estado })
      .pipe(finalize(() => this.bulkUpdating.set(false)))
      .subscribe({
        next: () => {
          this.success.set(
            `Se ha actualizado el estado de ${ids.length} ${ids.length === 1 ? "colaborador" : "colaboradores"}.`
          );
          this.clearSelection();
          this.fetchColaboradores(false);
        },
        error: (error: unknown) => this.error.set(apiErrorMessage(error)),
      });
  }

  /* Apertura y Edición de Colaborador (Drawer) */
  startCreate(): void {
    this.closeImport();
    this.editing.set(null);
    this.drawerExpanded.set(false);
    this.fieldErrors.set({});
    this.form.reset({
      dni: "",
      letra: "",
      nombreCompleto: "",
      sexo: "NO_INFORMA",
      iban: "",
      correoCorporativo: "",
      telefono: "",
      observaciones: "",
      perteneceCentroDirectivo: false,
      provincia: "",
      localidad: "",
      rolesPreferidos: [],
      estado: "PENDIENTE_VALIDACION",
      disponibleDesde: "",
      disponibleHasta: "",
    });
    this.formOpen.set(true);
    this.clearMessages();
  }

  startEdit(item: Colaborador): void {
    this.closeImport();
    this.editing.set(item);
    this.drawerExpanded.set(false);
    this.fieldErrors.set({});
    const availability = item.disponibilidad?.[0];
    this.form.reset({
      dni: item.dni,
      letra: item.letra,
      nombreCompleto: item.nombreCompleto,
      sexo: item.sexo,
      iban: item.iban ?? "",
      correoCorporativo: item.correoCorporativo,
      telefono: item.telefono ?? "",
      observaciones: item.observaciones ?? "",
      perteneceCentroDirectivo: item.perteneceCentroDirectivo,
      provincia: item.provincia ?? "",
      localidad: item.localidad ?? "",
      rolesPreferidos: item.rolesPreferidos ?? [],
      estado: item.estado,
      disponibleDesde: availability?.desde ?? "",
      disponibleHasta: availability?.hasta ?? "",
    });
    this.formOpen.set(true);
    this.clearMessages();
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.editing.set(null);
    this.drawerExpanded.set(false);
    this.fieldErrors.set({});
  }

  toggleDrawerExpand(): void {
    this.drawerExpanded.update((v) => !v);
  }

  toggleRole(code: string, checked: boolean): void {
    const current = this.form.controls.rolesPreferidos.value;
    this.form.controls.rolesPreferidos.setValue(
      checked ? [...current, code] : current.filter((item) => item !== code)
    );
  }

  hasRole(code: string): boolean {
    return this.form.controls.rolesPreferidos.value.includes(code);
  }

  save(): void {
    const errors = this.validate();
    this.fieldErrors.set(errors);
    if (Object.keys(errors).length) return;

    this.saving.set(true);
    this.error.set(null);
    const current = this.editing();
    const request = current
      ? this.api.updateColaborador(current.id, this.payload(true) as ColaboradorPatch)
      : this.api.createColaborador(this.payload(false) as ColaboradorCreate);

    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.success.set(
          current
            ? "Los datos del colaborador se han actualizado correctamente."
            : "El colaborador se ha creado y queda pendiente de validación."
        );
        this.closeForm();
        this.fetchColaboradores(false);
      },
      error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
  }

  /* Eliminación de Colaborador */
  askDelete(item: Colaborador): void {
    this.deleteTarget.set(item);
    this.deleteDialog?.nativeElement.showModal();
  }

  closeDelete(): void {
    this.deleteDialog?.nativeElement.close();
    this.deleteTarget.set(null);
  }

  confirmDelete(): void {
    const item = this.deleteTarget();
    if (!item) return;

    this.deleting.set(true);
    this.error.set(null);
    this.api
      .deleteColaborador(item.id)
      .pipe(finalize(() => this.deleting.set(false)))
      .subscribe({
        next: () => {
          this.success.set("El colaborador se ha eliminado correctamente.");
          this.closeDelete();
          if (this.formOpen() && this.editing()?.id === item.id) {
            this.closeForm();
          }
          this.fetchColaboradores(false);
        },
        error: (error: unknown) => {
          this.error.set(apiErrorMessage(error));
          this.closeDelete();
        },
      });
  }

  /* Importación desde Excel */
  openImport(): void {
    this.closeForm();
    this.importOpen.set(true);
    this.drawerExpanded.set(false);
    this.actualizarExistentes.set(true);
    this.importResult.set(null);
    this.importFileError.set(null);
    this.importDiagnostic.set(null);
    this.clearMessages();
  }

  closeImport(): void {
    this.importOpen.set(false);
    this.selectedFile.set(null);
    this.importResult.set(null);
    this.importFileError.set(null);
    this.importDiagnostic.set(null);
    this.fileDragging.set(false);
  }

  setActualizarExistentes(checked: boolean): void {
    this.actualizarExistentes.set(checked);
    this.importResult.set(null);
    this.importDiagnostic.set(null);
  }

  selectFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.acceptImportFile(input.files?.[0] ?? null);
  }

  onFileDragOver(event: DragEvent): void {
    event.preventDefault();
    if (this.importBusy()) return;
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    this.fileDragging.set(true);
  }

  onFileDragLeave(event: DragEvent): void {
    const target = event.currentTarget as HTMLElement;
    if (event.relatedTarget instanceof Node && target.contains(event.relatedTarget)) return;
    this.fileDragging.set(false);
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    this.fileDragging.set(false);
    if (this.importBusy()) return;
    this.acceptImportFile(event.dataTransfer?.files?.[0] ?? null);
  }

  removeSelectedFile(): void {
    this.selectedFile.set(null);
    this.importResult.set(null);
    this.importFileError.set(null);
    this.importDiagnostic.set(null);
    if (this.importFileInput) this.importFileInput.nativeElement.value = "";
  }

  fileSize(file: File): string {
    const kilobytes = file.size / 1024;
    return kilobytes < 1024
      ? `${Math.max(1, Math.round(kilobytes))} KB`
      : `${(kilobytes / 1024).toLocaleString("es-ES", { maximumFractionDigits: 1 })} MB`;
  }

  simulateImport(): void {
    const file = this.selectedFile();
    if (!file) return;

    this.importBusy.set(true);
    this.error.set(null);
    this.api
      .simularImportacionColaboradores(file, this.actualizarExistentes())
      .pipe(finalize(() => this.importBusy.set(false)))
      .subscribe({
        next: (result) => this.importResult.set(result),
        error: (error: unknown) => this.setImportError(error, "Validación de colaboradores"),
      });
  }

  confirmImport(): void {
    const file = this.selectedFile();
    const preview = this.importResult();
    if (!file || !preview?.filasValidas) return;

    this.importBusy.set(true);
    this.error.set(null);
    this.api
      .confirmarImportacionColaboradores(file, this.actualizarExistentes())
      .pipe(finalize(() => this.importBusy.set(false)))
      .subscribe({
        next: (result) => {
          this.importResult.set(result);
          this.success.set(
            `Importación completada: ${result.creados} colaboradores creados y ${result.actualizados} actualizados.`
          );
          this.fetchColaboradores(true);
        },
        error: (error: unknown) => this.setImportError(error, "Importación de colaboradores"),
      });
  }

  /* Etiquetas y Helpers */
  estadoLabel(value: EstadoColaborador): string {
    return ESTADOS.find((item) => item.value === value)?.label ?? value;
  }

  roleLabel(code: string): string {
    return (
      this.perfiles().find((item) => item.codigo === code)?.denominacion ??
      code.replaceAll("_", " ")
    );
  }

  isFieldInvalid(field: string): boolean {
    return !!this.fieldErrors()[field];
  }

  getFieldError(field: string): string {
    return this.fieldErrors()[field] ?? "";
  }

  clearMessages(): void {
    this.error.set(null);
    this.success.set(null);
  }

  private setImportError(error: unknown, operation: string): void {
    const diagnostic = importErrorDiagnostic(error, operation, [
      { label: "Fichero", value: this.selectedFile()?.name },
    ]);
    this.importDiagnostic.set(diagnostic);
    this.error.set(diagnostic.summary);
  }

  private acceptImportFile(file: File | null): void {
    this.importResult.set(null);
    this.importFileError.set(null);
    if (!file) {
      this.selectedFile.set(null);
      return;
    }
    if (!/\.(xlsx|xls|xlsm)$/i.test(file.name)) {
      this.selectedFile.set(null);
      this.importFileError.set("Selecciona un fichero Excel con extensión XLSX, XLS o XLSM.");
      if (this.importFileInput) this.importFileInput.nativeElement.value = "";
      return;
    }
    this.selectedFile.set(file);
  }

  private applyPage(result: {
    content: Colaborador[];
    totalElements: number;
    totalPages: number;
    page: number;
  }): void {
    this.colaboradores.set(result.content);
    this.totalElements.set(result.totalElements);
    this.totalPages.set(result.totalPages);
    this.currentPage.set(result.page + 1);
  }

  private payload(includeState: boolean): ColaboradorCreate | ColaboradorPatch {
    const value = this.form.getRawValue();
    const result: ColaboradorPatch = {
      dni: value.dni.trim(),
      letra: value.letra.trim().toUpperCase(),
      nombreCompleto: value.nombreCompleto.trim(),
      sexo: value.sexo,
      iban: value.iban.replaceAll(" ", "").toUpperCase(),
      correoCorporativo: value.correoCorporativo.trim(),
      telefono: value.telefono.trim(),
      observaciones: value.observaciones.trim(),
      perteneceCentroDirectivo: value.perteneceCentroDirectivo,
      provincia: value.provincia.trim(),
      localidad: value.localidad.trim(),
      rolesPreferidos: value.rolesPreferidos,
      disponibilidad:
        value.disponibleDesde && value.disponibleHasta
          ? [{ desde: value.disponibleDesde, hasta: value.disponibleHasta }]
          : [],
    };
    if (includeState) result.estado = value.estado;
    return result as ColaboradorCreate | ColaboradorPatch;
  }

  private validate(): Record<string, string> {
    const value = this.form.getRawValue();
    const errors: Record<string, string> = {};
    if (!/^\d{8}$/.test(value.dni.trim())) errors["dni"] = "Introduce los 8 dígitos del DNI.";
    if (!/^[a-zA-Z]$/.test(value.letra.trim())) errors["letra"] = "Introduce una letra válida.";
    if (!value.nombreCompleto.trim()) errors["nombreCompleto"] = "Introduce el nombre completo.";
    if (!value.iban.trim()) errors["iban"] = "Introduce el IBAN.";
    if (!value.telefono.trim()) errors["telefono"] = "Introduce el teléfono de contacto.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.correoCorporativo.trim())) {
      errors["correoCorporativo"] = "Introduce una dirección de correo válida.";
    }
    if (
      (value.disponibleDesde && !value.disponibleHasta) ||
      (!value.disponibleDesde && value.disponibleHasta)
    ) {
      errors["disponibilidad"] = "Indica ambas fechas de disponibilidad (desde y hasta).";
    }
    if (
      value.disponibleDesde &&
      value.disponibleHasta &&
      value.disponibleDesde > value.disponibleHasta
    ) {
      errors["disponibilidad"] = "La fecha inicial no puede ser posterior a la fecha final.";
    }
    return errors;
  }
}
