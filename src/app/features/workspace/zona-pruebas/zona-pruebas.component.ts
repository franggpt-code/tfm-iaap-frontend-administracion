import { Component, ElementRef, inject, OnInit, signal, ViewChild } from "@angular/core";
import { RouterLink } from "@angular/router";
import { finalize } from "rxjs";
import { apiErrorMessage } from "../../../api/api-error";
import { SicolApiClient } from "../../../api/sicol-api-client.service";
import { ProcesoSelectivo } from "../../../api/sicol.types";
import { AuthService } from "../../../core/auth.service";

@Component({
  selector: "app-zona-pruebas",
  imports: [RouterLink],
  templateUrl: "./zona-pruebas.component.html",
  styleUrl: "./zona-pruebas.component.scss",
})
export class ZonaPruebasComponent implements OnInit {
  private readonly api = inject(SicolApiClient);
  private readonly auth = inject(AuthService);

  @ViewChild("clearProcessesDialog") private clearProcessesDialog?: ElementRef<HTMLDialogElement>;

  readonly isAdmin = this.auth.isAdmin;

  readonly procesos = signal<ProcesoSelectivo[]>([]);
  readonly totalProcesos = signal<number>(0);
  readonly loading = signal(true);
  readonly clearingProcesses = signal(false);
  readonly cleanupAcknowledged = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  ngOnInit(): void {
    this.loadProcesos();
  }

  loadProcesos(): void {
    this.loading.set(true);
    this.clearMessages();
    this.api.listProcesos(0, 100).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (res) => {
        this.procesos.set(res.content);
        this.totalProcesos.set(res.totalElements ?? res.content.length);
      },
      error: (err: unknown) => this.error.set(apiErrorMessage(err)),
    });
  }

  askClearAllProcesses(): void {
    if (!this.isAdmin() || this.totalProcesos() === 0) return;
    this.clearMessages();
    this.cleanupAcknowledged.set(false);
    this.clearProcessesDialog?.nativeElement.showModal();
  }

  closeClearAllProcesses(): void {
    this.clearProcessesDialog?.nativeElement.close();
    this.cleanupAcknowledged.set(false);
  }

  confirmClearAllProcesses(): void {
    if (!this.cleanupAcknowledged() || this.clearingProcesses()) return;
    this.clearingProcesses.set(true);
    this.clearMessages();
    this.api.deleteAllProcesosForTesting().pipe(finalize(() => this.clearingProcesses.set(false))).subscribe({
      next: () => {
        this.closeClearAllProcesses();
        this.procesos.set([]);
        this.totalProcesos.set(0);
        this.success.set("Se han eliminado todos los procesos selectivos y sus datos operativos de prueba.");
      },
      error: (err: unknown) => {
        this.closeClearAllProcesses();
        this.error.set(apiErrorMessage(err));
      },
    });
  }

  clearMessages(): void {
    this.error.set(null);
    this.success.set(null);
  }
}
