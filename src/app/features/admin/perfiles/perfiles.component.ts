import { Component, inject, signal } from "@angular/core";
import { finalize } from "rxjs";
import { AdminApiService } from "../../../core/admin-api.service";
import { PerfilColaboracion } from "../../../core/api.models";
import { errorMessage, formatMoney } from "../shared/admin-ui";

@Component({
  selector: "app-perfiles",
  templateUrl: "./perfiles.component.html",
  styleUrl: "../admin-pages.scss",
})
export class PerfilesComponent {
  private readonly api = inject(AdminApiService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly perfiles = signal<PerfilColaboracion[]>([]);
  readonly money = formatMoney;

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .listPerfilesColaboracion()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (perfiles) => this.perfiles.set(perfiles),
        error: (error) => this.error.set(errorMessage(error, "No se han podido cargar los perfiles de colaboración.")),
      });
  }
}
