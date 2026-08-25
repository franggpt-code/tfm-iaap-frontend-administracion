import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { SicolApiClient } from "./sicol-api-client.service";

describe("SicolApiClient", () => {
  let service: SicolApiClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [SicolApiClient, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SicolApiClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it("busca procesos de forma paginada y permite recuperar la selección por id", () => {
    service.listProcesos(0, 20, "L2A").subscribe();
    const listRequest = http.expectOne((request) => request.url === "/api/sicol/admin/procesos-selectivos");
    expect(listRequest.request.params.get("page")).toBe("0");
    expect(listRequest.request.params.get("size")).toBe("20");
    expect(listRequest.request.params.get("search")).toBe("L2A");
    listRequest.flush({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });

    service.getProceso("p1").subscribe();
    const detailRequest = http.expectOne("/api/sicol/admin/procesos-selectivos/p1");
    expect(detailRequest.request.method).toBe("GET");
    detailRequest.flush({ id: "p1", nombre: "Proceso 1", estado: "PUBLICADO" });
  });

  it("envía la simulación como multipart sin fijar Content-Type", () => {
    const sirhus = new File(["sirhus"], "sirhus.xlsx");
    const caronte = new File(["caronte"], "caronte.xls");
    service.simularImportacion({ procesoSelectivoId: "p1", examenId: "e1", ficheroSirhus: sirhus, ficheroCaronte: caronte }).subscribe();

    const request = http.expectOne("/api/sicol/admin/importaciones/opositores-aulas/simulacion");
    expect(request.request.method).toBe("POST");
    expect(request.request.headers.has("Content-Type")).toBeFalse();
    const body = request.request.body as FormData;
    expect(body.get("procesoSelectivoId")).toBe("p1");
    expect(body.get("examenId")).toBe("e1");
    expect(body.get("ficheroSirhus")).toBe(sirhus);
    expect(body.get("ficheroCaronte")).toBe(caronte);
    request.flush(result(true));
  });

  it("omite Caronte cuando no se proporciona", () => {
    const sirhus = new File(["sirhus"], "sirhus.xlsx");
    service.confirmarImportacion({ procesoSelectivoId: "p1", examenId: "e1", ficheroSirhus: sirhus }).subscribe();
    const request = http.expectOne("/api/sicol/admin/importaciones/opositores-aulas");
    expect((request.request.body as FormData).has("ficheroCaronte")).toBeFalse();
    request.flush({ ...result(false), importacionId: "i1" });
  });


  it("envía las asignaciones históricas como multipart con proceso y examen", () => {
    const fichero = new File(["asignaciones"], "asignaciones.xlsx");
    service.simularImportacionAsignacionesHistoricas("p1", "e1", fichero).subscribe();

    const request = http.expectOne("/api/sicol/admin/importaciones/asignaciones-historicas/simulacion");
    expect(request.request.method).toBe("POST");
    expect(request.request.headers.has("Content-Type")).toBeFalse();
    const body = request.request.body as FormData;
    expect(body.get("procesoSelectivoId")).toBe("p1");
    expect(body.get("examenId")).toBe("e1");
    expect(body.get("fichero")).toBe(fichero);
    request.flush({ simulacion: true, filasLeidas: 1, filasValidas: 1, asignacionesCreadas: 1,
      asignacionesActualizadas: 0, horasInformadas: 0, ambitosGenerales: 0, filasOmitidas: 0, avisos: [] });
  });
  it("envía el Datamart como multipart con el campo fichero", () => {
    const fichero = new File(["datamart"], "seguimiento-convocatorias.xls", { type: "application/vnd.ms-excel" });
    service.simularImportacionDatamart(fichero).subscribe();

    const simulationRequest = http.expectOne("/api/sicol/admin/importaciones/datamart-convocatorias/simulacion");
    expect(simulationRequest.request.method).toBe("POST");
    expect(simulationRequest.request.headers.has("Content-Type")).toBeFalse();
    expect((simulationRequest.request.body as FormData).get("fichero")).toBe(fichero);
    simulationRequest.flush(datamartResult(true));

    service.confirmarImportacionDatamart(fichero).subscribe();
    const confirmationRequest = http.expectOne("/api/sicol/admin/importaciones/datamart-convocatorias");
    expect(confirmationRequest.request.method).toBe("POST");
    expect(confirmationRequest.request.headers.has("Content-Type")).toBeFalse();
    expect((confirmationRequest.request.body as FormData).get("fichero")).toBe(fichero);
    confirmationRequest.flush({ ...datamartResult(false), importacionId: "i2" });
  });

  it("crea y actualiza procesos y ejercicios con los endpoints del contrato", () => {
    service.createProceso({ nombre: "Proceso manual", codigoSirhus: "L2A11300" }).subscribe();
    const createProcess = http.expectOne("/api/sicol/admin/procesos-selectivos");
    expect(createProcess.request.method).toBe("POST");
    expect(createProcess.request.body).toEqual({ nombre: "Proceso manual", codigoSirhus: "L2A11300" });
    createProcess.flush({ id: "p1", nombre: "Proceso manual", codigoSirhus: "L2A11300", estado: "BORRADOR" });

    service.updateProceso("p1", { estado: "PUBLICADO" }).subscribe();
    const updateProcess = http.expectOne("/api/sicol/admin/procesos-selectivos/p1");
    expect(updateProcess.request.method).toBe("PATCH");
    updateProcess.flush({ id: "p1", nombre: "Proceso manual", estado: "PUBLICADO" });

    service.createExamen("p1", { nombre: "Ejercicio 2", numeroEjercicio: 2 }).subscribe();
    const createExam = http.expectOne("/api/sicol/admin/procesos-selectivos/p1/examenes");
    expect(createExam.request.method).toBe("POST");
    createExam.flush({ id: "e2", procesoSelectivoId: "p1", nombre: "Ejercicio 2", numeroEjercicio: 2 });

    service.updateExamen("e2", { fechaHora: "2026-09-20T08:00:00.000Z" }).subscribe();
    const updateExam = http.expectOne("/api/sicol/admin/examenes/e2");
    expect(updateExam.request.method).toBe("PATCH");
    expect(updateExam.request.body).toEqual({ fechaHora: "2026-09-20T08:00:00.000Z" });
    updateExam.flush({ id: "e2", procesoSelectivoId: "p1", nombre: "Ejercicio 2", numeroEjercicio: 2, fechaHora: "2026-09-20T08:00:00.000Z" });
  });

  it("envía cambios masivos de estado y asignaciones de ámbito general", () => {
    service.cambiarEstadoColaboradores({ ids: ["c1", "c2"], estado: "ACTIVO" }).subscribe();
    const bulkState = http.expectOne("/api/sicol/admin/colaboradores/estado");
    expect(bulkState.request.method).toBe("PATCH");
    expect(bulkState.request.body).toEqual({ ids: ["c1", "c2"], estado: "ACTIVO" });
    bulkState.flush(null);

    service.createAsignacion("e1", { ambitoGeneral: true, examenAulaId: null, colaboradorId: "c1", perfilId: "p1", estadoConfirmacion: "PENDIENTE" }).subscribe();
    const createAssignment = http.expectOne("/api/sicol/admin/examenes/e1/asignaciones");
    expect(createAssignment.request.method).toBe("POST");
    expect(createAssignment.request.body).toEqual({ ambitoGeneral: true, examenAulaId: null, colaboradorId: "c1", perfilId: "p1", estadoConfirmacion: "PENDIENTE" });
    createAssignment.flush({ id: "a1", examenId: "e1", colaboradorId: "c1", perfilId: "p1", perfilDenominacion: "Responsable de datos", importeHora: 0, estadoConfirmacion: "PENDIENTE" });
  });

  it("descarga los informes como PDF y guarda sus parámetros maestros", () => {
    service.exportHojasFirmaPdf("e1").subscribe(response => expect(response.body?.type).toBe("application/pdf"));
    const signatures = http.expectOne("/api/sicol/admin/examenes/e1/hojas-firma.pdf");
    expect(signatures.request.method).toBe("GET");
    expect(signatures.request.responseType).toBe("blob");
    signatures.flush(new Blob(["%PDF"], { type: "application/pdf" }), { headers: { "Content-Type": "application/pdf" } });

    const configuration = {
      organismo: "IAAP", localidadFirma: "Sevilla", nombreCertifica: "Persona A", cargoCertifica: "Jefatura",
      nombreVistoBueno: "Persona B", cargoVistoBueno: "Dirección",
    };
    service.updateConfiguracionInformes(configuration).subscribe();
    const update = http.expectOne("/api/sicol/admin/configuracion-informes");
    expect(update.request.method).toBe("PUT");
    expect(update.request.body).toEqual(configuration);
    update.flush(configuration);
  });
});

function result(simulacion: boolean) {
  return { simulacion, filasSirhus: 1, filasCaronte: 0, personasNuevas: 1, personasActualizadas: 0, convocadosNuevos: 1, convocadosActualizados: 0, provinciasNuevas: 0, centrosNuevos: 0, aulasNuevas: 0, filasCaronteNoUtilizadas: 0, convocadosPreviosNoIncluidos: 0, avisos: [] };
}

function datamartResult(simulacion: boolean) {
  return { simulacion, filasLeidas: 20, procesosCreados: 2, procesosActualizados: 1, examenesCreados: 3, examenesActualizados: 0, pruebasCreadas: 3, pruebasActualizadas: 0, oepAsociadas: 2, filasRawGuardadas: 0, avisos: [] };
}
