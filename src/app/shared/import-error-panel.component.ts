import { Component, input } from "@angular/core";
import { ImportErrorDiagnostic } from "../api/api-error";

@Component({
  selector: "app-import-error-panel",
  templateUrl: "./import-error-panel.component.html",
  styleUrl: "./import-error-panel.component.scss",
})
export class ImportErrorPanelComponent {
  readonly diagnostic = input.required<ImportErrorDiagnostic>();

  async copyDiagnostic(): Promise<void> {
    const diagnostic = this.diagnostic();
    const lines = [
      `Operación: ${diagnostic.operation}`,
      `Momento: ${diagnostic.occurredAt}`,
      `Mensaje: ${diagnostic.summary}`,
      diagnostic.status ? `HTTP: ${diagnostic.status}` : null,
      diagnostic.code ? `Código: ${diagnostic.code}` : null,
      diagnostic.traceId ? `Identificador: ${diagnostic.traceId}` : null,
      ...diagnostic.context.map((item) => `${item.label}: ${item.value}`),
      ...diagnostic.details.map((item) => `${item.field ? `${item.field}: ` : ""}${item.issue}`),
    ].filter((line): line is string => !!line);
    await navigator.clipboard?.writeText(lines.join("\n"));
  }
}