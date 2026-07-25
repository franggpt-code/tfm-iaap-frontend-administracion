import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { of, throwError } from "rxjs";
import { AdminApiService } from "../../../core/admin-api.service";
import { ImportacionesComponent } from "./importaciones.component";

describe("ImportacionesComponent", () => {
  let fixture: ComponentFixture<ImportacionesComponent>;
  let api: jasmine.SpyObj<AdminApiService>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<AdminApiService>("AdminApiService", ["importDatosBase"]);

    await TestBed.configureTestingModule({
      imports: [ImportacionesComponent],
      providers: [{ provide: AdminApiService, useValue: api }],
    }).compileComponents();

    fixture = TestBed.createComponent(ImportacionesComponent);
    fixture.detectChanges();
  });

  it("renderiza la pantalla de importación", () => {
    const title = fixture.nativeElement.querySelector("h1") as HTMLElement;
    expect(title.textContent).toContain("Importaciones");
    expect(fixture.nativeElement.textContent).toContain("Migración inicial");
    expect(fixture.nativeElement.textContent).toContain("asignaciones");
  });

  it("valida la extensión del fichero seleccionado", () => {
    selectFile(new File(["contenido"], "plantilla.pdf", { type: "application/pdf" }));
    fixture.detectChanges();

    expect(fixture.componentInstance.selectedFile()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain("Selecciona un fichero .ods, .xlsx, .xlsm o .xls.");

    const validFile = new File(["contenido"], "plantilla.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    selectFile(validFile);
    fixture.detectChanges();

    expect(fixture.componentInstance.selectedFile()).toBe(validFile);
    expect(fixture.componentInstance.fileError()).toBeNull();
  });

  it("envía el fichero y muestra el resumen de importación", () => {
    const file = new File(["contenido"], "plantilla.ods", { type: "application/vnd.oasis.opendocument.spreadsheet" });
    api.importDatosBase.and.returnValue(of({
      perfilesImportados: 0,
      procesosDetectados: 1,
      examenesImportados: 2,
      aulasImportadas: 3,
      colaboradoresImportados: 0,
      asignacionesImportadas: 4,
      filasOmitidas: 1,
      avisos: ["1 asignación duplicada omitida."],
    }));

    selectFile(file);
    fixture.detectChanges();
    fixture.debugElement.query(By.css(".button--primary")).nativeElement.click();
    fixture.detectChanges();

    expect(api.importDatosBase).toHaveBeenCalledOnceWith(file, true);
    expect(fixture.nativeElement.textContent).toContain("Exámenes importados");
    expect(fixture.nativeElement.textContent).toContain("2");
    expect(fixture.nativeElement.textContent).toContain("Aulas importadas");
    expect(fixture.nativeElement.textContent).toContain("3");
    expect(fixture.nativeElement.textContent).toContain("1 asignación duplicada omitida.");
  });

  it("muestra error cuando falla la importación", () => {
    const file = new File(["contenido"], "plantilla.xls", { type: "application/vnd.ms-excel" });
    api.importDatosBase.and.returnValue(throwError(() => ({ status: 500, message: "Error de servidor" })));

    selectFile(file);
    fixture.detectChanges();
    fixture.debugElement.query(By.css(".button--primary")).nativeElement.click();
    fixture.detectChanges();

    expect(api.importDatosBase).toHaveBeenCalledOnceWith(file, true);
    expect(fixture.nativeElement.textContent).toContain("Error de servidor");
  });

  function selectFile(file: File): void {
    const input = fixture.debugElement.query(By.css("input[type='file']")).nativeElement as HTMLInputElement;
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [file],
    });
    input.dispatchEvent(new Event("change"));
  }
});
