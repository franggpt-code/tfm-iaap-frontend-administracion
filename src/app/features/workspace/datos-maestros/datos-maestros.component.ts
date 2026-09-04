import { Component, computed, ElementRef, inject, OnInit, signal, ViewChild } from "@angular/core";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { finalize, Observable } from "rxjs";
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
  SubcategoriaAsignacion,
  SubcategoriaAsignacionCreateUpdate,
  PerfilColaboracion,
  PerfilColaboracionCreateUpdate,
  ConfiguracionInformesUpdate,
  ConfiguracionSmtp,
  ConfiguracionSmtpUpdate,
  PruebaConexionSmtpRequest,
  PruebaConexionSmtpResultado,
} from "../../../api/sicol.types";

type CatalogKey = "oep" | "acceso" | "vinculacion" | "cuerpos" | "perfiles" | "subcategorias";
type SectionKey = CatalogKey | "informes" | "smtp";
type MasterItem = Oep | TipoAcceso | TipoVinculacion | Cuerpo | PerfilColaboracion | SubcategoriaAsignacion;
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
  subcategorias: { label: "Ubicaciones y subcategorías", tabLabel: "Ubicaciones", singular: "ubicación o subcategoría", description: "Valores regulados para las asignaciones de ámbito general." },
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

  readonly catalogKeys: CatalogKey[] = ["oep", "acceso", "vinculacion", "cuerpos", "perfiles", "subcategorias"];
  readonly catalogs = CATALOGS;
  readonly activeCatalog = signal<CatalogKey>("cuerpos");
  readonly activeSection = signal<SectionKey | null>(null);
  readonly oep = signal<Oep[]>([]);
  readonly tiposAcceso = signal<TipoAcceso[]>([]);
  readonly tiposVinculacion = signal<TipoVinculacion[]>([]);
  readonly cuerpos = signal<Cuerpo[]>([]);
  readonly perfiles = signal<PerfilColaboracion[]>([]);
  readonly subcategorias = signal<SubcategoriaAsignacion[]>([]);
  readonly search = signal("");
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly reportConfigSaving = signal(false);
  readonly smtpConfigSaving = signal(false);
  readonly testingSmtp = signal(false);
  readonly testSmtpResult = signal<PruebaConexionSmtpResultado | null>(null);
  readonly passwordConfigurada = signal(false);
  readonly showPasswordField = signal(false);
  readonly smtpParamsExpanded = signal(false);
  readonly testRecipient = signal("");
  readonly copiedEmailNotice = signal(false);
  readonly formOpen = signal(false);
  readonly drawerExpanded = signal(false);
  readonly editingId = signal<number | string | null>(null);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly fieldErrors = signal<Record<string, string>>({});
  readonly reportConfigErrors = signal<Record<string, string>>({});
  readonly smtpConfigErrors = signal<Record<string, string>>({});
  readonly deleteTarget = signal<DeleteTarget | null>(null);

  private readonly loadedSections = new Set<SectionKey>();
  private readonly loadingSections = new Set<SectionKey>();

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
    textoFechaFirma: [""],
    textoCertifica: [""],
    nombreCertifica: [""],
    cargoCertifica: [""],
    nombreVistoBueno: [""],
    cargoVistoBueno: [""],
    nombreDirectorIaap: [""],
    cargoDirectorIaap: [""],
  });

  readonly smtpConfigForm = this.fb.nonNullable.group({
    servidorSmtp: [""],
    puertoSmtp: [587],
    usarTls: [true],
    usuarioSmtp: [""],
    passwordSmtp: [""],
    remitenteNombre: [""],
    remitenteEmail: [""],
    modoPrueba: [true],
    emailPrueba: [""],
    activo: [false],
  });

  readonly config = computed(() => CATALOGS[this.activeCatalog()]);
  readonly items = computed<MasterItem[]>(() => {
    switch (this.activeCatalog()) {
      case "oep": return this.oep();
      case "acceso": return this.tiposAcceso();
      case "vinculacion": return this.tiposVinculacion();
      case "cuerpos": return this.cuerpos();
      case "perfiles": return this.perfiles();
      case "subcategorias": return this.subcategorias();
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
    const section = this.requestedSection();
    if (section) {
      this.selectSection(section);
      window.setTimeout(() => {
        const targetId = section === "informes" ? "configuracion-informes" : section === "smtp" ? "configuracion-smtp" : null;
        if (targetId) document.getElementById(targetId)?.scrollIntoView({ block: "start" });
      }, 350);
    }
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
    if (section !== "informes" && section !== "smtp") {
      this.selectCatalog(section);
    } else {
      this.cancelForm();
      this.clearMessages();
      this.testSmtpResult.set(null);
    }
    this.loadSection(section);
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
    } else if (catalog === "subcategorias") {
      const value = item as SubcategoriaAsignacion;
      this.form.reset({ anio: new Date().getFullYear(), descripcion: value.descripcion, bojaRef: "", codigo: "", grupo: "", importeHora: 0 });
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
      textoFechaFirma: values.textoFechaFirma.trim(),
      textoCertifica: values.textoCertifica.trim(),
      nombreCertifica: values.nombreCertifica.trim(),
      cargoCertifica: values.cargoCertifica.trim(),
      nombreVistoBueno: values.nombreVistoBueno.trim(),
      cargoVistoBueno: values.cargoVistoBueno.trim(),
      nombreDirectorIaap: values.nombreDirectorIaap.trim(),
      cargoDirectorIaap: values.cargoDirectorIaap.trim(),
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

  saveSmtpConfiguration(): void {
    const values = this.smtpConfigForm.getRawValue();
    const errors: Record<string, string> = {};
    if (!values.servidorSmtp.trim()) errors["servidorSmtp"] = "El servidor SMTP es obligatorio.";
    if (!values.puertoSmtp || values.puertoSmtp < 1 || values.puertoSmtp > 65535) errors["puertoSmtp"] = "Introduce un puerto válido (1-65535).";
    if (!values.remitenteNombre.trim()) errors["remitenteNombre"] = "El nombre del remitente es obligatorio.";
    if (!values.remitenteEmail.trim()) errors["remitenteEmail"] = "El correo del remitente es obligatorio.";
    if (values.modoPrueba && !values.emailPrueba.trim()) errors["emailPrueba"] = "Debes indicar un correo de prueba si el modo prueba está activo.";

    this.smtpConfigErrors.set(errors);
    if (Object.keys(errors).length) {
      if (errors["servidorSmtp"] || errors["puertoSmtp"] || errors["remitenteNombre"] || errors["remitenteEmail"]) {
        this.smtpParamsExpanded.set(true);
      }
      return;
    }

    const payload: ConfiguracionSmtpUpdate = {
      servidorSmtp: values.servidorSmtp.trim(),
      puertoSmtp: values.puertoSmtp,
      usarTls: values.usarTls,
      usuarioSmtp: values.usuarioSmtp.trim() || undefined,
      passwordSmtp: values.passwordSmtp ? values.passwordSmtp : undefined,
      remitenteNombre: values.remitenteNombre.trim(),
      remitenteEmail: values.remitenteEmail.trim(),
      modoPrueba: values.modoPrueba,
      emailPrueba: values.emailPrueba.trim() || undefined,
      activo: values.activo,
    };

    this.smtpConfigSaving.set(true);
    this.clearMessages();
    this.api.updateConfiguracionSmtp(payload)
      .pipe(finalize(() => this.smtpConfigSaving.set(false)))
      .subscribe({
        next: (saved) => {
          this.success.set("Configuración del servidor de correo (SMTP) guardada correctamente.");
          this.passwordConfigurada.set(saved.passwordConfigurada);
          this.smtpConfigForm.patchValue({ passwordSmtp: "" });
          this.showPasswordField.set(false);
          this.smtpConfigErrors.set({});
        },
        error: (err) => this.error.set(apiErrorMessage(err)),
      });
  }

  probarConexionSmtp(): void {
    const values = this.smtpConfigForm.getRawValue();
    const recipient = this.testRecipient().trim() || values.emailPrueba.trim() || values.usuarioSmtp.trim() || values.remitenteEmail.trim();
    if (!recipient) {
      this.error.set("Debes indicar una dirección de correo para recibir el mensaje de prueba.");
      return;
    }

    const payload: PruebaConexionSmtpRequest = {
      servidorSmtp: values.servidorSmtp.trim(),
      puertoSmtp: values.puertoSmtp,
      usarTls: values.usarTls,
      usuarioSmtp: values.usuarioSmtp.trim() || undefined,
      passwordSmtp: values.passwordSmtp ? values.passwordSmtp : undefined,
      remitenteNombre: values.remitenteNombre.trim(),
      remitenteEmail: values.remitenteEmail.trim(),
      destinatarioPrueba: recipient,
    };

    this.testingSmtp.set(true);
    this.testSmtpResult.set(null);
    this.clearMessages();

    this.api.probarConexionSmtp(payload)
      .pipe(finalize(() => this.testingSmtp.set(false)))
      .subscribe({
        next: (result) => {
          this.testSmtpResult.set(result);
          if (result.exitoso) {
            this.success.set(result.mensaje);
          } else {
            this.error.set(result.mensaje);
          }
        },
        error: (err) => {
          this.error.set(apiErrorMessage(err));
          this.testSmtpResult.set({
            exitoso: false,
            mensaje: apiErrorMessage(err),
            fechaHora: new Date().toISOString(),
          });
        },
      });
  }

  toggleShowPassword(): void {
    this.showPasswordField.update((v) => !v);
  }

  toggleSmtpParams(): void {
    this.smtpParamsExpanded.update((v) => !v);
  }

  updateTestRecipient(value: string): void {
    this.testRecipient.set(value);
  }

  copiarEmailPruebaDestinatario(): void {
    const email = this.smtpConfigForm.controls.emailPrueba.value?.trim() || "";
    if (email) {
      this.testRecipient.set(email);
      this.copiedEmailNotice.set(true);
      setTimeout(() => this.copiedEmailNotice.set(false), 2500);

      // Desplazar la vista suavemente hasta el campo de prueba y enfocarlo
      const inputEl = document.getElementById("smtp-test-destinatario") as HTMLInputElement | null;
      if (inputEl) {
        inputEl.scrollIntoView({ behavior: "smooth", block: "center" });
        inputEl.focus();
      }
    }
  }

  itemCode(item: MasterItem): string {
    if ("idSubcategoriaAsignacion" in item) return String(item.idSubcategoriaAsignacion);
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

  private loadSection(section: SectionKey): void {
    if (this.loadedSections.has(section) || this.loadingSections.has(section)) {
      this.syncLoadingState();
      return;
    }

    switch (section) {
      case "oep":
        this.loadSectionData(section, this.api.listOep(), value => this.oep.set(value));
        break;
      case "acceso":
        this.loadSectionData(section, this.api.listTiposAcceso(), value => this.tiposAcceso.set(value));
        break;
      case "vinculacion":
        this.loadSectionData(section, this.api.listTiposVinculacion(), value => this.tiposVinculacion.set(value));
        break;
      case "cuerpos":
        this.loadSectionData(section, this.api.listCuerpos(), value => this.cuerpos.set(value));
        break;
      case "perfiles":
        this.loadSectionData(section, this.api.listPerfilesColaboracion(), value => this.perfiles.set(value));
        break;
      case "subcategorias":
        this.loadSectionData(section, this.api.listSubcategoriasAsignacion(), value => this.subcategorias.set(value));
        break;
      case "informes":
        this.loadSectionData(section, this.api.getConfiguracionInformes(), value => this.reportConfigForm.setValue(value));
        break;
      case "smtp":
        this.loadSectionData(section, this.api.getConfiguracionSmtp(), value => this.applySmtpConfiguration(value));
        break;
    }
  }

  private loadSectionData<T>(section: SectionKey, request: Observable<T>, applyValue: (value: T) => void): void {
    this.loadingSections.add(section);
    this.syncLoadingState();
    request.pipe(finalize(() => {
      this.loadingSections.delete(section);
      this.syncLoadingState();
    })).subscribe({
      next: value => {
        applyValue(value);
        this.loadedSections.add(section);
      },
      error: (error: unknown) => {
        if (this.activeSection() === section) this.error.set(apiErrorMessage(error));
      },
    });
  }

  private applySmtpConfiguration(configuration: ConfiguracionSmtp): void {
    this.smtpConfigForm.patchValue({
      servidorSmtp: configuration.servidorSmtp,
      puertoSmtp: configuration.puertoSmtp,
      usarTls: configuration.usarTls,
      usuarioSmtp: configuration.usuarioSmtp ?? "",
      passwordSmtp: "",
      remitenteNombre: configuration.remitenteNombre,
      remitenteEmail: configuration.remitenteEmail,
      modoPrueba: configuration.modoPrueba,
      emailPrueba: configuration.emailPrueba ?? "",
      activo: configuration.activo,
    });
    this.passwordConfigurada.set(configuration.passwordConfigurada);
    this.testRecipient.set(configuration.emailPrueba || configuration.usuarioSmtp || configuration.remitenteEmail || "");
  }

  private syncLoadingState(): void {
    const section = this.activeSection();
    this.loading.set(section !== null && this.loadingSections.has(section));
  }

  private requestedSection(): SectionKey | null {
    const section = this.route.snapshot.queryParamMap.get("seccion");
    if (section && ([...this.catalogKeys, "informes", "smtp"] as string[]).includes(section)) return section as SectionKey;
    if (this.route.snapshot.fragment === "configuracion-informes") return "informes";
    if (this.route.snapshot.fragment === "configuracion-smtp") return "smtp";
    return null;
  }
  private validateForm(): Record<string, string> {
    const values = this.form.getRawValue();
    const errors: Record<string, string> = {};
    if (this.activeCatalog() === "oep") {
      if (!Number.isInteger(values.anio) || values.anio < 1900 || values.anio > 2200) errors["anio"] = "Introduce un año válido.";
    } else {
      if (this.activeCatalog() !== "subcategorias" && !values.codigo.trim()) errors["codigo"] = "Introduce un código.";
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
      case "subcategorias": return this.api.createSubcategoriaAsignacion(this.subcategoriaPayload());
    }
  }

  private updateRequest(catalog: CatalogKey, id: number | string): Observable<MasterItem> {
    switch (catalog) {
      case "oep": return this.api.updateOep(id as number, this.oepPayload());
      case "acceso": return this.api.updateTipoAcceso(id as number, this.codePayload());
      case "vinculacion": return this.api.updateTipoVinculacion(id as number, this.codePayload());
      case "cuerpos": return this.api.updateCuerpo(id as number, this.cuerpoPayload());
      case "perfiles": return this.api.updatePerfilColaboracion(id as string, this.perfilPayload());
      case "subcategorias": return this.api.updateSubcategoriaAsignacion(id as number, this.subcategoriaPayload());
    }
  }

  private deleteRequest(catalog: CatalogKey, id: number | string): Observable<void> {
    switch (catalog) {
      case "oep": return this.api.deleteOep(id as number);
      case "acceso": return this.api.deleteTipoAcceso(id as number);
      case "vinculacion": return this.api.deleteTipoVinculacion(id as number);
      case "cuerpos": return this.api.deleteCuerpo(id as number);
      case "perfiles": return this.api.deletePerfilColaboracion(id as string);
      case "subcategorias": return this.api.deleteSubcategoriaAsignacion(id as number);
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

  private subcategoriaPayload(): SubcategoriaAsignacionCreateUpdate {
    return { descripcion: this.form.getRawValue().descripcion.trim() };
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
      case "subcategorias": return (item as SubcategoriaAsignacion).idSubcategoriaAsignacion;
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
      case "subcategorias": this.subcategorias.update(update); break;
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
      case "subcategorias": this.subcategorias.update(remove); break;
    }
  }

  private clearMessages(): void {
    this.error.set(null);
    this.success.set(null);
  }
}
