import { Component, inject, OnInit, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { forkJoin } from "rxjs";
import { apiErrorMessage } from "../../../api/api-error";
import { SicolApiClient } from "../../../api/sicol-api-client.service";

@Component({
  selector: "app-dashboard",
  imports: [RouterLink],
  templateUrl: "./dashboard.component.html",
  styleUrl: "./dashboard.component.scss",
})
export class DashboardComponent implements OnInit {
  private readonly api = inject(SicolApiClient);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly procesos = signal(0);
  readonly provincias = signal(0);

  ngOnInit(): void {
    forkJoin({ procesos: this.api.listProcesos(), provincias: this.api.listProvincias() }).subscribe({
      next: ({ procesos, provincias }) => {
        this.procesos.set(procesos.totalElements);
        this.provincias.set(provincias.length);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(apiErrorMessage(error));
        this.loading.set(false);
      },
    });
  }
}
