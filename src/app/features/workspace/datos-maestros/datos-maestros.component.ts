import { Component, computed, ElementRef, inject, OnInit, signal, ViewChild } from "@angular/core";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
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
} from "../../../api/sicol.types";

type CatalogKey = "oep" | "acceso" | "vinculacion" | "cuerpos";
type MasterItem = Oep | TipoAcceso | TipoVinculacion | Cuerpo;

interface DeleteTarget {
  catalog: CatalogKey;
  item: MasterItem;
}

const CATALOGS: Record<CatalogKey, { label: string; singular: string; description: string }> = {
  oep: { label: "Ofertas de empleo público", singular: "OEP", description: "Años y referencias de las ofertas de empleo público." },
  acceso: { label: "Tipos de acceso", singular: "tipo de acceso", description: "Modalidades de acceso de los procesos selectivos." },
  vinculacion: { label: "Tipos de vinculación", singular: "tipo de vinculación", description: "Relaciones jurídicas asociadas a los procesos." },
  cuerpos: { label: "Cuerpos", singular: "cuerpo", description: "Códigos, grupos y denominaciones de los cuerpos." },
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

  @ViewChild("deleteDialog") private deleteDialog?: ElementRef<HTMLDialogElement>;

  readonly catalogKeys: CatalogKey[] = ["oep", "acceso", "vinculacion", "cuerpos"];
  readonly catalogs = CATALOGS;
  readonly activeCatalog = signal<CatalogKey>("cuerpos");
  readonly oep = signal<Oep[]>([]);
  readonly tiposAcceso = signal<TipoAcceso[]>([]);
  readonly tiposVinculacion = signal<TipoVinculacion[]>([]);
  readonly cuerpos = signal<Cuerpo[]>([]);
  readonly search = signal("");
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly formOpen = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly fieldErrors = signal<Record<string, string>>({});
  readonly deleteTarget = signal<DeleteTarget | null>(null);

  readonly form = this.fb.nonNullable.group({
    anio: [new Date().getFullYear()],
    descripcion: [""],
    bojaRef: [""],
    codigo: [""],
    grupo: [""],
  });

  readonly config = computed(() => CATALOGS[this.activeCatalog()]);
  readonly items = computed<MasterItem[]>(() => {
    switch (this.activeCatalog()) {
      case "oep": return this.oep();
      case "acceso": return this.tiposAcceso();
      case "vinculacion": return this.tiposVinculacion();
      case "cuerpos": return this.cuerpos();
    }
  });
  readonly filteredItems = computed(() => {
    const query = this.search().trim().toLocaleLowerCase("es");
    if (!query) return this.items();
    return this.items().filter((item) => this.searchableText(item).includes(query));
  });

  ngOnInit(): void {
    this.loadCatalogs();
  }

  selectCatalog(catalog: CatalogKey): void {
    this.activeCatalog.set(catalog);
    this.search.set("");
    this.cancelForm();
    this.clearMessages();
  }

  startCreate(): void {
    this.editingId.set(null);
    this.form.reset({ anio: new Date().getFullYear(), descripcion: "", bojaRef: "", codigo: "", grupo: "" });
    this.fieldErrors.set({});
    this.formOpen.set(true);
    this.success.set(null);
  }

  startEdit(item: MasterItem): void {
    const catalog = this.activeCatalog();
    this.editingId.set(this.itemId(catalog, item));
    if (catalog === "oep") {
      const value = item as Oep;
      this.form.reset({ anio: value.anio, descripcion: value.descripcion ?? "", bojaRef: value.bojaRef ?? "", codigo: "", grupo: "" });
    } else {
      const value = item as TipoAcceso | TipoVinculacion | Cuerpo;
      this.form.reset({
        anio: new Date().getFullYear(),
        descripcion: value.descripcion,
        bojaRef: "",
        codigo: value.codigo,
        grupo: catalog === "cuerpos" ? (value as Cuerpo).grupo : "",
      });
    }
    this.fieldErrors.set({});
    this.formOpen.set(true);
    this.success.set(null);
  }

  cancelForm(): void {
    this.formOpen.set(false);
    this.editingId.set(null);
    this.fieldErrors.set({});
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

  itemCode(item: MasterItem): string {
    return "codigo" in item ? item.codigo : String((item as Oep).anio);
  }

  itemDescription(item: MasterItem): string {
    return item.descripcion ?? "Sin descripción";
  }

  itemMeta(item: MasterItem): string {
    if (this.activeCatalog() === "oep") return (item as Oep).bojaRef ?? "Sin referencia BOJA";
    if (this.activeCatalog() === "cuerpos") return `Grupo ${(item as Cuerpo).grupo}`;
    return "Catálogo activo";
  }

  private loadCatalogs(): void {
    this.loading.set(true);
    forkJoin({
      oep: this.api.listOep(),
      acceso: this.api.listTiposAcceso(),
      vinculacion: this.api.listTiposVinculacion(),
      cuerpos: this.api.listCuerpos(),
    }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (result) => {
        this.oep.set(result.oep);
        this.tiposAcceso.set(result.acceso);
        this.tiposVinculacion.set(result.vinculacion);
        this.cuerpos.set(result.cuerpos);
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
    }
    return errors;
  }

  private createRequest(catalog: CatalogKey): Observable<MasterItem> {
    switch (catalog) {
      case "oep": return this.api.createOep(this.oepPayload());
      case "acceso": return this.api.createTipoAcceso(this.codePayload());
      case "vinculacion": return this.api.createTipoVinculacion(this.codePayload());
      case "cuerpos": return this.api.createCuerpo(this.cuerpoPayload());
    }
  }

  private updateRequest(catalog: CatalogKey, id: number): Observable<MasterItem> {
    switch (catalog) {
      case "oep": return this.api.updateOep(id, this.oepPayload());
      case "acceso": return this.api.updateTipoAcceso(id, this.codePayload());
      case "vinculacion": return this.api.updateTipoVinculacion(id, this.codePayload());
      case "cuerpos": return this.api.updateCuerpo(id, this.cuerpoPayload());
    }
  }

  private deleteRequest(catalog: CatalogKey, id: number): Observable<void> {
    switch (catalog) {
      case "oep": return this.api.deleteOep(id);
      case "acceso": return this.api.deleteTipoAcceso(id);
      case "vinculacion": return this.api.deleteTipoVinculacion(id);
      case "cuerpos": return this.api.deleteCuerpo(id);
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

  private itemId(catalog: CatalogKey, item: MasterItem): number {
    switch (catalog) {
      case "oep": return (item as Oep).idOep;
      case "acceso": return (item as TipoAcceso).idTipoAcceso;
      case "vinculacion": return (item as TipoVinculacion).idTipoVinculacion;
      case "cuerpos": return (item as Cuerpo).idCuerpo;
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
    }
  }

  private removeItem(catalog: CatalogKey, id: number): void {
    const remove = <T extends MasterItem>(items: T[]) => items.filter((item) => this.itemId(catalog, item) !== id);
    switch (catalog) {
      case "oep": this.oep.update(remove); break;
      case "acceso": this.tiposAcceso.update(remove); break;
      case "vinculacion": this.tiposVinculacion.update(remove); break;
      case "cuerpos": this.cuerpos.update(remove); break;
    }
  }

  private clearMessages(): void {
    this.error.set(null);
    this.success.set(null);
  }
}
