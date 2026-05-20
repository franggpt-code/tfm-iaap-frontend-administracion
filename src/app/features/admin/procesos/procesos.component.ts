import { DatePipe } from "@angular/common";
import { Component, inject, signal } from "@angular/core";
import { finalize } from "rxjs";
import { AdminApiService } from "../../../core/admin-api.service";
import { CentroExamen, Examen, ExamenAula, ProcesoSelectivo } from "../../../core/api.models";
import { errorMessage } from "../shared/admin-ui";

@Component({
  selector: "app-procesos",
  imports: [DatePipe],
  templateUrl: "./procesos.component.html",
  styleUrl: "../admin-pages.scss",
})
export class ProcesosComponent {
  private readonly api = inject(AdminApiService);

  readonly loading = signal(false);
  readonly loadingDetail = signal(false);
  readonly error = signal<string | null>(null);
  readonly procesos = signal<ProcesoSelectivo[]>([]);
  readonly selectedProceso = signal<ProcesoSelectivo | null>(null);
  readonly selectedExamen = signal<Examen | null>(null);
  readonly examenes = signal<Examen[]>([]);
  readonly centros = signal<CentroExamen[]>([]);
  readonly aulas = signal<ExamenAula[]>([]);

  constructor() {
    this.loadProcesos();
  }

  loadProcesos(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .listProcesosSelectivos(0, 25)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (page) => {
          this.procesos.set(page.content);
          const first = page.content.at(0) ?? null;
          if (first) {
            this.selectProceso(first);
          }
        },
        error: (error) => this.error.set(errorMessage(error, "No se han podido cargar los procesos selectivos.")),
      });
  }

  selectProceso(proceso: ProcesoSelectivo): void {
    this.selectedProceso.set(proceso);
    this.selectedExamen.set(null);
    this.examenes.set([]);
    this.centros.set([]);
    this.aulas.set([]);
    this.loadingDetail.set(true);
    this.api
      .listExamenes(proceso.id)
      .pipe(finalize(() => this.loadingDetail.set(false)))
      .subscribe({
        next: (examenes) => {
          this.examenes.set(examenes);
          const first = examenes.at(0) ?? null;
          if (first) {
            this.selectExamen(first);
          }
        },
        error: (error) => this.error.set(errorMessage(error, "No se han podido cargar los exámenes del proceso.")),
      });
  }

  selectExamen(examen: Examen): void {
    this.selectedExamen.set(examen);
    this.loadingDetail.set(true);
    this.error.set(null);
    this.api
      .listCentros(examen.id)
      .pipe(finalize(() => this.loadingDetail.set(false)))
      .subscribe({
        next: (centros) => {
          this.centros.set(centros);
          this.aulas.set(centros.flatMap((centro) => centro.aulas));
        },
        error: () => {
          this.centros.set([]);
          this.api.listAulas(examen.id).subscribe({
            next: (aulas) => this.aulas.set(aulas),
            error: (error) => this.error.set(errorMessage(error, "No se han podido cargar centros y aulas del examen.")),
          });
        },
      });
  }
}
