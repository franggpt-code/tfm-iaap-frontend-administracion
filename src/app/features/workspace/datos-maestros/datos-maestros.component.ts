import { Component, computed, ElementRef, inject, OnInit, signal, ViewChild } from "@angular/core";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { finalize, forkJoin, Observable } from "rxjs";
import { apiErrorMessage } from "../../../api/api-error";
import { SicolApiClient } from "../../../api/sicol-api-client.service";
import {
  Cuerpo,
  CuerpoCreateUpdate,
  Oep,
  OepCreateUpdate,
  TipoAcceso,
  TipoAccesoCreateUpdate,
  TipoVinculacion,
  TipoVinculacionCreateUpdate,
  PerfilColaboracion,
  PerfilColaboracionCreateUpdate,
  ConfiguracionInformesUpdate,
} from "../../../api/sicol.types";

type CatalogKey = "oep" | "acceso" | "vinculacion" | "cuerpos" | "perfiles";
type SectionKey = CatalogKey | "informes";
type MasterItem = Oep | TipoAcceso | TipoVinculacion | Cuerpo | PerfilColaboracion;
export type MasterSortColumn = "col1" | "col2" | "col3";
export type SortDirection = "asc" | "desc";

interface DeleteTarget {
  catalog: CatalogKey;
  item: MasterItem;
}

const CATALOGS: Record<CatalogKey, { label: string; tabLabel: string; singular: string; description: string }> = {
  oep: { label: "Ofertas de empleo público", tabLabel: "OEP", singular: "OEP", description: "Años y referencias de las ofertas de empleo público." },
  acceso: { label: "Tipos de acceso", tabLabel: "Tipos de acceso", singular: "tipo de acceso", description: "Modalidades de acceso de los procesos selectivos." },
  vinculacion: { label: "Tipos de vinculación", tabLabel: "Tipos de vinculación", singular: "tipo de vinculación", description: "Relaciones jurídicas asociadas a los procesos." },
  cuerpos: { label: "Cuerpos", tabLabel: "Cuerpos", singular: "cuerpo", description: "Códigos, grupos y denominaciones de los cuerpos." },
  perfiles: { label: "Perfiles de colaboración", tabLabel: "Perfiles", singular: "perfil de colaboración", description: "Funciones que puede desempeñar el personal colaborador y su importe por hora." },
};

@Component({
  selector: "app-datos-maestros",
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: "./datos-maestros.component.html",
  styleUrl: "./datos-maestros.component.scss",
})
export class DatosMaestrosComponent implements OnInit {
  private readonly api = inject(SicolApiClient);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);

  @ViewChild("deleteDialog") private deleteDialog?: ElementRef<HTMLDialogElement>;

  readonly catalogKeys: CatalogKey[] = ["oep", "acceso", "vinculacion", "cuerpos", "perfiles"];
  readonly catalogs = CATALOGS;
  readonly activeCatalog = signal<CatalogKey>("cuerpos");
  readonly activeSection = signal<SectionKey>("cuerpos");
  readonly oep = signal<Oep[]>([]);
  readonly tiposAcceso = signal<TipoAcceso[]>([]);
  readonly tiposVinculacion = signal<TipoVinculacion[]>([]);
  readonly cuerpos = signal<Cuerpo[]>([]);
  readonly perfiles = signal<PerfilColaboracion[]>([]);
  readonly search = signal("");
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly reportConfigSaving = signal(false);
  readonly formOpen = signal(false);
  readonly drawerExpanded = signal(false);
  readonly editingId = signal<number | string | null>(null);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly fieldErrors = signal<Record<string, string>>({});
  readonly reportConfigErrors = signal<Record<string, string>>({});
  readonly deleteTarget = signal<DeleteTarget | null>(null);

  /* Ordenación y paginación */
  readonly sortBy = signal<MasterSortColumn>("col1");
  readonly sortDirection = signal<SortDirection>("asc");
  readonly pageSize = signal<20 | 50 | 100>(20);
  readonly currentPage = signal(1);

  readonly form = this.fb.nonNullable.group({
    anio: [new Date().getFullYear()],
    descripcion: [""],
    bojaRef: [""],
    codigo: [""],
    grupo: [""],
    importeHora: [0],
  });

  readonly reportConfigForm = this.fb.nonNullable.group({
    organismo: [""],
    localidadFirma: [""],
    nombreCertifica: [""],
    cargoCertifica: [""],
    nombreVistoBueno: [""],
    cargoVistoBueno: [""],
  });

  readonly config = computed(() => CATALOGS[this.activeCatalog()]);
  readonly items = computed<MasterItem[]>(() => {
    switch (this.activeCatalog()) {
      case "oep": return this.oep();
      case "acceso": return this.tiposAcceso();
      case "vinculacion": return this.tiposVinculacion();
      case "cuerpos": return this.cuerpos();
      case "perfiles": return this.perfiles();
    }
  });

  readonly filteredItems = computed(() => {
    const query = this.search().trim().toLocaleLowerCase("es");
    if (!query) return this.items();
    return this.items().filter((item) => this.searchableText(item).includes(query));
  });

  readonly sortedItems = computed(() => {
    const list = [...this.filteredItems()];
    const col = this.sortBy();
    const dir = this.sortDirection() === "asc" ? 1 : -1;
    const cat = this.activeCatalog();

    return list.sort((a, b) => {
      let comp = 0;
      switch (col) {
        case "col1": {
          comp = this.itemCode(a).localeCompare(this.itemCode(b), "es", { numeric: true });
          break;
        }
        case "col2": {
          comp = this.itemDescription(a).localeCompare(this.itemDescription(b), "es", { sensitivity: "base" });
          break;
        }
        case "col3": {
          if (cat === "perfiles") {
            const valA = (a as PerfilColaboracion).importeHora ?? 0;
            const valB = (b as PerfilColaboracion).importeHora ?? 0;
            comp = valA - valB;
          } else {
            comp = this.itemMeta(a).localeCompare(this.itemMeta(b), "es", { numeric: true });
          }
          break;
        }
      }
      return comp * dir;
    });
  });

  readonly totalItems = computed(() => this.sortedItems().length);
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalItems() / this.pageSize())));

  readonly paginatedItems = computed(() => {
    const page = Math.min(this.currentPage(), this.totalPages());
    const size = this.pageSize();
    const start = (page - 1) * size;
    return this.sortedItems().slice(start, start + size);
  });

  readonly startIndex = computed(() => {
    if (this.totalItems() === 0) return 0;
    const page = Math.min(this.currentPage(), this.totalPages());
    return (page - 1) * this.pageSize() + 1;
  });

  readonly endIndex = computed(() => {
    const page = Math.min(this.currentPage(), this.totalPages());
    return Math.min(page * this.pageSize(), this.totalItems());
  });

  ngOnInit(): void {
    this.loadCatalogs();
  }

  selectCatalog(catalog: CatalogKey): void {
    this.activeCatalog.set(catalog);
    this.search.set("");
    this.currentPage.set(1);
    this.sortBy.set("col1");
    this.sortDirection.set("asc");
    this.cancelForm();
    this.clearMessages();
  }

  selectSection(section: SectionKey): void {
    this.activeSection.set(section);
    if (section !== "informes") {
      this.selectCatalog(section);
    } else {
      this.cancelForm();
      this.clearMessages();
    }
  }

  startCreate(): void {
    this.editingId.set(null);
    this.drawerExpanded.set(false);
    this.form.reset({ anio: new Date().getFullYear(), descripcion: "", bojaRef: "", codigo: "", grupo: "", importeHora: 0 });
    this.fieldErrors.set({});
    this.formOpen.set(true);
    this.success.set(null);
  }

  startEdit(item: MasterItem): void {
    const catalog = this.activeCatalog();
    this.editingId.set(this.itemId(catalog, item));
    this.drawerExpanded.set(false);
    if (catalog === "oep") {
      const value = item as Oep;
      this.form.reset({ anio: value.anio, descripcion: value.descripcion ?? "", bojaRef: value.bojaRef ?? "", codigo: "", grupo: "" });
    } else {
      const value = item as TipoAcceso | TipoVinculacion | Cuerpo | PerfilColaboracion;
      this.form.reset({
        anio: new Date().getFullYear(),
        descripcion: catalog === "perfiles" ? (value as PerfilColaboracion).denominacion : (value as TipoAcceso | TipoVinculacion | Cuerpo).descripcion,
        bojaRef: "",
        codigo: value.codigo,
        grupo: catalog === "cuerpos" ? (value as Cuerpo).grupo : "",
        importeHora: catalog === "perfiles" ? (value as PerfilColaboracion).importeHora : 0,
      });
    }
    this.fieldErrors.set({});
    this.formOpen.set(true);
    this.success.set(null);
  }

  cancelForm(): void {
    this.formOpen.set(false);
    this.drawerExpanded.set(false);
    this.editingId.set(null);
    this.fieldErrors.set({});
  }

  toggleDrawerExpand(): void {
    this.drawerExpanded.update(v => !v);
  }

  toggleSort(column: MasterSortColumn): void {
    if (this.sortBy() === column) {
      this.sortDirection.update(dir => dir === "asc" ? "desc" : "asc");
    } else {
      this.sortBy.set(column);
      this.sortDirection.set("asc");
    }
  }

  setPage(page: number): void {
    const target = Math.max(1, Math.min(page, this.totalPages()));
    this.currentPage.set(target);
  }

  setPageSize(size: string | number): void {
    const parsed = Number(size) as 20 | 50 | 100;
    if (parsed === 20 || parsed === 50 || parsed === 100) {
      this.pageSize.set(parsed);
      this.currentPage.set(1);
    }
  }

  onSearchChange(query: string): void {
    this.search.set(query);
    this.currentPage.set(1);
  }

  save(): void {
    const errors = this.validateForm();
    this.fieldErrors.set(errors);
    if (Object.keys(errors).length > 0) return;

    const catalog = this.activeCatalog();
    const id = this.editingId();
    this.saving.set(true);
    this.error.set(null);
    const request = id === null ? this.createRequest(catalog) : this.updateRequest(catalog, id);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (item) => {
        this.upsertItem(catalog, item);
        this.success.set(`${CATALOGS[catalog].singular === "OEP" ? "La OEP" : "El " + CATALOGS[catalog].singular} se ha guardado correctamente.`);
        this.cancelForm();
      },
      error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
  }

  askDelete(item: MasterItem): void {
    this.deleteTarget.set({ catalog: this.activeCatalog(), item });
    this.deleteDialog?.nativeElement.showModal();
  }

  closeDelete(): void {
    this.deleteDialog?.nativeElement.close();
    this.deleteTarget.set(null);
  }

  confirmDelete(): void {
    const target = this.deleteTarget();
    if (!target) return;
    this.deleting.set(true);
    this.error.set(null);
    this.deleteRequest(target.catalog, this.itemId(target.catalog, target.item))
      .pipe(finalize(() => this.deleting.set(false)))
      .subscribe({
        next: () => {
          this.removeItem(target.catalog, this.itemId(target.catalog, target.item));
          this.success.set("El registro se ha eliminado correctamente.");
          this.closeDelete();
        },
        error: (error: unknown) => {
          this.error.set(apiErrorMessage(error));
          this.closeDelete();
        },
      });
  }

  saveReportConfiguration(): void {
    const values = this.reportConfigForm.getRawValue();
    const errors: Record<string, string> = {};
    for (const [key, value] of Object.entries(values)) {
      if (!value.trim()) errors[key] = "Este campo es obligatorio.";
    }
    this.reportConfigErrors.set(errors);
    if (Object.keys(errors).length) return;
    const payload: ConfiguracionInformesUpdate = {
      organismo: values.organismo.trim(),
      localidadFirma: values.localidadFirma.trim(),
      nombreCertifica: values.nombreCertifica.trim(),
      cargoCertifica: values.cargoCertifica.trim(),
      nombreVistoBueno: values.nombreVistoBueno.trim(),
      cargoVistoBueno: values.cargoVistoBueno.trim(),
    };
    this.reportConfigSaving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.api.updateConfiguracionInformes(payload).pipe(finalize(() => this.reportConfigSaving.set(false))).subscribe({
      next: configuration => {
        this.reportConfigForm.setValue(configuration);
        this.reportConfigErrors.set({});
        this.success.set("Los parámetros de informes se han guardado correctamente.");
      },
      error: error => this.error.set(apiErrorMessage(error)),
    });
  }

  itemCode(item: MasterItem): string {
    return "codigo" in item ? item.codigo : String((item as Oep).anio);
  }

  itemDescription(item: MasterItem): string {
    return "denominacion" in item ? item.denominacion : item.descripcion ?? "Sin descripción";
  }

  itemMeta(item: MasterItem): string {
    if (this.activeCatalog() === "oep") return (item as Oep).bojaRef ?? "Sin referencia BOJA";
    if (this.activeCatalog() === "cuerpos") return `Grupo ${(item as Cuerpo).grupo}`;
    if (this.activeCatalog() === "perfiles") return `${(item as PerfilColaboracion).importeHora.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €/hora`;
    return "Catálogo activo";
  }

  private loadCatalogs(): void {
    this.loading.set(true);
    forkJoin({
      oep: this.api.listOep(),
      acceso: this.api.listTiposAcceso(),
      vinculacion: this.api.listTiposVinculacion(),
      cuerpos: this.api.listCuerpos(),
      perfiles: this.api.listPerfilesColaboracion(),
      reportConfiguration: this.api.getConfiguracionInformes(),
    }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (result) => {
        this.oep.set(result.oep);
        this.tiposAcceso.set(result.acceso);
        this.tiposVinculacion.set(result.vinculacion);
        this.cuerpos.set(result.cuerpos);
        this.perfiles.set(result.perfiles);
        this.reportConfigForm.setValue(result.reportConfiguration);
        if (this.route.snapshot.fragment === "configuracion-informes") {
          this.activeSection.set("informes");
          window.setTimeout(() => document.getElementById("configuracion-informes")?.scrollIntoView({ block: "start" }), 350);
        }
      },
      error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
  }

  private validateForm(): Record<string, string> {
    const values = this.form.getRawValue();
    const errors: Record<string, string> = {};
    if (this.activeCatalog() === "oep") {
      if (!Number.isInteger(values.anio) || values.anio < 1900 || values.anio > 2200) errors["anio"] = "Introduce un año válido.";
    } else {
      if (!values.codigo.trim()) errors["codigo"] = "Introduce el código.";
      if (!values.descripcion.trim()) errors["descripcion"] = "Introduce la descripción.";
      if (this.activeCatalog() === "cuerpos" && !values.grupo.trim()) errors["grupo"] = "Introduce el grupo.";
      if (this.activeCatalog() === "perfiles" && (!Number.isFinite(values.importeHora) || values.importeHora < 0)) errors["importeHora"] = "Introduce un importe igual o superior a 0.";
    }
    return errors;
  }

  private createRequest(catalog: CatalogKey): Observable<MasterItem> {
    switch (catalog) {
      case "oep": return this.api.createOep(this.oepPayload());
      case "acceso": return this.api.createTipoAcceso(this.codePayload());
      case "vinculacion": return this.api.createTipoVinculacion(this.codePayload());
      case "cuerpos": return this.api.createCuerpo(this.cuerpoPayload());
      case "perfiles": return this.api.createPerfilColaboracion(this.perfilPayload());
    }
  }

  private updateRequest(catalog: CatalogKey, id: number | string): Observable<MasterItem> {
    switch (catalog) {
      case "oep": return this.api.updateOep(id as number, this.oepPayload());
      case "acceso": return this.api.updateTipoAcceso(id as number, this.codePayload());
      case "vinculacion": return this.api.updateTipoVinculacion(id as number, this.codePayload());
      case "cuerpos": return this.api.updateCuerpo(id as number, this.cuerpoPayload());
      case "perfiles": return this.api.updatePerfilColaboracion(id as string, this.perfilPayload());
    }
  }

  private deleteRequest(catalog: CatalogKey, id: number | string): Observable<void> {
    switch (catalog) {
      case "oep": return this.api.deleteOep(id as number);
      case "acceso": return this.api.deleteTipoAcceso(id as number);
      case "vinculacion": return this.api.deleteTipoVinculacion(id as number);
      case "cuerpos": return this.api.deleteCuerpo(id as number);
      case "perfiles": return this.api.deletePerfilColaboracion(id as string);
    }
  }

  private oepPayload(): OepCreateUpdate {
    const value = this.form.getRawValue();
    return { anio: value.anio, descripcion: value.descripcion.trim() || undefined, bojaRef: value.bojaRef.trim() || undefined };
  }

  private codePayload(): TipoAccesoCreateUpdate | TipoVinculacionCreateUpdate {
    const value = this.form.getRawValue();
    return { codigo: value.codigo.trim(), descripcion: value.descripcion.trim() };
  }

  private cuerpoPayload(): CuerpoCreateUpdate {
    const value = this.form.getRawValue();
    return { codigo: value.codigo.trim(), descripcion: value.descripcion.trim(), grupo: value.grupo.trim() };
  }

  private perfilPayload(): PerfilColaboracionCreateUpdate {
    const value = this.form.getRawValue();
    return { codigo: value.codigo.trim().toUpperCase().replace(/\s+/g, "_"), denominacion: value.descripcion.trim(), importeHora: value.importeHora };
  }

  private itemId(catalog: CatalogKey, item: MasterItem): number | string {
    switch (catalog) {
      case "oep": return (item as Oep).idOep;
      case "acceso": return (item as TipoAcceso).idTipoAcceso;
      case "vinculacion": return (item as TipoVinculacion).idTipoVinculacion;
      case "cuerpos": return (item as Cuerpo).idCuerpo;
      case "perfiles": return (item as PerfilColaboracion).id;
    }
  }

  private searchableText(item: MasterItem): string {
    return [this.itemCode(item), this.itemDescription(item), this.itemMeta(item)].join(" ").toLocaleLowerCase("es");
  }

  private upsertItem(catalog: CatalogKey, item: MasterItem): void {
    const id = this.itemId(catalog, item);
    const update = <T extends MasterItem>(items: T[]) => [...items.filter((current) => this.itemId(catalog, current) !== id), item as T]
      .sort((left, right) => this.itemCode(left).localeCompare(this.itemCode(right), "es", { numeric: true }));
    switch (catalog) {
      case "oep": this.oep.update(update); break;
      case "acceso": this.tiposAcceso.update(update); break;
      case "vinculacion": this.tiposVinculacion.update(update); break;
      case "cuerpos": this.cuerpos.update(update); break;
      case "perfiles": this.perfiles.update(update); break;
    }
  }

  private removeItem(catalog: CatalogKey, id: number | string): void {
    const remove = <T extends MasterItem>(items: T[]) => items.filter((item) => this.itemId(catalog, item) !== id);
    switch (catalog) {
      case "oep": this.oep.update(remove); break;
      case "acceso": this.tiposAcceso.update(remove); break;
      case "vinculacion": this.tiposVinculacion.update(remove); break;
      case "cuerpos": this.cuerpos.update(remove); break;
      case "perfiles": this.perfiles.update(remove); break;
    }
  }

  private clearMessages(): void {
    this.error.set(null);
    this.success.set(null);
  }
}
