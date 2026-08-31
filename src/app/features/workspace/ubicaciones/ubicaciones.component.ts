import { Component, ElementRef, OnInit, ViewChild, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { finalize } from "rxjs";
import { apiErrorMessage } from "../../../api/api-error";
import { SicolApiClient } from "../../../api/sicol-api-client.service";
import { Aula, Centro, Provincia } from "../../../api/sicol.types";

export interface EditTarget {
  type: "centro" | "aula";
  id: string;
  nombre: string;
  activo: boolean;
  parentName?: string;
}

export interface DeleteTarget {
  type: "centro" | "aula";
  id: string;
  nombre: string;
  parentName?: string;
}

@Component({
  selector: "app-ubicaciones",
  imports: [FormsModule, RouterLink],
  templateUrl: "./ubicaciones.component.html",
  styleUrl: "./ubicaciones.component.scss",
})
export class UbicacionesComponent implements OnInit {
  private readonly api = inject(SicolApiClient);

  @ViewChild("editDialog") private editDialog?: ElementRef<HTMLDialogElement>;
  @ViewChild("deleteDialog") private deleteDialog?: ElementRef<HTMLDialogElement>;

  readonly provincias = signal<Provincia[]>([]);
  readonly centros = signal<Centro[]>([]);
  readonly aulas = signal<Aula[]>([]);
  readonly provincia = signal<Provincia | null>(null);
  readonly centro = signal<Centro | null>(null);

  // Filtros de búsqueda local
  readonly searchProvincia = signal("");
  readonly searchCentro = signal("");
  readonly searchAula = signal("");

  // Formularios de creación
  readonly nuevoCentroNombre = signal("");
  readonly nuevaAulaNombre = signal("");

  // Estados de carga y guardado
  readonly loading = signal(true);
  readonly loadingCentros = signal(false);
  readonly loadingAulas = signal(false);
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  // Estados de modales
  readonly editingItem = signal<EditTarget | null>(null);
  readonly deleteTarget = signal<DeleteTarget | null>(null);

  // Listas filtradas
  readonly filteredProvincias = computed(() => {
    const q = this.searchProvincia().trim().toLowerCase();
    if (!q) return this.provincias();
    return this.provincias().filter(
      (p) => p.nombre.toLowerCase().includes(q) || (p.codigo && p.codigo.toLowerCase().includes(q))
    );
  });

  readonly filteredCentros = computed(() => {
    const q = this.searchCentro().trim().toLowerCase();
    if (!q) return this.centros();
    return this.centros().filter((c) => c.nombre.toLowerCase().includes(q));
  });

  readonly filteredAulas = computed(() => {
    const q = this.searchAula().trim().toLowerCase();
    if (!q) return this.aulas();
    return this.aulas().filter((a) => a.nombre.toLowerCase().includes(q));
  });

  // Métricas
  readonly centrosStats = computed(() => {
    const list = this.centros();
    return {
      total: list.length,
      activos: list.filter((c) => c.activo).length,
    };
  });

  readonly aulasStats = computed(() => {
    const list = this.aulas();
    return {
      total: list.length,
      activas: list.filter((a) => a.activo).length,
    };
  });

  ngOnInit(): void {
    this.api
      .listProvincias()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (items) => this.provincias.set(items),
        error: (error: unknown) => this.error.set(apiErrorMessage(error)),
      });
  }

  selectProvincia(item: Provincia): void {
    if (this.provincia()?.id === item.id) return;
    this.provincia.set(item);
    this.centro.set(null);
    this.centros.set([]);
    this.aulas.set([]);
    this.searchCentro.set("");
    this.searchAula.set("");
    this.nuevoCentroNombre.set("");
    this.nuevaAulaNombre.set("");
    this.clearAlerts();
    this.loadCentros(item.id);
  }

  selectCentro(item: Centro): void {
    if (this.centro()?.id === item.id) return;
    this.centro.set(item);
    this.aulas.set([]);
    this.searchAula.set("");
    this.nuevaAulaNombre.set("");
    this.clearAlerts();
    this.loadAulas(item.id);
  }

  // --- Creación rápida ---
  createCentro(): void {
    const provincia = this.provincia();
    const nombre = this.nuevoCentroNombre().trim();
    if (!provincia || !nombre) return;

    this.save(
      this.api.createCentro(provincia.id, { nombre, activo: true }),
      (created) => {
        this.centros.update((items) =>
          [...items, created].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
        );
        this.nuevoCentroNombre.set("");
        this.success.set(`Centro "${created.nombre}" creado correctamente.`);
      }
    );
  }

  createAula(): void {
    const centro = this.centro();
    const nombre = this.nuevaAulaNombre().trim();
    if (!centro || !nombre) return;

    this.save(
      this.api.createAula(centro.id, { nombre, activo: true }),
      (created) => {
        this.aulas.update((items) =>
          [...items, created].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
        );
        this.nuevaAulaNombre.set("");
        this.success.set(`Aula "${created.nombre}" creada correctamente.`);
      }
    );
  }

  // --- Edición con Modal ---
  openEditCentro(item: Centro, event?: Event): void {
    event?.stopPropagation();
    this.clearAlerts();
    this.editingItem.set({
      type: "centro",
      id: item.id,
      nombre: item.nombre,
      activo: item.activo,
      parentName: this.provincia()?.nombre,
    });
    this.editDialog?.nativeElement.showModal();
  }

  openEditAula(item: Aula, event?: Event): void {
    event?.stopPropagation();
    this.clearAlerts();
    this.editingItem.set({
      type: "aula",
      id: item.id,
      nombre: item.nombre,
      activo: item.activo,
      parentName: this.centro()?.nombre,
    });
    this.editDialog?.nativeElement.showModal();
  }

  closeEdit(): void {
    this.editDialog?.nativeElement.close();
    this.editingItem.set(null);
  }

  updateEditingNombre(value: string): void {
    const current = this.editingItem();
    if (current) {
      this.editingItem.set({ ...current, nombre: value });
    }
  }

  updateEditingActivo(value: boolean): void {
    const current = this.editingItem();
    if (current) {
      this.editingItem.set({ ...current, activo: value });
    }
  }

  saveEdit(): void {
    const item = this.editingItem();
    if (!item) return;
    const nombre = item.nombre.trim();
    if (!nombre) return;

    if (item.type === "centro") {
      this.save(
        this.api.updateCentro(item.id, { nombre, activo: item.activo }),
        (updated) => {
          this.centros.update((items) =>
            items.map((val) => (val.id === updated.id ? updated : val)).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
          );
          if (this.centro()?.id === updated.id) {
            this.centro.set(updated);
          }
          this.closeEdit();
          this.success.set(`Centro "${updated.nombre}" actualizado.`);
        }
      );
    } else {
      this.save(
        this.api.updateAula(item.id, { nombre, activo: item.activo }),
        (updated) => {
          this.aulas.update((items) =>
            items.map((val) => (val.id === updated.id ? updated : val)).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
          );
          this.closeEdit();
          this.success.set(`Aula "${updated.nombre}" actualizada.`);
        }
      );
    }
  }

  // --- Alternar estado rápido (Activo / Inactivo) ---
  toggleCentro(item: Centro, event?: Event): void {
    event?.stopPropagation();
    this.clearAlerts();
    const nuevoEstado = !item.activo;
    this.save(
      this.api.updateCentro(item.id, { nombre: item.nombre, activo: nuevoEstado }),
      (updated) => {
        this.centros.update((items) =>
          items.map((val) => (val.id === updated.id ? updated : val))
        );
        if (this.centro()?.id === updated.id) {
          this.centro.set(updated);
        }
        this.success.set(
          `Centro "${updated.nombre}" ${nuevoEstado ? "activado" : "desactivado"} correctamente.`
        );
      }
    );
  }

  toggleAula(item: Aula, event?: Event): void {
    event?.stopPropagation();
    this.clearAlerts();
    const nuevoEstado = !item.activo;
    this.save(
      this.api.updateAula(item.id, { nombre: item.nombre, activo: nuevoEstado }),
      (updated) => {
        this.aulas.update((items) =>
          items.map((val) => (val.id === updated.id ? updated : val))
        );
        this.success.set(
          `Aula "${updated.nombre}" ${nuevoEstado ? "activada" : "desactivada"} correctamente.`
        );
      }
    );
  }

  // --- Eliminación con Diálogo ---
  askDeleteCentro(item: Centro, event?: Event): void {
    event?.stopPropagation();
    this.clearAlerts();
    this.deleteTarget.set({
      type: "centro",
      id: item.id,
      nombre: item.nombre,
      parentName: this.provincia()?.nombre,
    });
    this.deleteDialog?.nativeElement.showModal();
  }

  askDeleteAula(item: Aula, event?: Event): void {
    event?.stopPropagation();
    this.clearAlerts();
    this.deleteTarget.set({
      type: "aula",
      id: item.id,
      nombre: item.nombre,
      parentName: this.centro()?.nombre,
    });
    this.deleteDialog?.nativeElement.showModal();
  }

  closeDelete(): void {
    this.deleteDialog?.nativeElement.close();
    this.deleteTarget.set(null);
  }

  confirmDelete(): void {
    const target = this.deleteTarget();
    if (!target) return;

    this.deleting.set(true);
    this.error.set(null);
    this.success.set(null);

    if (target.type === "centro") {
      this.api
        .deleteCentro(target.id)
        .pipe(finalize(() => this.deleting.set(false)))
        .subscribe({
          next: () => {
            this.centros.update((items) => items.filter((val) => val.id !== target.id));
            if (this.centro()?.id === target.id) {
              this.centro.set(null);
              this.aulas.set([]);
            }
            this.closeDelete();
            this.success.set(`Centro "${target.nombre}" eliminado correctamente.`);
          },
          error: (err: unknown) => {
            this.error.set(apiErrorMessage(err));
          },
        });
    } else {
      this.api
        .deleteAula(target.id)
        .pipe(finalize(() => this.deleting.set(false)))
        .subscribe({
          next: () => {
            this.aulas.update((items) => items.filter((val) => val.id !== target.id));
            this.closeDelete();
            this.success.set(`Aula "${target.nombre}" eliminada correctamente.`);
          },
          error: (err: unknown) => {
            this.error.set(apiErrorMessage(err));
          },
        });
    }
  }

  clearAlerts(): void {
    this.error.set(null);
    this.success.set(null);
  }

  private loadCentros(provinciaId: string): void {
    this.loadingCentros.set(true);
    this.api
      .listCentros(provinciaId)
      .pipe(finalize(() => this.loadingCentros.set(false)))
      .subscribe({
        next: (items) => this.centros.set(items),
        error: (err: unknown) => this.error.set(apiErrorMessage(err)),
      });
  }

  private loadAulas(centroId: string): void {
    this.loadingAulas.set(true);
    this.api
      .listAulas(centroId)
      .pipe(finalize(() => this.loadingAulas.set(false)))
      .subscribe({
        next: (items) => this.aulas.set(items),
        error: (err: unknown) => this.error.set(apiErrorMessage(err)),
      });
  }

  private save<T>(request: import("rxjs").Observable<T>, next: (value: T) => void): void {
    this.saving.set(true);
    this.clearAlerts();
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next,
      error: (err: unknown) => this.error.set(apiErrorMessage(err)),
    });
  }
}
