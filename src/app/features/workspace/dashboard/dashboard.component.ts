import { DatePipe } from "@angular/common";
import { Component, computed, inject, OnInit, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { finalize } from "rxjs";
import { apiErrorMessage } from "../../../api/api-error";
import { SicolApiClient } from "../../../api/sicol-api-client.service";
import { CuadroMandoAdministracion } from "../../../api/sicol.types";
import { AuthService } from "../../../core/auth.service";

@Component({
  selector: "app-dashboard",
  imports: [DatePipe, RouterLink],
  templateUrl: "./dashboard.component.html",
  styleUrl: "./dashboard.component.scss",
})
export class DashboardComponent implements OnInit {
  private readonly api = inject(SicolApiClient);
  private readonly auth = inject(AuthService);

  readonly isManager = this.auth.isManager;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly resumen = signal<CuadroMandoAdministracion | null>(null);
  readonly aulasCubiertas = computed(() => Math.max(0, (this.resumen()?.totalAulas ?? 0) - (this.resumen()?.aulasSinResponsable ?? 0)));
  readonly coberturaPorcentaje = computed(() => {
    const total = this.resumen()?.totalAulas ?? 0;
    return total ? Math.round((this.aulasCubiertas() / total) * 100) : 100;
  });
  readonly confirmacionPorcentaje = computed(() => {
    const total = this.resumen()?.totalAsignaciones ?? 0;
    return total ? Math.round(((this.resumen()?.asignacionesConfirmadas ?? 0) / total) * 100) : 0;
  });

  ngOnInit(): void {
    this.api.getCuadroMandoAdministracion().pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (resumen) => this.resumen.set(resumen),
      error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
  }
}
