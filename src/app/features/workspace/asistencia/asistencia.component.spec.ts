import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";
import { SicolApiClient } from "../../../api/sicol-api-client.service";
import { ConvocadoExamen } from "../../../api/sicol.types";
import { AsistenciaComponent } from "./asistencia.component";

describe("AsistenciaComponent", () => {
  let fixture: ComponentFixture<AsistenciaComponent>;
  let api: jasmine.SpyObj<SicolApiClient>;
  const convocado: ConvocadoExamen = {
    id: "c1", examenId: "e1", examenAulaId: "a1", ordenAula: 1, activo: true, estadoAsistencia: "SIN_REGISTRAR",
    persona: { id: "p1", documentoIdentidad: "12345678Z", tipoDocumento: "DNI", nombre: "Ana", nombreCompleto: "Ana Prueba", sexo: "MUJER" },
  };

  beforeEach(async () => {
    api = jasmine.createSpyObj<SicolApiClient>("SicolApiClient", ["listConvocadosByAula", "updateAsistencia"]);
    api.listConvocadosByAula.and.returnValue(of([convocado]));
    await TestBed.configureTestingModule({ imports: [AsistenciaComponent], providers: [provideRouter([]), { provide: SicolApiClient, useValue: api }] }).compileComponents();
    fixture = TestBed.createComponent(AsistenciaComponent);
    fixture.detectChanges();
  });

  it("revierte la actualización optimista cuando la API falla", () => {
    api.updateAsistencia.and.returnValue(throwError(() => new Error("fallo")));
    fixture.componentInstance.update(convocado, "PRESENTE");
    expect(fixture.componentInstance.items()[0].estadoAsistencia).toBe("SIN_REGISTRAR");
    expect(fixture.componentInstance.rowErrors()["c1"]).toContain("inesperado");
  });

  it("conserva el estado devuelto por la API", () => {
    api.updateAsistencia.and.returnValue(of({ ...convocado, estadoAsistencia: "PRESENTE", asistenciaRegistradaAt: "2026-08-17T12:00:00Z" }));
    fixture.componentInstance.update(convocado, "PRESENTE");
    expect(fixture.componentInstance.items()[0].estadoAsistencia).toBe("PRESENTE");
    expect(fixture.componentInstance.items()[0].asistenciaRegistradaAt).toBeTruthy();
  });
});
