import { Component, computed, inject, signal } from "@angular/core";
import { DatePipe } from "@angular/common";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { finalize } from "rxjs";
import { AdminApiService } from "../../core/admin-api.service";
import { ApiError, Colaborador, Examen, ProcesoSelectivo } from "../../core/api.models";

@Component({
  selector: "app-admin-dashboard",
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: "./admin-dashboard.component.html",
  styleUrl: "./admin-dashboard.component.scss",
})
export class AdminDashboardComponent {
  private readonly api = inject(AdminApiService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly loadingDetail = signal(false);
  readonly error = signal<string | null>(null);
  readonly colaboradores = signal<Colaborador[]>([]);
  readonly procesos = signal<ProcesoSelectivo[]>([]);
  readonly selectedProceso = signal<ProcesoSelectivo | null>(null);
  readonly examenes = signal<Examen[]>([]);
  readonly totalColaboradores = signal(0);
  readonly totalProcesos = signal(0);
  readonly filtersOpen = signal(false);

  readonly filters = this.fb.nonNullable.group({
    provincia: [""],
    localidad: [""],
    estado: [""],
  });

  readonly activeColaboradores = computed(
    () => this.colaboradores().filter((colaborador) => colaborador.estado === "ACTIVO").length,
  );

  toggleFilters(): void {
    this.filtersOpen.update((open) => !open);
  }

  constructor() {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .loadDashboard()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ colaboradores, procesos }) => {
          this.colaboradores.set(colaboradores.content);
          this.totalColaboradores.set(colaboradores.totalElements);
          this.procesos.set(procesos.content);
          this.totalProcesos.set(procesos.totalElements);

          const firstProceso = procesos.content.at(0) ?? null;
          if (firstProceso) {
            this.selectProceso(firstProceso);
          }
        },
        error: (error: ApiError) => this.error.set(error.message ?? "No se han podido cargar los datos de administración."),
      });
  }

  searchColaboradores(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .listColaboradores({ ...this.filters.getRawValue(), page: 0, size: 10 })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (page) => {
          this.colaboradores.set(page.content);
          this.totalColaboradores.set(page.totalElements);
        },
        error: (error: ApiError) => this.error.set(error.message ?? "No se ha podido filtrar el listado de colaboradores."),
      });
  }

  clearFilters(): void {
    this.filters.reset();
    this.searchColaboradores();
  }

  selectProceso(proceso: ProcesoSelectivo): void {
    this.selectedProceso.set(proceso);
    this.loadingDetail.set(true);
    this.api
      .listExamenes(proceso.id)
      .pipe(finalize(() => this.loadingDetail.set(false)))
      .subscribe({
        next: (examenes) => this.examenes.set(examenes),
        error: () => this.examenes.set([]),
      });
  }

  estadoLabel(estado: string): string {
    const labels: Record<string, string> = {
      ACTIVO: "Activo",
      PENDIENTE_VALIDACION: "Pendiente de validación",
      INACTIVO: "Inactivo",
      BORRADOR: "Borrador",
      PUBLICADO: "Publicado",
      CERRADO: "Cerrado",
    };
    return labels[estado] ?? estado;
  }

  estadoClass(estado: string): string {
    if (estado === "ACTIVO" || estado === "PUBLICADO") {
      return "status-pill status-pill--success";
    }
    if (estado === "PENDIENTE_VALIDACION" || estado === "BORRADOR") {
      return "status-pill status-pill--warning";
    }
    return "status-pill";
  }
}
