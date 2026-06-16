import { Component, inject, signal } from "@angular/core";
import { finalize } from "rxjs";
import { AdminApiService } from "../../../core/admin-api.service";
import { Examen, ProcesoSelectivo, ResumenColaboraciones } from "../../../core/api.models";
import { errorMessage, formatMoney, formatProcesoCuerpo, formatProcesoOeps } from "../shared/admin-ui";

@Component({
  selector: "app-control",
  templateUrl: "./control.component.html",
  styleUrl: "../admin-pages.scss",
})
export class ControlComponent {
  private readonly api = inject(AdminApiService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly procesos = signal<ProcesoSelectivo[]>([]);
  readonly examenes = signal<Examen[]>([]);
  readonly selectedProceso = signal<ProcesoSelectivo | null>(null);
  readonly selectedExamen = signal<Examen | null>(null);
  readonly resumen = signal<ResumenColaboraciones | null>(null);
  readonly money = formatMoney;
  readonly formatOeps = formatProcesoOeps;
  readonly formatCuerpo = formatProcesoCuerpo;

  constructor() {
    this.loadProcesos();
  }

  loadProcesos(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .listProcesosSelectivos(0, 50)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (page) => {
          this.procesos.set(page.content);
          const first = page.content.at(0) ?? null;
          if (first) this.selectProceso(first);
        },
        error: (error) => this.error.set(errorMessage(error, "No se han podido cargar los procesos selectivos.")),
      });
  }

  selectProceso(proceso: ProcesoSelectivo): void {
    this.selectedProceso.set(proceso);
    this.resumen.set(null);
    this.api.listExamenes(proceso.id).subscribe({
      next: (examenes) => {
        this.examenes.set(examenes);
        const first = examenes.at(0) ?? null;
        if (first) this.selectExamen(first);
      },
      error: (error) => this.error.set(errorMessage(error, "No se han podido cargar los exámenes.")),
    });
  }

  selectExamen(examen: Examen): void {
    this.selectedExamen.set(examen);
    this.loading.set(true);
    this.error.set(null);
    this.api
      .getResumenColaboraciones(examen.id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (resumen) => this.resumen.set(resumen),
        error: (error) => this.error.set(errorMessage(error, "No se ha podido cargar el resumen de control.")),
      });
  }
}
