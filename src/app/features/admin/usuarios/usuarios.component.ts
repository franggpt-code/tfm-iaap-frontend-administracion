import { Component, computed, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { finalize } from "rxjs";
import { AdminApiService } from "../../../core/admin-api.service";
import { UsuarioAdmin, UsuarioAdminCreateUpdate, UsuarioRol } from "../../../core/api.models";
import { errorMessage } from "../shared/admin-ui";

type UsuarioSortColumn = "login" | "nombreCompleto" | "email" | "roles" | "activo" | "ldapBypass" | "permisos";
type SortDirection = "asc" | "desc";

const ROLES: UsuarioRol[] = ["ADMIN", "GESTOR", "COLABORADOR"];

@Component({
  selector: "app-usuarios",
  imports: [ReactiveFormsModule],
  templateUrl: "./usuarios.component.html",
  styleUrl: "../admin-pages.scss",
})
export class UsuariosComponent {
  private readonly api = inject(AdminApiService);
  private readonly fb = inject(FormBuilder);

  readonly roles = ROLES;
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly usuarios = signal<UsuarioAdmin[]>([]);
  readonly filtersOpen = signal(false);
  readonly editorOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly originalLdapBypass = signal(false);
  readonly originalHasPassword = signal(false);
  readonly filtersValue = signal({ login: "", nombreCompleto: "", email: "", rol: "", activo: "", ldapBypass: "" });
  readonly sort = signal<{ column: UsuarioSortColumn; direction: SortDirection }>({ column: "login", direction: "asc" });

  readonly filters = this.fb.nonNullable.group({
    login: [""],
    nombreCompleto: [""],
    email: [""],
    rol: [""],
    activo: [""],
    ldapBypass: [""],
  });

  readonly form = this.fb.nonNullable.group({
    login: ["", Validators.required],
    nombreCompleto: ["", Validators.required],
    email: ["", [Validators.required, Validators.email]],
    roles: this.fb.nonNullable.group({
      ADMIN: [false],
      GESTOR: [true],
      COLABORADOR: [false],
    }),
    activo: [true],
    ldapBypass: [false],
    passwordLocal: [""],
  });

  readonly filteredUsuarios = computed(() => {
    const filters = this.filtersValue();
    const sort = this.sort();
    const login = filters.login.trim().toLowerCase();
    const nombre = filters.nombreCompleto.trim().toLowerCase();
    const email = filters.email.trim().toLowerCase();
    const rol = filters.rol as UsuarioRol | "";
    const activo = filters.activo;
    const ldapBypass = filters.ldapBypass;

    const filtered = this.usuarios().filter((usuario) => (
      (!login || usuario.login.toLowerCase().includes(login))
      && (!nombre || usuario.nombreCompleto.toLowerCase().includes(nombre))
      && (!email || usuario.email.toLowerCase().includes(email))
      && (!rol || usuario.roles.includes(rol))
      && (!activo || String(usuario.activo) === activo)
      && (!ldapBypass || String(usuario.ldapBypass) === ldapBypass)
    ));

    return [...filtered].sort((left, right) => {
      const result = this.compare(this.sortValue(left, sort.column), this.sortValue(right, sort.column));
      return sort.direction === "asc" ? result : -result;
    });
  });

  readonly activeFiltersCount = computed(() => Object.values(this.filtersValue()).filter(Boolean).length);

  constructor() {
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.filtersValue.set({
        login: value.login ?? "",
        nombreCompleto: value.nombreCompleto ?? "",
        email: value.email ?? "",
        rol: value.rol ?? "",
        activo: value.activo ?? "",
        ldapBypass: value.ldapBypass ?? "",
      });
    });
    this.form.controls.ldapBypass.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.form.controls.passwordLocal.reset("");
    });
    this.load();
  }

  toggleFilters(): void {
    this.filtersOpen.update((open) => !open);
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.listUsuariosAdmin().pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (usuarios) => this.usuarios.set(usuarios),
      error: (error) => this.error.set(errorMessage(error, "No se ha podido cargar el listado de usuarios.")),
    });
  }

  clearFilters(): void {
    this.filters.reset({ login: "", nombreCompleto: "", email: "", rol: "", activo: "", ldapBypass: "" });
    this.filtersValue.set({ login: "", nombreCompleto: "", email: "", rol: "", activo: "", ldapBypass: "" });
  }

  newUsuario(): void {
    this.editingId.set(null);
    this.originalLdapBypass.set(false);
    this.originalHasPassword.set(false);
    this.form.reset({
      login: "",
      nombreCompleto: "",
      email: "",
      roles: { ADMIN: false, GESTOR: true, COLABORADOR: false },
      activo: true,
      ldapBypass: false,
      passwordLocal: "",
    });
    this.editorOpen.set(true);
  }

  edit(usuario: UsuarioAdmin): void {
    this.editingId.set(usuario.idUsuario);
    this.originalLdapBypass.set(usuario.ldapBypass);
    this.originalHasPassword.set(usuario.ldapBypass);
    this.form.setValue({
      login: usuario.login,
      nombreCompleto: usuario.nombreCompleto,
      email: usuario.email,
      roles: {
        ADMIN: usuario.roles.includes("ADMIN"),
        GESTOR: usuario.roles.includes("GESTOR"),
        COLABORADOR: usuario.roles.includes("COLABORADOR"),
      },
      activo: usuario.activo,
      ldapBypass: usuario.ldapBypass,
      passwordLocal: "",
    });
    this.editorOpen.set(true);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const request = this.toRequest();
    if (!request.roles.length) {
      this.error.set("Selecciona al menos un rol.");
      return;
    }
    if (request.ldapBypass && this.passwordRequired() && !request.passwordLocal) {
      this.error.set("La password local es obligatoria para activar autenticación local.");
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    const id = this.editingId();
    const operation = id ? this.api.updateUsuarioAdmin(id, request) : this.api.createUsuarioAdmin(request);

    operation.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.success.set(id ? "Usuario actualizado correctamente." : "Usuario creado correctamente.");
        this.editorOpen.set(false);
        this.load();
      },
      error: (error) => this.error.set(errorMessage(error, "No se ha podido guardar el usuario.")),
    });
  }

  delete(usuario: UsuarioAdmin): void {
    const confirmed = window.confirm(`Eliminar el usuario ${usuario.login}?`);
    if (!confirmed) {
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.api.deleteUsuarioAdmin(usuario.idUsuario).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.success.set("Usuario eliminado correctamente.");
        this.load();
      },
      error: (error) => this.error.set(errorMessage(error, "No se ha podido eliminar el usuario.")),
    });
  }

  sortBy(column: UsuarioSortColumn): void {
    this.sort.update((current) => ({
      column,
      direction: current.column === column && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  sortIcon(column: UsuarioSortColumn): string {
    const current = this.sort();
    if (current.column !== column) {
      return "fa fa-sort";
    }
    return current.direction === "asc" ? "fa fa-sort-up" : "fa fa-sort-down";
  }

  ariaSort(column: UsuarioSortColumn): "ascending" | "descending" | "none" {
    const current = this.sort();
    if (current.column !== column) {
      return "none";
    }
    return current.direction === "asc" ? "ascending" : "descending";
  }

  roleLabel(role: UsuarioRol): string {
    const labels: Record<UsuarioRol, string> = {
      ADMIN: "Administrador",
      GESTOR: "Gestor",
      COLABORADOR: "Colaborador",
    };
    return labels[role];
  }

  passwordRequired(): boolean {
    return this.form.controls.ldapBypass.value && (!this.editingId() || !this.originalHasPassword());
  }

  private toRequest(): UsuarioAdminCreateUpdate {
    const value = this.form.getRawValue();
    const roles = this.roles.filter((role) => value.roles[role]);
    const passwordLocal = value.passwordLocal.trim();
    return {
      login: value.login.trim(),
      nombreCompleto: value.nombreCompleto.trim(),
      email: value.email.trim(),
      activo: value.activo,
      ldapBypass: value.ldapBypass,
      roles,
      ...(passwordLocal ? { passwordLocal } : {}),
    };
  }

  private sortValue(usuario: UsuarioAdmin, column: UsuarioSortColumn): string {
    if (column === "roles") {
      return usuario.roles.join(", ");
    }
    if (column === "permisos") {
      return usuario.permisos.join(", ");
    }
    if (column === "activo") {
      return usuario.activo ? "Activo" : "Inactivo";
    }
    if (column === "ldapBypass") {
      return usuario.ldapBypass ? "Local" : "LDAP";
    }
    return usuario[column];
  }

  private compare(left: string, right: string): number {
    return left.localeCompare(right, "es", { numeric: true, sensitivity: "base" });
  }
}
