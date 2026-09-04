import { Component, OnInit, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { SicolApiClient } from "../../../api/sicol-api-client.service";
import { ConsultaAsistenciaPublica, ResultadoRespuestaAsistenciaPublica } from "../../../api/sicol.types";

@Component({
  selector: "app-confirmacion-publica",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./confirmacion-publica.component.html",
  styleUrls: ["./confirmacion-publica.component.scss"],
})
export class ConfirmacionPublicaComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(SicolApiClient);

  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly data = signal<ConsultaAsistenciaPublica | null>(null);
  readonly token = signal<string>("");

  readonly showRechazoForm = signal(false);
  readonly motivoRechazo = signal<string>("");
  readonly resultado = signal<ResultadoRespuestaAsistenciaPublica | null>(null);

  ngOnInit(): void {
    const tokenParam = this.route.snapshot.queryParamMap.get("token");
    const decisionParam = this.route.snapshot.queryParamMap.get("decision");

    if (!tokenParam || !tokenParam.trim()) {
      this.error.set("El enlace no contiene un token de identificación válido. Por favor, revise el correo recibido.");
      this.loading.set(false);
      return;
    }

    const tokenVal = tokenParam.trim();
    this.token.set(tokenVal);

    this.api.consultarAsistenciaPublica(tokenVal).subscribe({
      next: (res) => {
        this.data.set(res);
        this.loading.set(false);

        // Si en la URL venía indicada la acción inicial de rechazar, desplegamos directamente el formulario
        if (decisionParam?.toUpperCase() === "RECHAZADA") {
          this.showRechazoForm.set(true);
        }
      },
      error: (err) => {
        this.loading.set(false);
        const msg = err?.error?.message || "No se ha podido localizar el llamamiento. El enlace puede haber caducado o no ser válido.";
        this.error.set(msg);
      },
    });
  }

  confirmarAsistencia(): void {
    if (!this.token() || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);

    this.api.responderAsistenciaPublica({
      token: this.token(),
      decision: "CONFIRMADA",
    }).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.resultado.set(res);
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err?.error?.message || "Se produjo un error al registrar la confirmación. Inténtelo de nuevo.");
      },
    });
  }

  abrirRechazo(): void {
    this.showRechazoForm.set(true);
  }

  cancelarRechazo(): void {
    this.showRechazoForm.set(false);
    this.motivoRechazo.set("");
  }

  registrarRechazo(): void {
    if (!this.token() || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);

    const motivo = this.motivoRechazo().trim();

    this.api.responderAsistenciaPublica({
      token: this.token(),
      decision: "RECHAZADA",
      motivo: motivo || undefined,
    }).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.resultado.set(res);
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err?.error?.message || "Se produjo un error al registrar la renuncia. Inténtelo de nuevo.");
      },
    });
  }
}
