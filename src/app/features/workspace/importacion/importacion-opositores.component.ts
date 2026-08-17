import { Component, computed, ElementRef, inject, OnInit, signal, ViewChild } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { finalize } from "rxjs";
import { apiErrorMessage } from "../../../api/api-error";
import { SicolApiClient } from "../../../api/sicol-api-client.service";
import { Examen, ImportacionArchivos, ImportacionResultado, ProcesoSelectivo } from "../../../api/sicol.types";

@Component({
  selector: "app-importacion-opositores",
  imports: [RouterLink],
  templateUrl: "./importacion-opositores.component.html",
  styleUrl: "./importacion-opositores.component.scss",
})
export class ImportacionOpositoresComponent implements OnInit {
  @ViewChild("confirmationDialog") private confirmationDialog?: ElementRef<HTMLDialogElement>;

  private readonly api = inject(SicolApiClient);
  private readonly route = inject(ActivatedRoute);

  readonly procesos = signal<ProcesoSelectivo[]>([]);
  readonly examenes = signal<Examen[]>([]);
  readonly procesoId = signal("");
  readonly examenId = signal("");
  readonly ficheroSirhus = signal<File | null>(null);
  readonly ficheroCaronte = signal<File | null>(null);
  readonly loadingProcesos = signal(true);
  readonly loadingExamenes = signal(false);
  readonly simulating = signal(false);
  readonly confirming = signal(false);
  readonly error = signal<string | null>(null);
  readonly fileError = signal<string | null>(null);
  readonly simulation = signal<ImportacionResultado | null>(null);
  readonly confirmed = signal<ImportacionResultado | null>(null);

  readonly canSimulate = computed(() =>
    !!this.procesoId() && !!this.examenId() && !!this.ficheroSirhus() && !this.simulating() && !this.confirming(),
  );

  readonly selectedProceso = computed(() => this.procesos().find((item) => item.id === this.procesoId()));
  readonly selectedExamen = computed(() => this.examenes().find((item) => item.id === this.examenId()));

  ngOnInit(): void {
    const requestedProceso = this.route.snapshot.queryParamMap.get("procesoId") ?? "";
    const requestedExamen = this.route.snapshot.queryParamMap.get("examenId") ?? "";

    this.api.listProcesos().subscribe({
      next: (page) => {
        this.procesos.set(page.content);
        this.loadingProcesos.set(false);
        if (requestedProceso && page.content.some((item) => item.id === requestedProceso)) {
          this.procesoId.set(requestedProceso);
          this.loadExamenes(requestedProceso, requestedExamen);
        }
      },
      error: (error: unknown) => {
        this.error.set(apiErrorMessage(error));
        this.loadingProcesos.set(false);
      },
    });
  }

  onProcesoChange(value: string): void {
    this.procesoId.set(value);
    this.examenId.set("");
    this.examenes.set([]);
    this.invalidateSimulation();
    if (value) {
      this.loadExamenes(value);
    }
  }

  onExamenChange(value: string): void {
    this.examenId.set(value);
    this.invalidateSimulation();
  }

  onFile(event: Event, kind: "sirhus" | "caronte"): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.fileError.set(null);

    if (file && !/\.xlsx?$/i.test(file.name)) {
      this.fileError.set("Selecciona un fichero con extensión .xls o .xlsx.");
      input.value = "";
      if (kind === "sirhus") this.ficheroSirhus.set(null);
      else this.ficheroCaronte.set(null);
      this.invalidateSimulation();
      return;
    }

    if (kind === "sirhus") this.ficheroSirhus.set(file);
    else this.ficheroCaronte.set(file);
    this.invalidateSimulation();
  }

  simulate(): void {
    const payload = this.payload();
    if (!payload || !this.canSimulate()) return;

    this.error.set(null);
    this.confirmed.set(null);
    this.simulating.set(true);
    this.api.simularImportacion(payload).pipe(finalize(() => this.simulating.set(false))).subscribe({
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
    const payload = this.payload();
    if (!payload || !this.simulation() || this.confirming()) return;

    this.error.set(null);
    this.confirming.set(true);
    this.api.confirmarImportacion(payload).pipe(finalize(() => this.confirming.set(false))).subscribe({
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

  private loadExamenes(procesoId: string, requestedExamen = ""): void {
    this.loadingExamenes.set(true);
    this.api.listExamenes(procesoId).pipe(finalize(() => this.loadingExamenes.set(false))).subscribe({
      next: (items) => {
        this.examenes.set(items);
        if (requestedExamen && items.some((item) => item.id === requestedExamen)) {
          this.examenId.set(requestedExamen);
        }
      },
      error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
  }

  private invalidateSimulation(): void {
    this.simulation.set(null);
    this.confirmed.set(null);
  }

  private payload(): ImportacionArchivos | null {
    const ficheroSirhus = this.ficheroSirhus();
    if (!this.procesoId() || !this.examenId() || !ficheroSirhus) return null;
    return {
      procesoSelectivoId: this.procesoId(),
      examenId: this.examenId(),
      ficheroSirhus,
      ficheroCaronte: this.ficheroCaronte(),
    };
  }
}
