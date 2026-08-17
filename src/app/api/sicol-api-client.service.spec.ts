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
});

function result(simulacion: boolean) {
  return { simulacion, filasSirhus: 1, filasCaronte: 0, personasNuevas: 1, personasActualizadas: 0, convocadosNuevos: 1, convocadosActualizados: 0, provinciasNuevas: 0, centrosNuevos: 0, aulasNuevas: 0, filasCaronteNoUtilizadas: 0, convocadosPreviosNoIncluidos: 0, avisos: [] };
}
