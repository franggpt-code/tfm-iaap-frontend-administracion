import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { AdminApiService } from "./admin-api.service";

describe("AdminApiService", () => {
  let service: AdminApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AdminApiService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AdminApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it("lista perfiles de colaboración desde el endpoint ODS", () => {
    service.listPerfilesColaboracion().subscribe((perfiles) => {
      expect(perfiles).toEqual([
        {
          id: "perfil-1",
          codigo: "RESPONSABLE_DE_CENTRO",
          denominacion: "RESPONSABLE DE CENTRO",
          importeHora: 36.06,
        },
      ]);
    });

    const request = http.expectOne("/api/sicol/admin/perfiles-colaboracion");
    expect(request.request.method).toBe("GET");
    request.flush([
      {
        id: "perfil-1",
        codigo: "RESPONSABLE_DE_CENTRO",
        denominacion: "RESPONSABLE DE CENTRO",
        importeHora: 36.06,
      },
    ]);
  });

  it("crea asignaciones contra el examen seleccionado", () => {
    const payload = {
      examenAulaId: "aula-1",
      colaboradorId: "colaborador-1",
      perfilId: "perfil-1",
      horasRealizadas: 2,
    };

    service.createAsignacion("examen-1", payload).subscribe((asignacion) => {
      expect(asignacion.id).toBe("asignacion-1");
      expect(asignacion.importeTotal).toBe(72.12);
    });

    const request = http.expectOne("/api/sicol/admin/examenes/examen-1/asignaciones");
    expect(request.request.method).toBe("POST");
    expect(request.request.body).toEqual(payload);
    request.flush({
      id: "asignacion-1",
      examenId: "examen-1",
      examenAulaId: "aula-1",
      colaboradorId: "colaborador-1",
      perfilId: "perfil-1",
      perfilDenominacion: "RESPONSABLE DE CENTRO",
      horasRealizadas: 2,
      importeHora: 36.06,
      importeTotal: 72.12,
    });
  });

  it("actualiza horas y consulta el importe calculado de una asignación", () => {
    service.patchAsignacion("asignacion-1", { horasRealizadas: 3 }).subscribe((asignacion) => {
      expect(asignacion.horasRealizadas).toBe(3);
    });

    const patchRequest = http.expectOne("/api/sicol/admin/asignaciones/asignacion-1");
    expect(patchRequest.request.method).toBe("PATCH");
    expect(patchRequest.request.body).toEqual({ horasRealizadas: 3 });
    patchRequest.flush({
      id: "asignacion-1",
      examenId: "examen-1",
      examenAulaId: "aula-1",
      colaboradorId: "colaborador-1",
      perfilId: "perfil-1",
      perfilDenominacion: "RESPONSABLE DE CENTRO",
      horasRealizadas: 3,
      importeHora: 36.06,
      importeTotal: 108.18,
    });

    service.getImporteAsignacion("asignacion-1").subscribe((importe) => {
      expect(importe.importeTotal).toBe(108.18);
    });

    const importeRequest = http.expectOne("/api/sicol/admin/asignaciones/asignacion-1/importe");
    expect(importeRequest.request.method).toBe("GET");
    importeRequest.flush({
      asignacionId: "asignacion-1",
      horasRealizadas: 3,
      importeHora: 36.06,
      importeTotal: 108.18,
    });
  });

  it("consume control, hojas de firma y pagos por examen", () => {
    service.getResumenColaboraciones("examen-1").subscribe((resumen) => {
      expect(resumen.totalAsignaciones).toBe(1);
    });
    const resumenRequest = http.expectOne("/api/sicol/admin/examenes/examen-1/resumen-colaboraciones");
    expect(resumenRequest.request.method).toBe("GET");
    resumenRequest.flush({
      examenId: "examen-1",
      totalAsignaciones: 1,
      totalHoras: 2,
      totalImporte: 72.12,
      duplicidades: [],
      lineas: [],
    });

    service.getHojasFirma("examen-1").subscribe((hojas) => {
      expect(hojas.centros).toEqual([]);
    });
    const hojasRequest = http.expectOne("/api/sicol/admin/examenes/examen-1/hojas-firma");
    expect(hojasRequest.request.method).toBe("GET");
    hojasRequest.flush({ examenId: "examen-1", centros: [] });

    service.getPagos("examen-1").subscribe((pagos) => {
      expect(pagos.totalImporte).toBe(72.12);
    });
    const pagosRequest = http.expectOne("/api/sicol/admin/examenes/examen-1/pagos");
    expect(pagosRequest.request.method).toBe("GET");
    pagosRequest.flush({ examenId: "examen-1", totalImporte: 72.12, pagos: [] });
  });
});
