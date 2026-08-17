import { Component, inject, OnInit, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { finalize } from "rxjs";
import { apiErrorMessage } from "../../../api/api-error";
import { SicolApiClient } from "../../../api/sicol-api-client.service";
import { Examen, ProcesoSelectivo } from "../../../api/sicol.types";

@Component({
  selector: "app-procesos-explorer",
  imports: [RouterLink],
  templateUrl: "./procesos-explorer.component.html",
  styleUrl: "./procesos-explorer.component.scss",
})
export class ProcesosExplorerComponent implements OnInit {
  private readonly api = inject(SicolApiClient);

  readonly procesos = signal<ProcesoSelectivo[]>([]);
  readonly selected = signal<ProcesoSelectivo | null>(null);
  readonly examenes = signal<Examen[]>([]);
  readonly loading = signal(true);
  readonly loadingExamenes = signal(false);
  readonly error = signal<string | null>(null);
  readonly search = signal("");

  ngOnInit(): void {
    this.api.listProcesos().pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (page) => this.procesos.set(page.content),
      error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
  }

  filteredProcesos(): ProcesoSelectivo[] {
    const term = this.search().trim().toLocaleLowerCase("es");
    return term ? this.procesos().filter((item) => `${item.nombre} ${item.codigoSirhus ?? ""}`.toLocaleLowerCase("es").includes(term)) : this.procesos();
  }

  selectProceso(proceso: ProcesoSelectivo): void {
    this.selected.set(proceso);
    this.examenes.set([]);
    this.error.set(null);
    this.loadingExamenes.set(true);
    this.api.listExamenes(proceso.id).pipe(finalize(() => this.loadingExamenes.set(false))).subscribe({
      next: (items) => this.examenes.set(items),
      error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
  }

  formatDate(value?: string): string {
    return value ? new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Fecha pendiente";
  }
}
