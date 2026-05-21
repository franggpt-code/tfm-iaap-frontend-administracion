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

  it("consume operaciones de escritura de colaboradores", () => {
    const payload = {
      dni: "12345678",
      letra: "Z",
      nombreCompleto: "Persona Colaboradora",
      sexo: "MUJER",
      iban: "ES0000000000000000000000",
      correoCorporativo: "persona@juntadeandalucia.es",
      telefono: "600000000",
      perteneceCentroDirectivo: false,
      rolesPreferidos: [],
      disponibilidad: [],
    };

    service.createColaborador(payload).subscribe((colaborador) => {
      expect(colaborador.id).toBe("colaborador-1");
    });
    const createRequest = http.expectOne("/api/sicol/admin/colaboradores");
    expect(createRequest.request.method).toBe("POST");
    expect(createRequest.request.body).toEqual(payload);
    createRequest.flush({ ...payload, id: "colaborador-1", provincia: "", localidad: "", estado: "ACTIVO" });

    service.importColaboradores([payload]).subscribe((colaboradores) => {
      expect(colaboradores.length).toBe(1);
    });
    const importRequest = http.expectOne("/api/sicol/admin/colaboradores/importacion");
    expect(importRequest.request.method).toBe("POST");
    expect(importRequest.request.body).toEqual([payload]);
    importRequest.flush([{ ...payload, id: "colaborador-2", provincia: "", localidad: "", estado: "PENDIENTE_VALIDACION" }]);

    service.patchColaborador("colaborador-1", { estado: "INACTIVO" }).subscribe((colaborador) => {
      expect(colaborador.estado).toBe("INACTIVO");
    });
    const patchRequest = http.expectOne("/api/sicol/admin/colaboradores/colaborador-1");
    expect(patchRequest.request.method).toBe("PATCH");
    expect(patchRequest.request.body).toEqual({ estado: "INACTIVO" });
    patchRequest.flush({ ...payload, id: "colaborador-1", provincia: "", localidad: "", estado: "INACTIVO" });

    service.deleteColaborador("colaborador-1").subscribe((response) => {
      expect(response).toBeNull();
    });
    const deleteRequest = http.expectOne("/api/sicol/admin/colaboradores/colaborador-1");
    expect(deleteRequest.request.method).toBe("DELETE");
    deleteRequest.flush(null);
  });

  it("consume operaciones de escritura de procesos y exámenes", () => {
    service.createProcesoSelectivo({ nombre: "Proceso 2026" }).subscribe((proceso) => {
      expect(proceso.id).toBe("proceso-1");
    });
    const createProcesoRequest = http.expectOne("/api/sicol/admin/procesos-selectivos");
    expect(createProcesoRequest.request.method).toBe("POST");
    createProcesoRequest.flush({
      id: "proceso-1",
      nombre: "Proceso 2026",
      oep: "",
      acceso: "",
      cuerpo: "",
      modo: "",
      estado: "BORRADOR",
    });

    service.importProcesosSelectivos([{ nombre: "Proceso importado" }]).subscribe((procesos) => {
      expect(procesos.length).toBe(1);
    });
    const importProcesosRequest = http.expectOne("/api/sicol/admin/procesos-selectivos/importacion");
    expect(importProcesosRequest.request.method).toBe("POST");
    expect(importProcesosRequest.request.body).toEqual([{ nombre: "Proceso importado" }]);
    importProcesosRequest.flush([
      {
        id: "proceso-2",
        nombre: "Proceso importado",
        oep: "",
        acceso: "",
        cuerpo: "",
        modo: "",
        estado: "BORRADOR",
      },
    ]);

    service.patchProcesoSelectivo("proceso-1", { estado: "PUBLICADO" }).subscribe((proceso) => {
      expect(proceso.estado).toBe("PUBLICADO");
    });
    const patchProcesoRequest = http.expectOne("/api/sicol/admin/procesos-selectivos/proceso-1");
    expect(patchProcesoRequest.request.method).toBe("PATCH");
    expect(patchProcesoRequest.request.body).toEqual({ estado: "PUBLICADO" });
    patchProcesoRequest.flush({
      id: "proceso-1",
      nombre: "Proceso 2026",
      oep: "",
      acceso: "",
      cuerpo: "",
      modo: "",
      estado: "PUBLICADO",
    });

    service.createExamen("proceso-1", { nombre: "Primer ejercicio", fechaHora: "2026-06-20T09:00:00Z", numeroEjercicio: 1 }).subscribe((examen) => {
      expect(examen.id).toBe("examen-1");
    });
    const createExamenRequest = http.expectOne("/api/sicol/admin/procesos-selectivos/proceso-1/examenes");
    expect(createExamenRequest.request.method).toBe("POST");
    createExamenRequest.flush({
      id: "examen-1",
      procesoSelectivoId: "proceso-1",
      nombre: "Primer ejercicio",
      fechaHora: "2026-06-20T09:00:00Z",
      numeroEjercicio: 1,
    });

    const examenImportado = { nombre: "Segundo ejercicio", fechaHora: "2026-06-21T09:00:00Z", numeroEjercicio: 2 };
    service.importExamenes("proceso-1", [examenImportado]).subscribe((examenes) => {
      expect(examenes.length).toBe(1);
    });
    const importExamenesRequest = http.expectOne("/api/sicol/admin/procesos-selectivos/proceso-1/examenes/importacion");
    expect(importExamenesRequest.request.method).toBe("POST");
    expect(importExamenesRequest.request.body).toEqual([examenImportado]);
    importExamenesRequest.flush([{ ...examenImportado, id: "examen-2", procesoSelectivoId: "proceso-1" }]);

    service.patchExamen("examen-1", { numeroEjercicio: 2 }).subscribe((examen) => {
      expect(examen.numeroEjercicio).toBe(2);
    });
    const patchExamenRequest = http.expectOne("/api/sicol/admin/examenes/examen-1");
    expect(patchExamenRequest.request.method).toBe("PATCH");
    patchExamenRequest.flush({
      id: "examen-1",
      procesoSelectivoId: "proceso-1",
      nombre: "Primer ejercicio",
      fechaHora: "2026-06-20T09:00:00Z",
      numeroEjercicio: 2,
    });

    service.deleteExamen("examen-1").subscribe((response) => {
      expect(response).toBeNull();
    });
    const deleteExamenRequest = http.expectOne("/api/sicol/admin/examenes/examen-1");
    expect(deleteExamenRequest.request.method).toBe("DELETE");
    deleteExamenRequest.flush(null);

    service.deleteProcesoSelectivo("proceso-1").subscribe((response) => {
      expect(response).toBeNull();
    });
    const deleteProcesoRequest = http.expectOne("/api/sicol/admin/procesos-selectivos/proceso-1");
    expect(deleteProcesoRequest.request.method).toBe("DELETE");
    deleteProcesoRequest.flush(null);
  });

  it("importa datos base con multipart/form-data y campo fichero", () => {
    const file = new File(["contenido"], "plantilla.ods", { type: "application/vnd.oasis.opendocument.spreadsheet" });

    service.importDatosBase(file).subscribe((result) => {
      expect(result.examenesImportados).toBe(1);
      expect(result.aulasImportadas).toBe(1);
    });

    const request = http.expectOne("/api/sicol/admin/importaciones/datos-base");
    expect(request.request.method).toBe("POST");
    expect(request.request.body instanceof FormData).toBeTrue();
    expect((request.request.body as FormData).get("fichero")).toBe(file);
    expect(request.request.headers.has("Content-Type")).toBeFalse();
    request.flush({
      perfilesImportados: 0,
      procesosDetectados: 1,
      examenesImportados: 1,
      aulasImportadas: 1,
      colaboradoresImportados: 0,
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
