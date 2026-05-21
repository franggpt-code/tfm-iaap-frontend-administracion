import { Component, inject, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { finalize } from "rxjs";
import { AdminApiService } from "../../../core/admin-api.service";
import { Colaborador, ColaboradorCreate } from "../../../core/api.models";
import { errorMessage } from "../shared/admin-ui";

@Component({
  selector: "app-colaboradores",
  imports: [ReactiveFormsModule],
  templateUrl: "./colaboradores.component.html",
  styleUrl: "../admin-pages.scss",
})
export class ColaboradoresComponent {
  private readonly api = inject(AdminApiService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly colaboradores = signal<Colaborador[]>([]);
  readonly total = signal(0);
  readonly filtersOpen = signal(false);
  readonly editorOpen = signal(false);
  readonly editingId = signal<string | null>(null);

  readonly filters = this.fb.nonNullable.group({
    provincia: [""],
    localidad: [""],
    estado: [""],
  });

  readonly form = this.fb.nonNullable.group({
    dni: ["", [Validators.required, Validators.pattern(/^[0-9]{8}$/)]],
    letra: ["", [Validators.required, Validators.pattern(/^[A-Za-z]$/)]],
    nombreCompleto: ["", Validators.required],
    sexo: ["MUJER", Validators.required],
    iban: ["", Validators.required],
    correoCorporativo: ["", [Validators.required, Validators.email]],
    telefono: ["", Validators.required],
    provincia: [""],
    localidad: [""],
    rolesPreferidos: [""],
    observaciones: [""],
    perteneceCentroDirectivo: [false],
    estado: ["ACTIVO"],
  });

  constructor() {
    this.search();
  }

  toggleFilters(): void {
    this.filtersOpen.update((open) => !open);
  }

  toggleEditor(): void {
    this.editorOpen.update((open) => !open);
  }

  search(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .listColaboradores({ ...this.filters.getRawValue(), page: 0, size: 25 })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (page) => {
          this.colaboradores.set(page.content);
          this.total.set(page.totalElements);
        },
        error: (error) => this.error.set(errorMessage(error, "No se ha podido cargar el listado de colaboradores.")),
      });
  }

  clear(): void {
    this.filters.reset();
    this.search();
  }

  newColaborador(): void {
    this.editingId.set(null);
    this.form.reset({
      dni: "",
      letra: "",
      nombreCompleto: "",
      sexo: "MUJER",
      iban: "",
      correoCorporativo: "",
      telefono: "",
      provincia: "",
      localidad: "",
      rolesPreferidos: "",
      observaciones: "",
      perteneceCentroDirectivo: false,
      estado: "ACTIVO",
    });
    this.editorOpen.set(true);
  }

  edit(colaborador: Colaborador): void {
    this.editingId.set(colaborador.id);
    this.form.setValue({
      dni: colaborador.dni,
      letra: colaborador.letra,
      nombreCompleto: colaborador.nombreCompleto,
      sexo: colaborador.sexo,
      iban: colaborador.iban ?? "",
      correoCorporativo: colaborador.correoCorporativo,
      telefono: colaborador.telefono ?? "",
      provincia: colaborador.provincia ?? "",
      localidad: colaborador.localidad ?? "",
      rolesPreferidos: colaborador.rolesPreferidos.join(", "),
      observaciones: colaborador.observaciones ?? "",
      perteneceCentroDirectivo: colaborador.perteneceCentroDirectivo,
      estado: colaborador.estado,
    });
    this.editorOpen.set(true);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const id = this.editingId();
    const request = this.toRequest();
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    const operation = id
      ? this.api.patchColaborador(id, { ...request, estado: this.form.controls.estado.value })
      : this.api.createColaborador(request);

    operation.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.success.set(id ? "Colaborador actualizado correctamente." : "Colaborador creado correctamente.");
        this.newColaborador();
        this.editorOpen.set(false);
        this.search();
      },
      error: (error) => this.error.set(errorMessage(error, "No se ha podido guardar el colaborador.")),
    });
  }

  delete(colaborador: Colaborador): void {
    const confirmed = window.confirm(`Eliminar el colaborador ${colaborador.nombreCompleto}?`);
    if (!confirmed) {
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.api
      .deleteColaborador(colaborador.id)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.success.set("Colaborador eliminado correctamente.");
          this.search();
        },
        error: (error) => this.error.set(errorMessage(error, "No se ha podido eliminar el colaborador.")),
      });
  }

  importJson(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    file.text().then((content) => {
      const parsed = JSON.parse(content) as ColaboradorCreate | ColaboradorCreate[];
      const items = Array.isArray(parsed) ? parsed : [parsed];
      this.saving.set(true);
      this.error.set(null);
      this.success.set(null);
      this.api
        .importColaboradores(items)
        .pipe(finalize(() => {
          this.saving.set(false);
          input.value = "";
        }))
        .subscribe({
          next: () => {
            this.success.set(`${items.length} colaboradores importados correctamente.`);
            this.search();
          },
          error: (error) => this.error.set(errorMessage(error, "No se ha podido importar el fichero JSON.")),
        });
    }).catch(() => this.error.set("No se ha podido leer el fichero JSON."));
  }

  private toRequest(): ColaboradorCreate {
    const value = this.form.getRawValue();
    return {
      dni: value.dni,
      letra: value.letra.toUpperCase(),
      nombreCompleto: value.nombreCompleto,
      sexo: value.sexo,
      iban: value.iban,
      correoCorporativo: value.correoCorporativo,
      telefono: value.telefono,
      provincia: value.provincia,
      localidad: value.localidad,
      observaciones: value.observaciones,
      perteneceCentroDirectivo: value.perteneceCentroDirectivo,
      rolesPreferidos: value.rolesPreferidos.split(",").map((item) => item.trim()).filter(Boolean),
      disponibilidad: [],
    };
  }

  estadoLabel(estado: string): string {
    const labels: Record<string, string> = {
      ACTIVO: "Activo",
      PENDIENTE_VALIDACION: "Pendiente de validación",
      INACTIVO: "Inactivo",
    };
    return labels[estado] ?? estado;
  }
}
