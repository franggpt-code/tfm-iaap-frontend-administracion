import { Component, computed, inject, OnInit, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { finalize, forkJoin } from "rxjs";
import { apiErrorMessage } from "../../../api/api-error";
import { SicolApiClient } from "../../../api/sicol-api-client.service";
import {
  AsignacionColaborador,
  ConfiguracionInformes,
  ConvocadoExamen,
  Examen,
  HojasFirma,
  PagosColaboradores,
  ProcesoSelectivo,
  ResumenColaboraciones,
} from "../../../api/sicol.types";

type ReportType = "firmas" | "pagos";

interface SignaturePreviewRow {
  center: string;
  location: string;
  dni: string;
  name: string;
  profile: string;
}

@Component({
  selector: "app-informes",
  imports: [RouterLink],
  templateUrl: "./informes.component.html",
  styleUrl: "./informes.component.scss",
})
export class InformesComponent implements OnInit {
  private readonly api = inject(SicolApiClient);

  readonly procesos = signal<ProcesoSelectivo[]>([]);
  readonly examenes = signal<Examen[]>([]);
  readonly asignaciones = signal<AsignacionColaborador[]>([]);
  readonly convocados = signal<ConvocadoExamen[]>([]);
  readonly resumen = signal<ResumenColaboraciones | null>(null);
  readonly hojasFirma = signal<HojasFirma | null>(null);
  readonly pagos = signal<PagosColaboradores | null>(null);
  readonly reportConfiguration = signal<ConfiguracionInformes | null>(null);
  readonly selectedProcesoId = signal("");
  readonly selectedExamenId = signal("");
  readonly reportType = signal<ReportType>("firmas");
  readonly loading = signal(true);
  readonly reportLoading = signal(false);
  readonly exporting = signal<ReportType | null>(null);
  readonly error = signal<string | null>(null);

  readonly selectedProcess = computed(() => this.procesos().find(item => item.id === this.selectedProcesoId()));
  readonly selectedExam = computed(() => this.examenes().find(item => item.id === this.selectedExamenId()));
  readonly activeConvokedCount = computed(() => this.convocados().filter(item => item.activo).length);
  readonly missingHours = computed(() => this.asignaciones().filter(item => item.horasRealizadas == null).length);
  readonly missingIban = computed(() => this.pagos()?.pagos.filter(item => !item.iban?.trim()).length || 0);
  readonly missingReportParameters = computed(() => {
    const config = this.reportConfiguration();
    if (!config) return true;
    return [config.organismo, config.localidadFirma, config.nombreCertifica, config.cargoCertifica, config.nombreVistoBueno, config.cargoVistoBueno]
      .some(value => !value?.trim() || value.toLocaleLowerCase("es").includes("pendiente de configurar"));
  });
  readonly signatureRows = computed<SignaturePreviewRow[]>(() => {
    const rows: SignaturePreviewRow[] = [];
    for (const center of this.hojasFirma()?.centros || []) {
      for (const room of center.aulas) {
        for (const person of room.colaboradores) {
          rows.push({
            center: center.centroNombre === "AMBITO_GENERAL" ? "Ámbito general" : center.centroNombre,
            location: room.aulaNombre === "AMBITO_GENERAL" ? "Sin subcategoría" : room.aulaNombre,
            dni: this.maskDni(person.dni),
            name: person.nombreCompleto,
            profile: person.perfilDenominacion,
          });
        }
      }
    }
    return rows.sort((left, right) => left.center.localeCompare(right.center, "es") || left.location.localeCompare(right.location, "es") || left.name.localeCompare(right.name, "es"));
  });
  readonly commonGaps = computed(() => {
    const process = this.selectedProcess();
    const exam = this.selectedExam();
    const gaps: string[] = [];
    if (!process?.cuerpo) gaps.push("Cuerpo o especialidad");
    if (!process?.tipoAcceso) gaps.push("Sistema de acceso");
    if (!process?.oeps?.length) gaps.push("Oferta de empleo público");
    if (!exam?.fechaHora) gaps.push("Fecha de celebración");
    return gaps;
  });

  ngOnInit(): void {
    forkJoin({
      procesos: this.api.listProcesos(0, 200),
      configuration: this.api.getConfiguracionInformes(),
    }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: result => {
        this.procesos.set(result.procesos.content);
        this.reportConfiguration.set(result.configuration);
      },
      error: error => this.error.set(apiErrorMessage(error)),
    });
  }

  selectProcess(id: string): void {
    this.selectedProcesoId.set(id);
    this.selectedExamenId.set("");
    this.clearReport();
    if (!id) {
      this.examenes.set([]);
      return;
    }
    this.reportLoading.set(true);
    this.api.listExamenes(id).pipe(finalize(() => this.reportLoading.set(false))).subscribe({
      next: exams => this.examenes.set(exams),
      error: error => this.error.set(apiErrorMessage(error)),
    });
  }

  selectExam(id: string): void {
    this.selectedExamenId.set(id);
    this.clearReport();
    if (!id) return;
    this.reportLoading.set(true);
    this.error.set(null);
    forkJoin({
      asignaciones: this.api.listAsignaciones(id),
      convocados: this.api.listConvocadosByExamen(id),
      resumen: this.api.getResumenColaboraciones(id),
      hojasFirma: this.api.getHojasFirma(id),
      pagos: this.api.getPagos(id),
    }).pipe(finalize(() => this.reportLoading.set(false))).subscribe({
      next: result => {
        this.asignaciones.set(result.asignaciones);
        this.convocados.set(result.convocados);
        this.resumen.set(result.resumen);
        this.hojasFirma.set(result.hojasFirma);
        this.pagos.set(result.pagos);
      },
      error: error => this.error.set(apiErrorMessage(error)),
    });
  }

  exportPdf(type: ReportType): void {
    const examId = this.selectedExamenId();
    if (!examId || this.exporting()) return;
    this.exporting.set(type);
    this.error.set(null);
    const request = type === "firmas" ? this.api.exportHojasFirmaPdf(examId) : this.api.exportPagosPdf(examId);
    request.pipe(finalize(() => this.exporting.set(null))).subscribe({
      next: response => {
        if (!response.body) {
          this.error.set("El informe se ha generado sin contenido.");
          return;
        }
        const url = URL.createObjectURL(response.body);
        const link = document.createElement("a");
        link.href = url;
        link.download = this.downloadFilename(response.headers.get("Content-Disposition"), type);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: error => this.error.set(apiErrorMessage(error)),
    });
  }

  formatDate(value?: string): string {
    return value ? new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(new Date(value)) : "Pendiente";
  }

  money(value?: number | null): string {
    return value == null ? "—" : value.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
  }

  processLabel(process: ProcesoSelectivo): string {
    return `${process.codigoSirhus ? process.codigoSirhus + " · " : ""}${process.nombre}`;
  }

  private clearReport(): void {
    this.asignaciones.set([]);
    this.convocados.set([]);
    this.resumen.set(null);
    this.hojasFirma.set(null);
    this.pagos.set(null);
    this.error.set(null);
  }

  private maskDni(value: string): string {
    return value.length <= 4 ? "***" : `***${value.slice(-4)}`;
  }

  private downloadFilename(disposition: string | null, type: ReportType): string {
    const match = disposition?.match(/filename="?([^";]+)"?/i);
    return match?.[1] || (type === "firmas" ? "control-firmas.pdf" : "informe-pagos.pdf");
  }
}
