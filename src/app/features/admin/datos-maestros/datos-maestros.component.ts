import { Component, inject, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { finalize, forkJoin } from "rxjs";
import { AdminApiService } from "../../../core/admin-api.service";
import {
  Cuerpo,
  CuerpoCreateUpdate,
  Oep,
  OepCreateUpdate,
  TipoAcceso,
  TipoAccesoCreateUpdate,
  TipoVinculacion,
  TipoVinculacionCreateUpdate,
} from "../../../core/api.models";
import { errorMessage } from "../shared/admin-ui";

@Component({
  selector: "app-datos-maestros",
  imports: [ReactiveFormsModule],
  templateUrl: "./datos-maestros.component.html",
  styleUrl: "../admin-pages.scss",
})
export class DatosMaestrosComponent {
  private readonly api = inject(AdminApiService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly oeps = signal<Oep[]>([]);
  readonly tiposAcceso = signal<TipoAcceso[]>([]);
  readonly tiposVinculacion = signal<TipoVinculacion[]>([]);
  readonly cuerpos = signal<Cuerpo[]>([]);
  readonly editingOepId = signal<number | null>(null);
  readonly editingTipoAccesoId = signal<number | null>(null);
  readonly editingTipoVinculacionId = signal<number | null>(null);
  readonly editingCuerpoId = signal<number | null>(null);

  readonly oepForm = this.fb.nonNullable.group({
    anio: [new Date().getFullYear(), [Validators.required, Validators.min(2000)]],
    descripcion: [""],
    bojaRef: [""],
  });

  readonly tipoAccesoForm = this.fb.nonNullable.group({
    codigo: ["", Validators.required],
    descripcion: ["", Validators.required],
  });

  readonly tipoVinculacionForm = this.fb.nonNullable.group({
    codigo: ["", Validators.required],
    descripcion: ["", Validators.required],
  });

  readonly cuerpoForm = this.fb.nonNullable.group({
    codigo: ["", Validators.required],
    descripcion: ["", Validators.required],
    grupo: ["", Validators.required],
  });

  constructor() {
    this.loadDatosMaestros();
  }

  loadDatosMaestros(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      oeps: this.api.listOep(),
      tiposAcceso: this.api.listTiposAcceso(),
      tiposVinculacion: this.api.listTiposVinculacion(),
      cuerpos: this.api.listCuerpos(),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ oeps, tiposAcceso, tiposVinculacion, cuerpos }) => {
          this.oeps.set(oeps);
          this.tiposAcceso.set(tiposAcceso);
          this.tiposVinculacion.set(tiposVinculacion);
          this.cuerpos.set(cuerpos);
        },
        error: (error) => this.error.set(errorMessage(error, "No se han podido cargar los datos maestros.")),
      });
  }

  loadOep(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .listOep()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (oeps) => this.oeps.set(oeps),
        error: (error) => this.error.set(errorMessage(error, "No se han podido cargar las OEP.")),
      });
  }

  newOep(): void {
    this.editingOepId.set(null);
    this.oepForm.reset({
      anio: new Date().getFullYear(),
      descripcion: "",
      bojaRef: "",
    });
  }

  editOep(oep: Oep): void {
    this.editingOepId.set(oep.idOep);
    this.oepForm.setValue({
      anio: oep.anio,
      descripcion: oep.descripcion ?? "",
      bojaRef: oep.bojaRef ?? "",
    });
  }

  saveOep(): void {
    if (this.oepForm.invalid) {
      this.oepForm.markAllAsTouched();
      return;
    }
    const id = this.editingOepId();
    const value = this.oepForm.getRawValue();
    const request: OepCreateUpdate = {
      anio: value.anio,
      descripcion: value.descripcion,
      bojaRef: value.bojaRef,
    };
    const operation = id ? this.api.updateOep(id, request) : this.api.createOep(request);
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    operation.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.success.set(id ? "OEP actualizada correctamente." : "OEP creada correctamente.");
        this.newOep();
        this.loadOep();
      },
      error: (error) => this.error.set(errorMessage(error, "No se ha podido guardar la OEP.")),
    });
  }

  deleteOep(oep: Oep): void {
    if (!confirm(`¿Eliminar la OEP ${oep.anio}?`)) {
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.api.deleteOep(oep.idOep).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.success.set("OEP eliminada correctamente.");
        if (this.editingOepId() === oep.idOep) {
          this.newOep();
        }
        this.loadDatosMaestros();
      },
      error: (error) => this.error.set(errorMessage(error, "No se ha podido eliminar la OEP.")),
    });
  }

  newTipoAcceso(): void {
    this.editingTipoAccesoId.set(null);
    this.tipoAccesoForm.reset({ codigo: "", descripcion: "" });
  }

  editTipoAcceso(tipo: TipoAcceso): void {
    this.editingTipoAccesoId.set(tipo.idTipoAcceso);
    this.tipoAccesoForm.setValue({
      codigo: tipo.codigo,
      descripcion: tipo.descripcion,
    });
  }

  saveTipoAcceso(): void {
    if (this.tipoAccesoForm.invalid) {
      this.tipoAccesoForm.markAllAsTouched();
      return;
    }
    const id = this.editingTipoAccesoId();
    const request: TipoAccesoCreateUpdate = this.tipoAccesoForm.getRawValue();
    const operation = id ? this.api.updateTipoAcceso(id, request) : this.api.createTipoAcceso(request);
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    operation.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.success.set(id ? "Tipo de acceso actualizado correctamente." : "Tipo de acceso creado correctamente.");
        this.newTipoAcceso();
        this.loadDatosMaestros();
      },
      error: (error) => this.error.set(errorMessage(error, "No se ha podido guardar el tipo de acceso.")),
    });
  }

  deleteTipoAcceso(tipo: TipoAcceso): void {
    if (!confirm(`¿Eliminar el tipo de acceso ${tipo.codigo}?`)) {
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.api.deleteTipoAcceso(tipo.idTipoAcceso).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.success.set("Tipo de acceso eliminado correctamente.");
        if (this.editingTipoAccesoId() === tipo.idTipoAcceso) {
          this.newTipoAcceso();
        }
        this.loadDatosMaestros();
      },
      error: (error) => this.error.set(errorMessage(error, "No se ha podido eliminar el tipo de acceso.")),
    });
  }

  newTipoVinculacion(): void {
    this.editingTipoVinculacionId.set(null);
    this.tipoVinculacionForm.reset({ codigo: "", descripcion: "" });
  }

  editTipoVinculacion(tipo: TipoVinculacion): void {
    this.editingTipoVinculacionId.set(tipo.idTipoVinculacion);
    this.tipoVinculacionForm.setValue({
      codigo: tipo.codigo,
      descripcion: tipo.descripcion,
    });
  }

  saveTipoVinculacion(): void {
    if (this.tipoVinculacionForm.invalid) {
      this.tipoVinculacionForm.markAllAsTouched();
      return;
    }
    const id = this.editingTipoVinculacionId();
    const request: TipoVinculacionCreateUpdate = this.tipoVinculacionForm.getRawValue();
    const operation = id
      ? this.api.updateTipoVinculacion(id, request)
      : this.api.createTipoVinculacion(request);
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    operation.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.success.set(
          id ? "Tipo de vinculación actualizado correctamente." : "Tipo de vinculación creado correctamente.",
        );
        this.newTipoVinculacion();
        this.loadDatosMaestros();
      },
      error: (error) => this.error.set(errorMessage(error, "No se ha podido guardar el tipo de vinculación.")),
    });
  }

  deleteTipoVinculacion(tipo: TipoVinculacion): void {
    if (!confirm(`¿Eliminar el tipo de vinculación ${tipo.codigo}?`)) {
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.api.deleteTipoVinculacion(tipo.idTipoVinculacion).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.success.set("Tipo de vinculación eliminado correctamente.");
        if (this.editingTipoVinculacionId() === tipo.idTipoVinculacion) {
          this.newTipoVinculacion();
        }
        this.loadDatosMaestros();
      },
      error: (error) => this.error.set(errorMessage(error, "No se ha podido eliminar el tipo de vinculación.")),
    });
  }

  newCuerpo(): void {
    this.editingCuerpoId.set(null);
    this.cuerpoForm.reset({ codigo: "", descripcion: "", grupo: "" });
  }

  editCuerpo(cuerpo: Cuerpo): void {
    this.editingCuerpoId.set(cuerpo.idCuerpo);
    this.cuerpoForm.setValue({
      codigo: cuerpo.codigo,
      descripcion: cuerpo.descripcion,
      grupo: cuerpo.grupo,
    });
  }

  saveCuerpo(): void {
    if (this.cuerpoForm.invalid) {
      this.cuerpoForm.markAllAsTouched();
      return;
    }
    const id = this.editingCuerpoId();
    const request: CuerpoCreateUpdate = this.cuerpoForm.getRawValue();
    const operation = id ? this.api.updateCuerpo(id, request) : this.api.createCuerpo(request);
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    operation.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.success.set(id ? "Cuerpo actualizado correctamente." : "Cuerpo creado correctamente.");
        this.newCuerpo();
        this.loadDatosMaestros();
      },
      error: (error) => this.error.set(errorMessage(error, "No se ha podido guardar el cuerpo.")),
    });
  }

  deleteCuerpo(cuerpo: Cuerpo): void {
    if (!confirm(`¿Eliminar el cuerpo ${cuerpo.codigo}?`)) {
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.api.deleteCuerpo(cuerpo.idCuerpo).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.success.set("Cuerpo eliminado correctamente.");
        if (this.editingCuerpoId() === cuerpo.idCuerpo) {
          this.newCuerpo();
        }
        this.loadDatosMaestros();
      },
      error: (error) => this.error.set(errorMessage(error, "No se ha podido eliminar el cuerpo.")),
    });
  }
}
