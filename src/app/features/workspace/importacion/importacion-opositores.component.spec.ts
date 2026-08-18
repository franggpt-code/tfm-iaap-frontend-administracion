import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { of } from "rxjs";
import { SicolApiClient } from "../../../api/sicol-api-client.service";
import { ImportacionResultado } from "../../../api/sicol.types";
import { ImportacionOpositoresComponent } from "./importacion-opositores.component";

describe("ImportacionOpositoresComponent", () => {
  let fixture: ComponentFixture<ImportacionOpositoresComponent>;
  let api: jasmine.SpyObj<SicolApiClient>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<SicolApiClient>("SicolApiClient", ["listProcesos", "getProceso", "listExamenes", "simularImportacion", "confirmarImportacion"]);
    api.listProcesos.and.returnValue(of({ content: [{ id: "p1", nombre: "Proceso 1", codigoSirhus: "L2A", estado: "PUBLICADO" }], page: 0, size: 20, totalElements: 1, totalPages: 1 }));
    api.listExamenes.and.returnValue(of([{ id: "e1", procesoSelectivoId: "p1", nombre: "Primer ejercicio", numeroEjercicio: 1 }]));

    await TestBed.configureTestingModule({
      imports: [ImportacionOpositoresComponent],
      providers: [provideRouter([]), { provide: SicolApiClient, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(ImportacionOpositoresComponent);
    fixture.detectChanges();
  });

  it("requiere proceso, examen y fichero SIRHUS", () => {
    expect(fixture.componentInstance.canSimulate()).toBeFalse();
    prepareSelection();
    expect(fixture.componentInstance.canSimulate()).toBeTrue();
  });

  it("busca procesos por nombre o código SIRHUS", async () => {
    fixture.componentInstance.onProcesoSearch("L2A");
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(api.listProcesos).toHaveBeenCalledWith(0, 20, "L2A");
  });

  it("rechaza ficheros con una extensión no admitida", () => {
    selectFile("input[type=file]", new File(["datos"], "listado.csv"));
    fixture.detectChanges();
    expect(fixture.componentInstance.ficheroSirhus()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain("extensión .xls o .xlsx");
  });

  it("simula sin Caronte y muestra extras y avisos", () => {
    const simulation = result(true);
    simulation.filasCaronteNoUtilizadas = 3;
    simulation.avisos = [{ origen: "CARONTE", fila: 8, mensaje: "Solicitud no convocada; se ignora." }];
    api.simularImportacion.and.returnValue(of(simulation));
    prepareSelection();
    fixture.componentInstance.simulate();
    fixture.detectChanges();

    expect(api.simularImportacion).toHaveBeenCalledWith(jasmine.objectContaining({ procesoSelectivoId: "p1", examenId: "e1", ficheroCaronte: null }));
    expect(fixture.nativeElement.textContent).toContain("Caronte no utilizadas");
    expect(fixture.nativeElement.textContent).toContain("Solicitud no convocada");
  });

  it("invalida la simulación al cambiar de fichero", () => {
    api.simularImportacion.and.returnValue(of(result(true)));
    prepareSelection();
    fixture.componentInstance.simulate();
    expect(fixture.componentInstance.simulation()).not.toBeNull();
    selectFile("input[type=file]", new File(["nuevo"], "nuevo.xlsx"));
    expect(fixture.componentInstance.simulation()).toBeNull();
  });

  it("confirma usando la selección vigente", () => {
    api.simularImportacion.and.returnValue(of(result(true)));
    api.confirmarImportacion.and.returnValue(of({ ...result(false), importacionId: "importacion-1" }));
    prepareSelection();
    fixture.componentInstance.simulate();
    fixture.componentInstance.confirm();
    expect(api.confirmarImportacion).toHaveBeenCalled();
    expect(fixture.componentInstance.confirmed()?.importacionId).toBe("importacion-1");
  });

  function prepareSelection(): void {
    fixture.componentInstance.selectProceso({ id: "p1", nombre: "Proceso 1", codigoSirhus: "L2A", estado: "PUBLICADO" });
    fixture.componentInstance.onExamenChange("e1");
    selectFile("input[type=file]", new File(["sirhus"], "sirhus.xlsx"));
  }

  function selectFile(selector: string, file: File): void {
    const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
    Object.defineProperty(input, "files", { configurable: true, value: [file] });
    input.dispatchEvent(new Event("change"));
  }
});

function result(simulacion: boolean): ImportacionResultado {
  return { simulacion, filasSirhus: 12, filasCaronte: 0, personasNuevas: 10, personasActualizadas: 2, convocadosNuevos: 10, convocadosActualizados: 2, provinciasNuevas: 1, centrosNuevos: 1, aulasNuevas: 2, filasCaronteNoUtilizadas: 0, convocadosPreviosNoIncluidos: 0, avisos: [] };
}
