import { Component, inject, signal } from "@angular/core";
import { AdminApiService } from "../../../core/admin-api.service";
import { Examen, PagosColaboradores, ProcesoSelectivo } from "../../../core/api.models";
import { errorMessage, formatMoney } from "../shared/admin-ui";

@Component({
  selector: "app-pagos",
  templateUrl: "./pagos.component.html",
  styleUrl: "../admin-pages.scss",
})
export class PagosComponent {
  private readonly api = inject(AdminApiService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly procesos = signal<ProcesoSelectivo[]>([]);
  readonly examenes = signal<Examen[]>([]);
  readonly selectedProceso = signal<ProcesoSelectivo | null>(null);
  readonly selectedExamen = signal<Examen | null>(null);
  readonly pagos = signal<PagosColaboradores | null>(null);
  readonly money = formatMoney;

  constructor() {
    this.loadProcesos();
  }

  loadProcesos(): void {
    this.loading.set(true);
    this.api.listProcesosSelectivos(0, 50).subscribe({
      next: (page) => {
        this.loading.set(false);
        this.procesos.set(page.content);
        const first = page.content.at(0) ?? null;
        if (first) this.selectProceso(first);
      },
      error: (error) => {
        this.loading.set(false);
        this.error.set(errorMessage(error, "No se han podido cargar los procesos selectivos."));
      },
    });
  }

  selectProceso(proceso: ProcesoSelectivo): void {
    this.selectedProceso.set(proceso);
    this.pagos.set(null);
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
    this.api.getPagos(examen.id).subscribe({
      next: (pagos) => {
        this.loading.set(false);
        this.pagos.set(pagos);
      },
      error: (error) => {
        this.loading.set(false);
        this.error.set(errorMessage(error, "No se han podido cargar los datos de pagos."));
      },
    });
  }
}
