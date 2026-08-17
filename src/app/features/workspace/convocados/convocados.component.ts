import { Component, computed, inject, OnInit, signal } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { finalize } from "rxjs";
import { apiErrorMessage } from "../../../api/api-error";
import { SicolApiClient } from "../../../api/sicol-api-client.service";
import { ConvocadoExamen, EstadoAsistencia } from "../../../api/sicol.types";

@Component({
  selector: "app-convocados",
  imports: [RouterLink],
  templateUrl: "./convocados.component.html",
  styleUrl: "./convocados.component.scss",
})
export class ConvocadosComponent implements OnInit {
  private readonly api = inject(SicolApiClient);
  private readonly route = inject(ActivatedRoute);

  readonly procesoId = this.route.snapshot.paramMap.get("procesoId") ?? "";
  readonly examenId = this.route.snapshot.paramMap.get("examenId") ?? "";
  readonly items = signal<ConvocadoExamen[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly text = signal("");
  readonly centro = signal("");
  readonly aula = signal("");
  readonly estado = signal<EstadoAsistencia | "">("");

  readonly centros = computed(() => [...new Set(this.items().map((item) => item.centroNombre).filter(Boolean) as string[])].sort());
  readonly aulas = computed(() => [...new Set(this.items().filter((item) => !this.centro() || item.centroNombre === this.centro()).map((item) => item.aulaNombre).filter(Boolean) as string[])].sort());
  readonly filtered = computed(() => {
    const term = this.text().trim().toLocaleLowerCase("es");
    return this.items().filter((item) => {
      const matchesText = !term || `${item.persona.nombreCompleto} ${item.persona.documentoIdentidad}`.toLocaleLowerCase("es").includes(term);
      return matchesText && (!this.centro() || item.centroNombre === this.centro()) && (!this.aula() || item.aulaNombre === this.aula()) && (!this.estado() || item.estadoAsistencia === this.estado());
    });
  });

  ngOnInit(): void {
    this.api.listConvocadosByExamen(this.examenId).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (items) => this.items.set(items),
      error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
  }

  onCentro(value: string): void { this.centro.set(value); this.aula.set(""); }
  clearFilters(): void { this.text.set(""); this.centro.set(""); this.aula.set(""); this.estado.set(""); }

  maskedDocument(value: string): string {
    if (value.length <= 4) return "••••";
    return `${value.slice(0, 2)}${"•".repeat(Math.max(4, value.length - 4))}${value.slice(-2)}`;
  }

  stateLabel(value: EstadoAsistencia): string {
    return { SIN_REGISTRAR: "Sin registrar", PRESENTE: "Presente", AUSENTE: "Ausente" }[value];
  }
}
