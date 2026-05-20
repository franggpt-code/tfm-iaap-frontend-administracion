import { Component, inject, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { finalize } from "rxjs";
import { AdminApiService } from "../../../core/admin-api.service";
import { Colaborador } from "../../../core/api.models";
import { errorMessage } from "../shared/admin-ui";

@Component({
  selector: "app-colaboradores",
  imports: [ReactiveFormsModule],
  templateUrl: "./colaboradores.component.html",
  styleUrl: "../admin-pages.scss",
})
export class ColaboradoresComponent {
  private readonly api = inject(AdminApiService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly colaboradores = signal<Colaborador[]>([]);
  readonly total = signal(0);
  readonly filtersOpen = signal(false);

  readonly filters = this.fb.nonNullable.group({
    provincia: [""],
    localidad: [""],
    estado: [""],
  });

  constructor() {
    this.search();
  }

  toggleFilters(): void {
    this.filtersOpen.update((open) => !open);
  }

  search(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .listColaboradores({ ...this.filters.getRawValue(), page: 0, size: 25 })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (page) => {
          this.colaboradores.set(page.content);
          this.total.set(page.totalElements);
        },
        error: (error) => this.error.set(errorMessage(error, "No se ha podido cargar el listado de colaboradores.")),
      });
  }

  clear(): void {
    this.filters.reset();
    this.search();
  }

  estadoLabel(estado: string): string {
    const labels: Record<string, string> = {
      ACTIVO: "Activo",
      PENDIENTE_VALIDACION: "Pendiente de validación",
      INACTIVO: "Inactivo",
    };
    return labels[estado] ?? estado;
  }
}
