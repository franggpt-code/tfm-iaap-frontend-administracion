import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { finalize, forkJoin } from "rxjs";
import { apiErrorMessage } from "../../../api/api-error";
import { SicolApiClient } from "../../../api/sicol-api-client.service";
import {
  AdjuntoComunicacion,
  EjercicioEnvio,
  EnvioComunicacionHistorial,
} from "../../../api/sicol.types";

@Component({
  selector: "app-envios",
  imports: [FormsModule, RouterLink],
  templateUrl: "./envios.component.html",
  styleUrl: "./envios.component.scss",
})
export class EnviosComponent implements OnInit {
  private readonly api = inject(SicolApiClient);

  readonly ejercicios = signal<EjercicioEnvio[]>([]);
  readonly adjuntos = signal<AdjuntoComunicacion[]>([]);
  readonly historial = signal<EnvioComunicacionHistorial[]>([]);
  readonly selectedExamenId = signal("");
  readonly selectedAdjuntoIds = signal<string[]>([]);
  readonly asunto = signal("");
  readonly cuerpo = signal("");
  readonly loading = signal(true);
  readonly savingTemplate = signal(false);
  readonly creating = signal(false);
  readonly uploading = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly selectedEjercicio = computed(() =>
    this.ejercicios().find((item) => item.examenId === this.selectedExamenId()) ?? null,
  );
  readonly canCreate = computed(() =>
    !!this.selectedExamenId() && !!this.asunto().trim() && !!this.cuerpo().trim() && !this.creating(),
  );

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
    }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: ({ ejercicios, configuracion, adjuntos, historial }) => {
        this.ejercicios.set(ejercicios);
        this.asunto.set(configuracion.asunto ?? "");
        this.cuerpo.set(configuracion.cuerpo ?? "");
        this.adjuntos.set(adjuntos);
        this.historial.set(historial);
      },
      error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
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
          this.success.set("Plantilla predeterminada guardada.");
        },
        error: (error: unknown) => this.error.set(apiErrorMessage(error)),
      });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const fichero = input.files?.item(0);
    input.value = "";
    if (!fichero) return;
    this.uploading.set(true);
    this.error.set(null);
    this.api.createAdjuntoComunicacion(fichero).pipe(finalize(() => this.uploading.set(false))).subscribe({
      next: (adjunto) => {
        this.adjuntos.update((items) => [adjunto, ...items]);
        this.selectedAdjuntoIds.update((ids) => [...ids, adjunto.id]);
        this.success.set(`Adjunto «${adjunto.nombre}» cargado.`);
      },
      error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
  }

  toggleAdjunto(id: string): void {
    this.selectedAdjuntoIds.update((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  }

  deleteAdjunto(adjunto: AdjuntoComunicacion): void {
    this.api.deleteAdjuntoComunicacion(adjunto.id).subscribe({
      next: () => {
        this.adjuntos.update((items) => items.filter((item) => item.id !== adjunto.id));
        this.selectedAdjuntoIds.update((ids) => ids.filter((id) => id !== adjunto.id));
      },
      error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
  }

  downloadAdjunto(adjunto: AdjuntoComunicacion): void {
    this.api.downloadAdjuntoComunicacion(adjunto.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = adjunto.nombre;
        link.click();
        URL.revokeObjectURL(url);
      },
      error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
  }

  crearEnvio(): void {
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
        this.success.set(`Comunicación preparada para ${result.destinatarios} colaborador${result.destinatarios === 1 ? "" : "es"}. Se ha incorporado a la traza.`);
        this.selectedAdjuntoIds.set([]);
        this.refreshLists();
      },
      error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
  }

  dateLabel(value?: string): string {
    if (!value) return "Fecha pendiente";
    return new Intl.DateTimeFormat("es-ES", { dateStyle: "long", timeStyle: "short" }).format(new Date(value));
  }

  sizeLabel(bytes: number): string {
    return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private refreshLists(): void {
    forkJoin({ ejercicios: this.api.listEjerciciosParaEnvios(), historial: this.api.listHistorialEnviosComunicaciones() }).subscribe({
      next: ({ ejercicios, historial }) => {
        this.ejercicios.set(ejercicios);
        this.historial.set(historial);
      },
      error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
  }
}
