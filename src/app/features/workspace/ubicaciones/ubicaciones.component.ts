import { Component, inject, OnInit, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { finalize } from "rxjs";
import { apiErrorMessage } from "../../../api/api-error";
import { SicolApiClient } from "../../../api/sicol-api-client.service";
import { Aula, Centro, Provincia } from "../../../api/sicol.types";

@Component({
  selector: "app-ubicaciones",
  imports: [RouterLink],
  templateUrl: "./ubicaciones.component.html",
  styleUrl: "./ubicaciones.component.scss",
})
export class UbicacionesComponent implements OnInit {
  private readonly api = inject(SicolApiClient);
  readonly provincias = signal<Provincia[]>([]);
  readonly centros = signal<Centro[]>([]);
  readonly aulas = signal<Aula[]>([]);
  readonly provincia = signal<Provincia | null>(null);
  readonly centro = signal<Centro | null>(null);
  readonly loading = signal(true);
  readonly loadingChildren = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.api.listProvincias().pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (items) => this.provincias.set(items),
      error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
  }

  selectProvincia(item: Provincia): void {
    this.provincia.set(item);
    this.centro.set(null);
    this.centros.set([]);
    this.aulas.set([]);
    this.loadingChildren.set(true);
    this.api.listCentros(item.id).pipe(finalize(() => this.loadingChildren.set(false))).subscribe({
      next: (items) => this.centros.set(items),
      error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
  }

  selectCentro(item: Centro): void {
    this.centro.set(item);
    this.aulas.set([]);
    this.loadingChildren.set(true);
    this.api.listAulas(item.id).pipe(finalize(() => this.loadingChildren.set(false))).subscribe({
      next: (items) => this.aulas.set(items),
      error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
  }
}
