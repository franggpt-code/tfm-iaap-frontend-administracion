import { Component, ElementRef, OnInit, ViewChild, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { finalize, forkJoin } from "rxjs";
import { apiErrorMessage } from "../../../api/api-error";
import { SicolApiClient } from "../../../api/sicol-api-client.service";
import {
  AdjuntoComunicacion,
  ConfiguracionSmtp,
  DestinatarioEnvioComunicacion,
  EjercicioEnvio,
  EnvioComunicacionHistorial,
  EnvioComunicacionResultado,
} from "../../../api/sicol.types";

export type TabKey = "traza" | "nuevo" | "documental";
export type TrazaViewMode = "procesos" | "lotes";

@Component({
  selector: "app-envios",
  imports: [FormsModule, RouterLink],
  templateUrl: "./envios.component.html",
  styleUrl: "./envios.component.scss",
})
export class EnviosComponent implements OnInit {
  private readonly api = inject(SicolApiClient);

  @ViewChild("asuntoInput") asuntoInput?: ElementRef<HTMLInputElement>;
  @ViewChild("cuerpoInput") cuerpoInput?: ElementRef<HTMLTextAreaElement>;

  // Pestaña activa
  readonly activeTab = signal<TabKey>("traza");

  // Datos base
  readonly ejercicios = signal<EjercicioEnvio[]>([]);
  readonly adjuntos = signal<AdjuntoComunicacion[]>([]);
  readonly historial = signal<EnvioComunicacionHistorial[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  // Traza de comunicaciones
  readonly trazaView = signal<TrazaViewMode>("procesos");
  readonly trazaSearch = signal("");
  readonly trazaProcessFilter = signal("");
  readonly selectedLote = signal<EnvioComunicacionHistorial | null>(null);
  readonly loteDestinatarios = signal<DestinatarioEnvioComunicacion[]>([]);
  readonly loadingDestinatarios = signal(false);
  readonly destinatarioSearch = signal("");
  readonly selectedDestinatario = signal<DestinatarioEnvioComunicacion | null>(null);
  readonly drawerExpanded = signal(false);

  // Preparar Envío
  readonly selectedExamenId = signal("");
  readonly selectedAdjuntoIds = signal<string[]>([]);
  readonly asunto = signal("");
  readonly cuerpo = signal("");
  readonly showPreview = signal(false);
  readonly savingTemplate = signal(false);
  readonly creating = signal(false);

  // Estado del servidor SMTP y modales de confirmación y resultado
  readonly smtpConfig = signal<ConfiguracionSmtp | null>(null);
  readonly showConfirmModal = signal(false);
  readonly showResultModal = signal(false);
  readonly lastResult = signal<EnvioComunicacionResultado | null>(null);

  // Repositorio Documental
  readonly docSearch = signal("");
  readonly showNewDocModal = signal(false);
  readonly newDocTitulo = signal("");
  readonly newDocDescripcion = signal("");
  readonly newDocFile = signal<File | null>(null);
  readonly uploadingDoc = signal(false);

  readonly editingDoc = signal<AdjuntoComunicacion | null>(null);
  readonly editDocTitulo = signal("");
  readonly editDocDescripcion = signal("");
  readonly savingDocEdit = signal(false);

  readonly replacingDoc = signal<AdjuntoComunicacion | null>(null);
  readonly replaceDocFile = signal<File | null>(null);
  readonly replacingDocFile = signal(false);

  readonly deletingDoc = signal<AdjuntoComunicacion | null>(null);
  readonly deletingDocLoading = signal(false);

  // Tokens disponibles para el modelo
  readonly tokens = [
    { token: "#NOMBRE#", label: "Nombre colaborador/a", description: "Nombre y apellidos completos" },
    { token: "#PROCESO#", label: "Proceso selectivo", description: "Denominación del proceso" },
    { token: "#CUERPO#", label: "Cuerpo / Ejercicio", description: "Nombre del ejercicio examinado" },
    { token: "#DIA#", label: "Fecha del ejercicio", description: "Fecha redactada en castellano" },
    { token: "#EDIFICIO#", label: "Sede / Edificio", description: "Centro o ámbito general" },
    { token: "#AULA#", label: "Aula asignada", description: "Aula específica asignada" },
    { token: "#PERFIL#", label: "Perfil de colaboración", description: "Función encomendada" },
    { token: "#BOTONES_RESPUESTA#", label: "Botones de confirmación y rechazo", description: "Aviso destacado y botones para confirmar o declinar" },
    { token: "#ENLACE_CONFIRMAR#", label: "Enlace confirmar asistencia", description: "URL directa para registrar confirmación" },
    { token: "#ENLACE_RECHAZAR#", label: "Enlace rechazar asistencia", description: "URL directa para abrir renuncia con motivo" },
  ];

  // Computed signals
  readonly selectedEjercicio = computed(() =>
    this.ejercicios().find((item) => item.examenId === this.selectedExamenId()) ?? null,
  );

  readonly canCreate = computed(() =>
    !!this.selectedExamenId() && !!this.asunto().trim() && !!this.cuerpo().trim() && !this.creating(),
  );

  readonly distinctProcesses = computed(() => {
    const map = new Map<string, string>();
    for (const item of this.ejercicios()) {
      if (item.procesoId && !map.has(item.procesoId)) {
        const label = item.procesoCodigoSirhus ? `${item.procesoCodigoSirhus} · ${item.procesoNombre}` : item.procesoNombre;
        map.set(item.procesoId, label);
      }
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  });

  readonly filteredEjerciciosTraza = computed(() => {
    const q = this.trazaSearch().toLowerCase().trim();
    const p = this.trazaProcessFilter();
    return this.ejercicios().filter((item) => {
      if (p && item.procesoId !== p) return false;
      if (!q) return true;
      const haystack = [
        item.procesoCodigoSirhus ?? "",
        item.procesoNombre,
        item.nombreEjercicio,
        `${item.ejercicio}`,
      ].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  });

  readonly ejerciciosConEnvioCount = computed(() =>
    this.ejercicios().filter((item) => item.tieneEnviosPrevios).length,
  );

  readonly ejerciciosPendientesCount = computed(() =>
    this.ejercicios().filter((item) => !item.tieneEnviosPrevios).length,
  );

  readonly totalDestinatariosHistorial = computed(() =>
    this.historial().reduce((acc, curr) => acc + (curr.destinatarios || 0), 0),
  );

  readonly filteredHistorial = computed(() => {
    const q = this.trazaSearch().toLowerCase().trim();
    const p = this.trazaProcessFilter();
    return this.historial().filter((item) => {
      if (p) {
        const matchEj = this.ejercicios().find((e) => e.examenId === item.examenId);
        if (matchEj && matchEj.procesoId !== p) return false;
      }
      if (!q) return true;
      const haystack = [
        item.procesoCodigoSirhus ?? "",
        item.procesoNombre,
        item.nombreEjercicio,
        item.creadoPor,
        item.asuntoPlantilla ?? "",
        item.adjuntosNombres ?? "",
      ].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  });

  readonly filteredDestinatarios = computed(() => {
    const q = this.destinatarioSearch().toLowerCase().trim();
    if (!q) return this.loteDestinatarios();
    return this.loteDestinatarios().filter((d) =>
      d.nombreDestinatario.toLowerCase().includes(q) ||
      d.correoDestinatario.toLowerCase().includes(q) ||
      d.estado.toLowerCase().includes(q),
    );
  });

  readonly filteredDocs = computed(() => {
    const q = this.docSearch().toLowerCase().trim();
    if (!q) return this.adjuntos();
    return this.adjuntos().filter((item) =>
      item.titulo.toLowerCase().includes(q) ||
      item.nombre.toLowerCase().includes(q) ||
      (item.descripcion ?? "").toLowerCase().includes(q) ||
      item.tipoContenido.toLowerCase().includes(q),
    );
  });

  readonly selectedDocs = computed(() => {
    const ids = this.selectedAdjuntoIds();
    return this.adjuntos().filter((a) => ids.includes(a.id));
  });

  readonly selectedDocsTotalBytes = computed(() =>
    this.selectedDocs().reduce((sum, d) => sum + (d.tamanoBytes || 0), 0),
  );

  readonly samplePreview = computed(() => {
    const ej = this.selectedEjercicio();
    const rawAsunto = this.asunto();
    const rawCuerpo = this.cuerpo();
    const nombre = "María García Pérez";
    const proceso = ej ? ej.procesoNombre : "Cuerpo Superior Facultativo (A1.1100)";
    const cuerpo = ej ? `${ej.ejercicio}.º ${ej.nombreEjercicio}` : "1.er Ejercicio Teórico";
    const dia = ej && ej.fechaHora ? this.dateLabel(ej.fechaHora) : "15 de noviembre de 2026";
    const edificio = "Campus Universitario Reina Mercedes";
    const aula = "Aula 104 - Planta 1";
    const perfil = "Vocal de aula y control de asistencia";

    const enlaceConfirmar = "http://127.0.0.1:4200/confirmacion-asistencia?token=demo-token-123&decision=CONFIRMADA";
    const enlaceRechazar = "http://127.0.0.1:4200/confirmacion-asistencia?token=demo-token-123&decision=RECHAZADA";
    const botonesTexto = `[SÍ, CONFIRMO MI ASISTENCIA]: ${enlaceConfirmar}\n[NO PUEDO ASISTIR (RECHAZAR)]: ${enlaceRechazar}`;

    const replaceVars = (text: string) =>
      text
        .replaceAll("#NOMBRE#", nombre)
        .replaceAll("#PROCESO#", proceso)
        .replaceAll("#CUERPO#", cuerpo)
        .replaceAll("#DIA#", dia)
        .replaceAll("#EDIFICIO#", edificio)
        .replaceAll("#AULA#", aula)
        .replaceAll("#PERFIL#", perfil)
        .replaceAll("#BOTONES_RESPUESTA#", botonesTexto)
        .replaceAll("#ENLACE_CONFIRMAR#", enlaceConfirmar)
        .replaceAll("#ENLACE_RECHAZAR#", enlaceRechazar);

    return {
      asunto: replaceVars(rawAsunto),
      cuerpo: replaceVars(rawCuerpo),
    };
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      ejercicios: this.api.listEjerciciosParaEnvios(),
      configuracion: this.api.getConfiguracionEnvios(),
      adjuntos: this.api.listAdjuntosComunicaciones(),
      historial: this.api.listHistorialEnviosComunicaciones(),
      smtpConfig: this.api.getConfiguracionSmtp(),
    }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: ({ ejercicios, configuracion, adjuntos, historial, smtpConfig }) => {
        this.ejercicios.set(ejercicios);
        this.asunto.set(configuracion.asunto ?? "");
        this.cuerpo.set(configuracion.cuerpo ?? "");
        this.adjuntos.set(adjuntos);
        this.historial.set(historial);
        this.smtpConfig.set(smtpConfig);
      },
      error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
  }

  selectTab(tab: TabKey): void {
    this.activeTab.set(tab);
    this.error.set(null);
    this.success.set(null);
  }

  prepareForExercise(examenId: string): void {
    this.selectedExamenId.set(examenId);
    this.activeTab.set("nuevo");
    this.error.set(null);
    this.success.set(null);
  }

  // Operaciones de modelo y tokens
  insertToken(token: string, target: "asunto" | "cuerpo"): void {
    if (target === "asunto") {
      const el = this.asuntoInput?.nativeElement;
      if (el) {
        const start = el.selectionStart ?? el.value.length;
        const end = el.selectionEnd ?? el.value.length;
        const current = this.asunto();
        const next = current.substring(0, start) + token + current.substring(end);
        this.asunto.set(next);
        setTimeout(() => {
          el.focus();
          el.setSelectionRange(start + token.length, start + token.length);
        });
      } else {
        this.asunto.update((v) => `${v} ${token}`);
      }
    } else {
      const el = this.cuerpoInput?.nativeElement;
      if (el) {
        const start = el.selectionStart ?? el.value.length;
        const end = el.selectionEnd ?? el.value.length;
        const current = this.cuerpo();
        const next = current.substring(0, start) + token + current.substring(end);
        this.cuerpo.set(next);
        setTimeout(() => {
          el.focus();
          el.setSelectionRange(start + token.length, start + token.length);
        });
      } else {
        this.cuerpo.update((v) => `${v} ${token}`);
      }
    }
  }

  saveTemplate(): void {
    this.savingTemplate.set(true);
    this.error.set(null);
    this.api.updateConfiguracionEnvios({ asunto: this.asunto().trim(), cuerpo: this.cuerpo().trim() })
      .pipe(finalize(() => this.savingTemplate.set(false)))
      .subscribe({
        next: (config) => {
          this.asunto.set(config.asunto ?? "");
          this.cuerpo.set(config.cuerpo ?? "");
          this.success.set("Plantilla predeterminada guardada correctamente.");
        },
        error: (error: unknown) => this.error.set(apiErrorMessage(error)),
      });
  }

  toggleAdjunto(id: string): void {
    this.selectedAdjuntoIds.update((ids) =>
      ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
    );
  }

  openConfirmModal(): void {
    if (!this.canCreate()) return;
    this.showConfirmModal.set(true);
  }

  closeConfirmModal(): void {
    this.showConfirmModal.set(false);
  }

  crearEnvio(): void {
    this.openConfirmModal();
  }

  confirmarYEnviarLote(): void {
    if (!this.canCreate()) return;
    this.creating.set(true);
    this.error.set(null);
    this.api.crearEnvioComunicacion({
      examenId: this.selectedExamenId(),
      asunto: this.asunto().trim(),
      cuerpo: this.cuerpo().trim(),
      adjuntoIds: this.selectedAdjuntoIds(),
    }).pipe(finalize(() => this.creating.set(false))).subscribe({
      next: (result) => {
        this.showConfirmModal.set(false);
        this.lastResult.set(result);
        this.showResultModal.set(true);
        this.success.set(result.mensaje ?? `Comunicación preparada correctamente para ${result.destinatarios} colaboradores.`);
        this.selectedAdjuntoIds.set([]);
        this.refreshLists();
      },
      error: (error: unknown) => {
        this.showConfirmModal.set(false);
        this.error.set(apiErrorMessage(error));
      },
    });
  }

  closeResultModal(): void {
    this.showResultModal.set(false);
  }

  irATrazaLote(envioId?: string): void {
    this.closeResultModal();
    this.activeTab.set("traza");
    this.trazaView.set("lotes");
    if (!envioId) return;
    const found = this.historial().find((item) => item.id === envioId);
    if (found) {
      this.openLoteDetail(found);
    } else {
      this.api.listHistorialEnviosComunicaciones().subscribe({
        next: (list) => {
          this.historial.set(list);
          const match = list.find((item) => item.id === envioId);
          if (match) this.openLoteDetail(match);
        },
      });
    }
  }

  // Traza de comunicaciones y detalle de lote
  openLoteDetail(lote: EnvioComunicacionHistorial): void {
    this.selectedLote.set(lote);
    this.selectedDestinatario.set(null);
    this.destinatarioSearch.set("");
    this.loadingDestinatarios.set(true);
    this.api.listDestinatariosEnvio(lote.id).pipe(finalize(() => this.loadingDestinatarios.set(false))).subscribe({
      next: (destinatarios) => this.loteDestinatarios.set(destinatarios),
      error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
  }

  closeLoteDetail(): void {
    this.selectedLote.set(null);
    this.loteDestinatarios.set([]);
    this.selectedDestinatario.set(null);
    this.drawerExpanded.set(false);
  }

  toggleDrawerExpand(): void {
    this.drawerExpanded.update((v) => !v);
  }

  viewDestinatarioMessage(dest: DestinatarioEnvioComunicacion): void {
    this.selectedDestinatario.set(dest);
  }

  closeDestinatarioMessage(): void {
    this.selectedDestinatario.set(null);
  }

  // Repositorio Documental: CRUD
  openNewDocModal(): void {
    this.newDocTitulo.set("");
    this.newDocDescripcion.set("");
    this.newDocFile.set(null);
    this.showNewDocModal.set(true);
  }

  closeNewDocModal(): void {
    this.showNewDocModal.set(false);
  }

  onNewDocFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0) ?? null;
    this.newDocFile.set(file);
    if (file && !this.newDocTitulo().trim()) {
      const defaultTitle = file.name.replace(/\.[^/.]+$/, "");
      this.newDocTitulo.set(defaultTitle);
    }
  }

  saveNewDocument(): void {
    const file = this.newDocFile();
    const titulo = this.newDocTitulo().trim();
    if (!file) {
      this.error.set("Debe seleccionar un archivo para el documento.");
      return;
    }
    if (!titulo) {
      this.error.set("El título identificativo es obligatorio.");
      return;
    }
    this.uploadingDoc.set(true);
    this.error.set(null);
    this.api.createAdjuntoComunicacion(file, titulo, this.newDocDescripcion().trim()).pipe(
      finalize(() => this.uploadingDoc.set(false)),
    ).subscribe({
      next: (doc) => {
        this.adjuntos.update((items) => [doc, ...items]);
        this.selectedAdjuntoIds.update((ids) => [...ids, doc.id]);
        this.success.set(`Documento «${doc.titulo}» incorporado al repositorio.`);
        this.closeNewDocModal();
      },
      error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
  }

  openEditDocModal(doc: AdjuntoComunicacion): void {
    this.editingDoc.set(doc);
    this.editDocTitulo.set(doc.titulo);
    this.editDocDescripcion.set(doc.descripcion ?? "");
  }

  closeEditDocModal(): void {
    this.editingDoc.set(null);
  }

  saveDocMetadata(): void {
    const doc = this.editingDoc();
    if (!doc) return;
    const titulo = this.editDocTitulo().trim();
    if (!titulo) {
      this.error.set("El título identificativo es obligatorio.");
      return;
    }
    this.savingDocEdit.set(true);
    this.error.set(null);
    this.api.updateAdjuntoMetadata(doc.id, {
      titulo,
      descripcion: this.editDocDescripcion().trim() || undefined,
    }).pipe(finalize(() => this.savingDocEdit.set(false))).subscribe({
      next: (updated) => {
        this.adjuntos.update((items) => items.map((item) => (item.id === updated.id ? updated : item)));
        this.success.set(`Documento «${updated.titulo}» actualizado.`);
        this.closeEditDocModal();
      },
      error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
  }

  openReplaceDocModal(doc: AdjuntoComunicacion): void {
    this.replacingDoc.set(doc);
    this.replaceDocFile.set(null);
  }

  closeReplaceDocModal(): void {
    this.replacingDoc.set(null);
    this.replaceDocFile.set(null);
  }

  onReplaceDocFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0) ?? null;
    this.replaceDocFile.set(file);
  }

  saveDocFileReplace(): void {
    const doc = this.replacingDoc();
    const file = this.replaceDocFile();
    if (!doc || !file) {
      this.error.set("Debe seleccionar un archivo para reemplazar.");
      return;
    }
    this.replacingDocFile.set(true);
    this.error.set(null);
    this.api.replaceAdjuntoFile(doc.id, file).pipe(finalize(() => this.replacingDocFile.set(false))).subscribe({
      next: (updated) => {
        this.adjuntos.update((items) => items.map((item) => (item.id === updated.id ? updated : item)));
        this.success.set(`Archivo físico del documento «${updated.titulo}» reemplazado correctamente.`);
        this.closeReplaceDocModal();
      },
      error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
  }

  openDeleteDocModal(doc: AdjuntoComunicacion): void {
    this.deletingDoc.set(doc);
  }

  closeDeleteDocModal(): void {
    this.deletingDoc.set(null);
  }

  confirmDeleteDoc(): void {
    const doc = this.deletingDoc();
    if (!doc) return;
    this.deletingDocLoading.set(true);
    this.error.set(null);
    this.api.deleteAdjuntoComunicacion(doc.id).pipe(finalize(() => this.deletingDocLoading.set(false))).subscribe({
      next: () => {
        this.adjuntos.update((items) => items.filter((item) => item.id !== doc.id));
        this.selectedAdjuntoIds.update((ids) => ids.filter((id) => id !== doc.id));
        this.success.set(`Documento «${doc.titulo}» eliminado del repositorio.`);
        this.closeDeleteDocModal();
      },
      error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
  }

  downloadDocument(doc: AdjuntoComunicacion): void {
    this.api.downloadAdjuntoComunicacion(doc.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = doc.nombre;
        link.click();
        URL.revokeObjectURL(url);
      },
      error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
  }

  // Formatters
  dateLabel(value?: string): string {
    if (!value) return "Fecha pendiente";
    return new Intl.DateTimeFormat("es-ES", { dateStyle: "long", timeStyle: "short" }).format(new Date(value));
  }

  dateOnlyLabel(value?: string): string {
    if (!value) return "Pendiente";
    return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(value));
  }

  sizeLabel(bytes: number): string {
    return bytes < 1024 * 1024
      ? `${Math.max(1, Math.round(bytes / 1024))} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private refreshLists(): void {
    forkJoin({
      ejercicios: this.api.listEjerciciosParaEnvios(),
      historial: this.api.listHistorialEnviosComunicaciones(),
      smtpConfig: this.api.getConfiguracionSmtp(),
    }).subscribe({
      next: ({ ejercicios, historial, smtpConfig }) => {
        this.ejercicios.set(ejercicios);
        this.historial.set(historial);
        this.smtpConfig.set(smtpConfig);
      },
      error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
  }
}
