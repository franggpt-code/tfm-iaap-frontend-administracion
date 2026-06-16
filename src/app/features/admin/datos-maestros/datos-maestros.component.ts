import { Component, computed, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { finalize } from "rxjs";
import { AdminApiService } from "../../../core/admin-api.service";
import {
  Cuerpo,
  CuerpoCreateUpdate,
  Oep,
  OepCreateUpdate,
  PerfilColaboracion,
  TipoAcceso,
  TipoAccesoCreateUpdate,
  TipoVinculacion,
  TipoVinculacionCreateUpdate,
} from "../../../core/api.models";
import { errorMessage, formatMoney } from "../shared/admin-ui";

type CatalogoDatosMaestros = "oep" | "tipos-acceso" | "tipos-vinculacion" | "cuerpos" | "perfiles";
type SortDirection = "asc" | "desc";
type OepSortColumn = "idOep" | "anio" | "descripcion" | "bojaRef";
type TipoAccesoSortColumn = "idTipoAcceso" | "codigo" | "descripcion";
type TipoVinculacionSortColumn = "idTipoVinculacion" | "codigo" | "descripcion";
type CuerpoSortColumn = "idCuerpo" | "codigo" | "grupo" | "descripcion";
type PerfilSortColumn = "id" | "codigo" | "denominacion" | "importeHora";
type SortColumn = OepSortColumn | TipoAccesoSortColumn | TipoVinculacionSortColumn | CuerpoSortColumn | PerfilSortColumn;

interface MasterDataLink {
  catalog: CatalogoDatosMaestros;
  description: string;
  icon: string;
  route: string;
  title: string;
}

@Component({
  selector: "app-datos-maestros",
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: "./datos-maestros.component.html",
  styleUrl: "../admin-pages.scss",
})
export class DatosMaestrosComponent {
  private readonly api = inject(AdminApiService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly activeCatalog = signal<CatalogoDatosMaestros | null>(null);
  readonly editorOpen = signal(false);
  readonly money = formatMoney;
  readonly oeps = signal<Oep[]>([]);
  readonly tiposAcceso = signal<TipoAcceso[]>([]);
  readonly tiposVinculacion = signal<TipoVinculacion[]>([]);
  readonly cuerpos = signal<Cuerpo[]>([]);
  readonly perfiles = signal<PerfilColaboracion[]>([]);
  readonly editingOepId = signal<number | null>(null);
  readonly editingTipoAccesoId = signal<number | null>(null);
  readonly editingTipoVinculacionId = signal<number | null>(null);
  readonly editingCuerpoId = signal<number | null>(null);
  readonly catalogTitle = computed(() => this.links.find((link) => link.catalog === this.activeCatalog())?.title);
  readonly filtersExpanded = signal(false);
  readonly oepFilters = signal({ anio: "", descripcion: "", bojaRef: "" });
  readonly tipoAccesoFilters = signal({ codigo: "", descripcion: "" });
  readonly tipoVinculacionFilters = signal({ codigo: "", descripcion: "" });
  readonly cuerpoFilters = signal({ codigo: "", grupo: "", descripcion: "" });
  readonly perfilFilters = signal({ codigo: "", denominacion: "", importeHora: "" });
  readonly sort = signal<{ column: SortColumn; direction: SortDirection }>({ column: "idOep", direction: "asc" });

  readonly filteredOeps = computed(() => {
    const filters = this.oepFilters();
    return this.sortItems(
      this.oeps().filter((item) => {
        const anio = filters.anio.trim();
        const descripcion = filters.descripcion.trim().toLowerCase();
        const bojaRef = filters.bojaRef.trim().toLowerCase();
        return (
          (!anio || String(item.anio).includes(anio)) &&
          (!descripcion || (item.descripcion ?? "").toLowerCase().includes(descripcion)) &&
          (!bojaRef || (item.bojaRef ?? "").toLowerCase().includes(bojaRef))
        );
      }),
    ) as Oep[];
  });

  readonly filteredTiposAcceso = computed(() => {
    const filters = this.tipoAccesoFilters();
    return this.sortItems(
      this.tiposAcceso().filter((item) => {
        const codigo = filters.codigo.trim().toLowerCase();
        const descripcion = filters.descripcion.trim().toLowerCase();
        return (
          (!codigo || item.codigo.toLowerCase().includes(codigo)) &&
          (!descripcion || item.descripcion.toLowerCase().includes(descripcion))
        );
      }),
    ) as TipoAcceso[];
  });

  readonly filteredTiposVinculacion = computed(() => {
    const filters = this.tipoVinculacionFilters();
    return this.sortItems(
      this.tiposVinculacion().filter((item) => {
        const codigo = filters.codigo.trim().toLowerCase();
        const descripcion = filters.descripcion.trim().toLowerCase();
        return (
          (!codigo || item.codigo.toLowerCase().includes(codigo)) &&
          (!descripcion || item.descripcion.toLowerCase().includes(descripcion))
        );
      }),
    ) as TipoVinculacion[];
  });

  readonly filteredCuerpos = computed(() => {
    const filters = this.cuerpoFilters();
    return this.sortItems(
      this.cuerpos().filter((item) => {
        const codigo = filters.codigo.trim().toLowerCase();
        const grupo = filters.grupo.trim().toLowerCase();
        const descripcion = filters.descripcion.trim().toLowerCase();
        return (
          (!codigo || item.codigo.toLowerCase().includes(codigo)) &&
          (!grupo || item.grupo.toLowerCase().includes(grupo)) &&
          (!descripcion || item.descripcion.toLowerCase().includes(descripcion))
        );
      }),
    ) as Cuerpo[];
  });

  readonly filteredPerfiles = computed(() => {
    const filters = this.perfilFilters();
    return this.sortItems(
      this.perfiles().filter((item) => {
        const codigo = filters.codigo.trim().toLowerCase();
        const denominacion = filters.denominacion.trim().toLowerCase();
        const importeHora = filters.importeHora.trim().replace(",", ".");
        return (
          (!codigo || item.codigo.toLowerCase().includes(codigo)) &&
          (!denominacion || item.denominacion.toLowerCase().includes(denominacion)) &&
          (!importeHora || String(item.importeHora).includes(importeHora))
        );
      }),
    ) as PerfilColaboracion[];
  });

  readonly activeFiltersCount = computed(() => {
    switch (this.activeCatalog()) {
      case "oep":
        return Object.values(this.oepFilters()).filter(Boolean).length;
      case "tipos-acceso":
        return Object.values(this.tipoAccesoFilters()).filter(Boolean).length;
      case "tipos-vinculacion":
        return Object.values(this.tipoVinculacionFilters()).filter(Boolean).length;
      case "cuerpos":
        return Object.values(this.cuerpoFilters()).filter(Boolean).length;
      case "perfiles":
        return Object.values(this.perfilFilters()).filter(Boolean).length;
      default:
        return 0;
    }
  });

  readonly links: MasterDataLink[] = [
    {
      catalog: "oep",
      title: "OEP",
      description: "Ofertas de empleo público disponibles para procesos selectivos.",
      icon: "fa fa-clipboard-list",
      route: "/admin/datos-maestros/oep",
    },
    {
      catalog: "tipos-acceso",
      title: "Tipos de acceso",
      description: "Catálogo de formas de acceso a los procesos selectivos.",
      icon: "fa fa-list",
      route: "/admin/datos-maestros/tipos-acceso",
    },
    {
      catalog: "tipos-vinculacion",
      title: "Tipos de vinculación",
      description: "Catálogo de relaciones y vínculos administrativos.",
      icon: "fa fa-link",
      route: "/admin/datos-maestros/tipos-vinculacion",
    },
    {
      catalog: "cuerpos",
      title: "Cuerpos",
      description: "Cuerpos, grupos y clasificaciones de personal.",
      icon: "fa fa-users",
      route: "/admin/datos-maestros/cuerpos",
    },
    {
      catalog: "perfiles",
      title: "Perfiles de colaboración",
      description: "Perfiles e importes por hora usados en asignaciones y pagos.",
      icon: "fa fa-id-badge",
      route: "/admin/datos-maestros/perfiles",
    },
  ];

  readonly oepForm = this.fb.nonNullable.group({
    anio: [new Date().getFullYear(), [Validators.required, Validators.min(2000)]],
    descripcion: [""],
    bojaRef: [""],
  });

  readonly tipoAccesoForm = this.fb.nonNullable.group({
    codigo: ["", Validators.required],
    descripcion: ["", Validators.required],
  });

  readonly tipoVinculacionForm = this.fb.nonNullable.group({
    codigo: ["", Validators.required],
    descripcion: ["", Validators.required],
  });

  readonly cuerpoForm = this.fb.nonNullable.group({
    codigo: ["", Validators.required],
    descripcion: ["", Validators.required],
    grupo: ["", Validators.required],
  });

  readonly oepFilterForm = this.fb.nonNullable.group({
    anio: [""],
    descripcion: [""],
    bojaRef: [""],
  });

  readonly tipoAccesoFilterForm = this.fb.nonNullable.group({
    codigo: [""],
    descripcion: [""],
  });

  readonly tipoVinculacionFilterForm = this.fb.nonNullable.group({
    codigo: [""],
    descripcion: [""],
  });

  readonly cuerpoFilterForm = this.fb.nonNullable.group({
    codigo: [""],
    grupo: [""],
    descripcion: [""],
  });

  readonly perfilFilterForm = this.fb.nonNullable.group({
    codigo: [""],
    denominacion: [""],
    importeHora: [""],
  });

  constructor() {
    this.oepFilterForm.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.oepFilters.set({
        anio: value.anio ?? "",
        descripcion: value.descripcion ?? "",
        bojaRef: value.bojaRef ?? "",
      });
    });
    this.tipoAccesoFilterForm.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => {
        this.tipoAccesoFilters.set({
          codigo: value.codigo ?? "",
          descripcion: value.descripcion ?? "",
        });
      });
    this.tipoVinculacionFilterForm.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => {
        this.tipoVinculacionFilters.set({
          codigo: value.codigo ?? "",
          descripcion: value.descripcion ?? "",
        });
      });
    this.cuerpoFilterForm.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.cuerpoFilters.set({
        codigo: value.codigo ?? "",
        grupo: value.grupo ?? "",
        descripcion: value.descripcion ?? "",
      });
    });
    this.perfilFilterForm.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.perfilFilters.set({
        codigo: value.codigo ?? "",
        denominacion: value.denominacion ?? "",
        importeHora: value.importeHora ?? "",
      });
    });
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const catalogo = params.get("catalogo");
      this.activeCatalog.set(this.isCatalogo(catalogo) ? catalogo : null);
      this.editorOpen.set(false);
      this.filtersExpanded.set(false);
      this.resetSort();
      this.error.set(null);
      this.success.set(null);
      this.loadDatosMaestros();
    });
  }

  toggleFilters(): void {
    this.filtersExpanded.update((expanded) => !expanded);
  }

  openCreate(): void {
    switch (this.activeCatalog()) {
      case "oep":
        this.newOep();
        break;
      case "tipos-acceso":
        this.newTipoAcceso();
        break;
      case "tipos-vinculacion":
        this.newTipoVinculacion();
        break;
      case "cuerpos":
        this.newCuerpo();
        break;
      case "perfiles":
        break;
    }
    this.editorOpen.set(true);
  }

  closeEditor(): void {
    this.editorOpen.set(false);
  }

  resetFilters(): void {
    switch (this.activeCatalog()) {
      case "oep":
        this.oepFilterForm.reset({ anio: "", descripcion: "", bojaRef: "" });
        break;
      case "tipos-acceso":
        this.tipoAccesoFilterForm.reset({ codigo: "", descripcion: "" });
        break;
      case "tipos-vinculacion":
        this.tipoVinculacionFilterForm.reset({ codigo: "", descripcion: "" });
        break;
      case "cuerpos":
        this.cuerpoFilterForm.reset({ codigo: "", grupo: "", descripcion: "" });
        break;
      case "perfiles":
        this.perfilFilterForm.reset({ codigo: "", denominacion: "", importeHora: "" });
        break;
    }
  }

  onSort(column: SortColumn): void {
    const current = this.sort();
    const direction: SortDirection = current.column === column && current.direction === "asc" ? "desc" : "asc";
    this.sort.set({ column, direction });
  }

  getAriaSort(column: SortColumn): "ascending" | "descending" | "none" {
    const current = this.sort();
    if (current.column !== column) {
      return "none";
    }
    return current.direction === "asc" ? "ascending" : "descending";
  }

  getSortIcon(column: SortColumn): string {
    const current = this.sort();
    if (current.column !== column) {
      return "fa fa-sort";
    }
    return current.direction === "asc" ? "fa fa-sort-up" : "fa fa-sort-down";
  }

  loadDatosMaestros(): void {
    switch (this.activeCatalog()) {
      case "oep":
        this.loadOep();
        break;
      case "tipos-acceso":
        this.loadTiposAcceso();
        break;
      case "tipos-vinculacion":
        this.loadTiposVinculacion();
        break;
      case "cuerpos":
        this.loadCuerpos();
        break;
      case "perfiles":
        this.loadPerfiles();
        break;
      default:
        this.loading.set(false);
        break;
    }
  }

  loadOep(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .listOep()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (oeps) => this.oeps.set(oeps),
        error: (error) => this.error.set(errorMessage(error, "No se han podido cargar las OEP.")),
      });
  }

  loadTiposAcceso(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .listTiposAcceso()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (tipos) => this.tiposAcceso.set(tipos),
        error: (error) => this.error.set(errorMessage(error, "No se han podido cargar los tipos de acceso.")),
      });
  }

  loadTiposVinculacion(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .listTiposVinculacion()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (tipos) => this.tiposVinculacion.set(tipos),
        error: (error) => this.error.set(errorMessage(error, "No se han podido cargar los tipos de vinculación.")),
      });
  }

  loadCuerpos(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .listCuerpos()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (cuerpos) => this.cuerpos.set(cuerpos),
        error: (error) => this.error.set(errorMessage(error, "No se han podido cargar los cuerpos.")),
      });
  }

  loadPerfiles(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .listPerfilesColaboracion()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (perfiles) => this.perfiles.set(perfiles),
        error: (error) => this.error.set(errorMessage(error, "No se han podido cargar los perfiles de colaboración.")),
      });
  }

  newOep(): void {
    this.editingOepId.set(null);
    this.oepForm.reset({
      anio: new Date().getFullYear(),
      descripcion: "",
      bojaRef: "",
    });
  }

  editOep(oep: Oep): void {
    this.editingOepId.set(oep.idOep);
    this.editorOpen.set(true);
    this.oepForm.setValue({
      anio: oep.anio,
      descripcion: oep.descripcion ?? "",
      bojaRef: oep.bojaRef ?? "",
    });
  }

  saveOep(): void {
    if (this.oepForm.invalid) {
      this.oepForm.markAllAsTouched();
      return;
    }
    const id = this.editingOepId();
    const value = this.oepForm.getRawValue();
    const request: OepCreateUpdate = {
      anio: value.anio,
      descripcion: value.descripcion,
      bojaRef: value.bojaRef,
    };
    const operation = id ? this.api.updateOep(id, request) : this.api.createOep(request);
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    operation.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.success.set(id ? "OEP actualizada correctamente." : "OEP creada correctamente.");
        this.newOep();
        this.loadOep();
      },
      error: (error) => this.error.set(errorMessage(error, "No se ha podido guardar la OEP.")),
    });
  }

  deleteOep(oep: Oep): void {
    if (!confirm(`¿Eliminar la OEP ${oep.anio}?`)) {
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.api.deleteOep(oep.idOep).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.success.set("OEP eliminada correctamente.");
        if (this.editingOepId() === oep.idOep) {
          this.newOep();
        }
        this.loadOep();
      },
      error: (error) => this.error.set(errorMessage(error, "No se ha podido eliminar la OEP.")),
    });
  }

  newTipoAcceso(): void {
    this.editingTipoAccesoId.set(null);
    this.tipoAccesoForm.reset({ codigo: "", descripcion: "" });
  }

  editTipoAcceso(tipo: TipoAcceso): void {
    this.editingTipoAccesoId.set(tipo.idTipoAcceso);
    this.editorOpen.set(true);
    this.tipoAccesoForm.setValue({
      codigo: tipo.codigo,
      descripcion: tipo.descripcion,
    });
  }

  saveTipoAcceso(): void {
    if (this.tipoAccesoForm.invalid) {
      this.tipoAccesoForm.markAllAsTouched();
      return;
    }
    const id = this.editingTipoAccesoId();
    const request: TipoAccesoCreateUpdate = this.tipoAccesoForm.getRawValue();
    const operation = id ? this.api.updateTipoAcceso(id, request) : this.api.createTipoAcceso(request);
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    operation.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.success.set(id ? "Tipo de acceso actualizado correctamente." : "Tipo de acceso creado correctamente.");
        this.newTipoAcceso();
        this.loadTiposAcceso();
      },
      error: (error) => this.error.set(errorMessage(error, "No se ha podido guardar el tipo de acceso.")),
    });
  }

  deleteTipoAcceso(tipo: TipoAcceso): void {
    if (!confirm(`¿Eliminar el tipo de acceso ${tipo.codigo}?`)) {
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.api.deleteTipoAcceso(tipo.idTipoAcceso).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.success.set("Tipo de acceso eliminado correctamente.");
        if (this.editingTipoAccesoId() === tipo.idTipoAcceso) {
          this.newTipoAcceso();
        }
        this.loadTiposAcceso();
      },
      error: (error) => this.error.set(errorMessage(error, "No se ha podido eliminar el tipo de acceso.")),
    });
  }

  newTipoVinculacion(): void {
    this.editingTipoVinculacionId.set(null);
    this.tipoVinculacionForm.reset({ codigo: "", descripcion: "" });
  }

  editTipoVinculacion(tipo: TipoVinculacion): void {
    this.editingTipoVinculacionId.set(tipo.idTipoVinculacion);
    this.editorOpen.set(true);
    this.tipoVinculacionForm.setValue({
      codigo: tipo.codigo,
      descripcion: tipo.descripcion,
    });
  }

  saveTipoVinculacion(): void {
    if (this.tipoVinculacionForm.invalid) {
      this.tipoVinculacionForm.markAllAsTouched();
      return;
    }
    const id = this.editingTipoVinculacionId();
    const request: TipoVinculacionCreateUpdate = this.tipoVinculacionForm.getRawValue();
    const operation = id
      ? this.api.updateTipoVinculacion(id, request)
      : this.api.createTipoVinculacion(request);
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    operation.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.success.set(
          id ? "Tipo de vinculación actualizado correctamente." : "Tipo de vinculación creado correctamente.",
        );
        this.newTipoVinculacion();
        this.loadTiposVinculacion();
      },
      error: (error) => this.error.set(errorMessage(error, "No se ha podido guardar el tipo de vinculación.")),
    });
  }

  deleteTipoVinculacion(tipo: TipoVinculacion): void {
    if (!confirm(`¿Eliminar el tipo de vinculación ${tipo.codigo}?`)) {
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.api.deleteTipoVinculacion(tipo.idTipoVinculacion).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.success.set("Tipo de vinculación eliminado correctamente.");
        if (this.editingTipoVinculacionId() === tipo.idTipoVinculacion) {
          this.newTipoVinculacion();
        }
        this.loadTiposVinculacion();
      },
      error: (error) => this.error.set(errorMessage(error, "No se ha podido eliminar el tipo de vinculación.")),
    });
  }

  newCuerpo(): void {
    this.editingCuerpoId.set(null);
    this.cuerpoForm.reset({ codigo: "", descripcion: "", grupo: "" });
  }

  editCuerpo(cuerpo: Cuerpo): void {
    this.editingCuerpoId.set(cuerpo.idCuerpo);
    this.editorOpen.set(true);
    this.cuerpoForm.setValue({
      codigo: cuerpo.codigo,
      descripcion: cuerpo.descripcion,
      grupo: cuerpo.grupo,
    });
  }

  saveCuerpo(): void {
    if (this.cuerpoForm.invalid) {
      this.cuerpoForm.markAllAsTouched();
      return;
    }
    const id = this.editingCuerpoId();
    const request: CuerpoCreateUpdate = this.cuerpoForm.getRawValue();
    const operation = id ? this.api.updateCuerpo(id, request) : this.api.createCuerpo(request);
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    operation.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.success.set(id ? "Cuerpo actualizado correctamente." : "Cuerpo creado correctamente.");
        this.newCuerpo();
        this.loadCuerpos();
      },
      error: (error) => this.error.set(errorMessage(error, "No se ha podido guardar el cuerpo.")),
    });
  }

  deleteCuerpo(cuerpo: Cuerpo): void {
    if (!confirm(`¿Eliminar el cuerpo ${cuerpo.codigo}?`)) {
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.api.deleteCuerpo(cuerpo.idCuerpo).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.success.set("Cuerpo eliminado correctamente.");
        if (this.editingCuerpoId() === cuerpo.idCuerpo) {
          this.newCuerpo();
        }
        this.loadCuerpos();
      },
      error: (error) => this.error.set(errorMessage(error, "No se ha podido eliminar el cuerpo.")),
    });
  }

  private isCatalogo(value: string | null): value is CatalogoDatosMaestros {
    return (
      value === "oep" ||
      value === "tipos-acceso" ||
      value === "tipos-vinculacion" ||
      value === "cuerpos" ||
      value === "perfiles"
    );
  }

  private resetSort(): void {
    switch (this.activeCatalog()) {
      case "tipos-acceso":
        this.sort.set({ column: "idTipoAcceso", direction: "asc" });
        break;
      case "tipos-vinculacion":
        this.sort.set({ column: "idTipoVinculacion", direction: "asc" });
        break;
      case "cuerpos":
        this.sort.set({ column: "idCuerpo", direction: "asc" });
        break;
      case "perfiles":
        this.sort.set({ column: "codigo", direction: "asc" });
        break;
      default:
        this.sort.set({ column: "idOep", direction: "asc" });
        break;
    }
  }

  private sortItems<T>(items: T[]): T[] {
    const { column, direction } = this.sort();
    return [...items].sort((left, right) => {
      const result = this.compareSortValues(this.getValue(left, column), this.getValue(right, column));
      return direction === "asc" ? result : -result;
    });
  }

  private getValue(item: unknown, column: SortColumn): string | number {
    const record = item as Record<string, string | number | null | undefined>;
    return record[column] ?? "";
  }

  private compareSortValues(left: string | number, right: string | number): number {
    if (typeof left === "number" && typeof right === "number") {
      return left - right;
    }
    return String(left).localeCompare(String(right), "es", { numeric: true, sensitivity: "base" });
  }
}
