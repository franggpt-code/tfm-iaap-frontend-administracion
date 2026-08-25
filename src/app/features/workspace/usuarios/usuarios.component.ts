import { Component, computed, ElementRef, inject, OnDestroy, OnInit, signal, ViewChild } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { finalize, forkJoin, Subscription } from "rxjs";
import { apiErrorMessage } from "../../../api/api-error";
import { SicolApiClient } from "../../../api/sicol-api-client.service";
import { Colaborador, UsuarioAdmin, UsuarioAdminCreateUpdate, UsuarioRol } from "../../../api/sicol.types";
import { AuthService } from "../../../core/auth.service";

export type UserSortColumn = "usuario" | "persona" | "perfil" | "acceso";
export type SortDirection = "asc" | "desc";

@Component({
  selector: "app-usuarios",
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: "./usuarios.component.html",
  styleUrl: "./usuarios.component.scss",
})
export class UsuariosComponent implements OnInit, OnDestroy {
  @ViewChild("profilesDialog") private profilesDialog?: ElementRef<HTMLDialogElement>;
  @ViewChild("deleteDialog") private deleteDialog?: ElementRef<HTMLDialogElement>;

  private readonly api = inject(SicolApiClient);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private sub?: Subscription;

  readonly users = signal<UsuarioAdmin[]>([]);
  readonly collaborators = signal<Colaborador[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly deleting = signal<string | null>(null);
  readonly deleteTarget = signal<UsuarioAdmin | null>(null);
  readonly formOpen = signal(false);
  readonly editing = signal<UsuarioAdmin | null>(null);
  readonly showPassword = signal(false);
  readonly selectedCollaboratorId = signal<string>("");
  readonly drawerExpanded = signal(false);

  readonly search = signal("");
  readonly filtersExpanded = signal(false);
  readonly roleFilter = signal<UsuarioRol | "">("");
  readonly statusFilter = signal<"" | "active" | "inactive">("");
  readonly authenticationFilter = signal<"" | "local" | "ldap">("");
  readonly collaboratorFilter = signal<"" | "linked" | "unlinked">("");
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  /* Ordenación y Paginación */
  readonly sortBy = signal<UserSortColumn>("usuario");
  readonly sortDirection = signal<SortDirection>("asc");
  readonly pageSize = signal<20 | 50 | 100>(20);
  readonly currentPage = signal(1);

  readonly currentUserId = computed(() => this.auth.user()?.idUsuario);

  readonly selectedCollaborator = computed(() => {
    const id = this.selectedCollaboratorId();
    if (!id) return null;
    return this.collaborators().find(c => c.id === id) ?? null;
  });

  readonly filteredUsers = computed(() => {
    const term = this.search().trim().toLocaleLowerCase("es");
    return this.users().filter(user => {
      const matchesText = !term || `${user.login} ${user.nombreCompleto} ${user.email} ${user.roles.join(" ")}`
        .toLocaleLowerCase("es")
        .includes(term);
      const matchesRole = !this.roleFilter() || user.roles.includes(this.roleFilter() as UsuarioRol);
      const matchesStatus = !this.statusFilter()
        || (this.statusFilter() === "active" ? user.activo : !user.activo);
      const matchesAuthentication = !this.authenticationFilter()
        || (this.authenticationFilter() === "local" ? user.ldapBypass : !user.ldapBypass);
      const matchesCollaborator = !this.collaboratorFilter()
        || (this.collaboratorFilter() === "linked" ? !!user.colaboradorId : !user.colaboradorId);
      return matchesText && matchesRole && matchesStatus && matchesAuthentication && matchesCollaborator;
    });
  });

  readonly sortedUsers = computed(() => {
    const list = [...this.filteredUsers()];
    const col = this.sortBy();
    const dir = this.sortDirection() === "asc" ? 1 : -1;

    return list.sort((a, b) => {
      let comp = 0;
      switch (col) {
        case "usuario":
          comp = a.login.localeCompare(b.login, "es", { sensitivity: "base" });
          if (comp === 0) {
            comp = a.email.localeCompare(b.email, "es", { sensitivity: "base" });
          }
          break;
        case "persona":
          comp = a.nombreCompleto.localeCompare(b.nombreCompleto, "es", { sensitivity: "base" });
          break;
        case "perfil": {
          const roleA = this.roleLabel(a.roles[0] ?? "");
          const roleB = this.roleLabel(b.roles[0] ?? "");
          comp = roleA.localeCompare(roleB, "es", { sensitivity: "base" });
          break;
        }
        case "acceso": {
          const activeA = a.activo ? 1 : 0;
          const activeB = b.activo ? 1 : 0;
          comp = activeB - activeA;
          if (comp === 0) {
            const authA = a.ldapBypass ? 1 : 0;
            const authB = b.ldapBypass ? 1 : 0;
            comp = authA - authB;
          }
          break;
        }
      }
      return comp * dir;
    });
  });

  readonly totalItems = computed(() => this.sortedUsers().length);
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalItems() / this.pageSize())));

  readonly paginatedUsers = computed(() => {
    const page = Math.min(this.currentPage(), this.totalPages());
    const size = this.pageSize();
    const start = (page - 1) * size;
    return this.sortedUsers().slice(start, start + size);
  });

  readonly startIndex = computed(() => {
    if (this.totalItems() === 0) return 0;
    const page = Math.min(this.currentPage(), this.totalPages());
    return (page - 1) * this.pageSize() + 1;
  });

  readonly endIndex = computed(() => {
    const page = Math.min(this.currentPage(), this.totalPages());
    return Math.min(page * this.pageSize(), this.totalItems());
  });

  readonly activeFiltersCount = computed(() => [
    this.roleFilter(),
    this.statusFilter(),
    this.authenticationFilter(),
    this.collaboratorFilter(),
  ].filter(Boolean).length);

  readonly form = this.fb.nonNullable.group({
    login: ["", Validators.required],
    nombreCompleto: ["", Validators.required],
    email: ["", [Validators.required, Validators.email]],
    role: ["GESTOR" as UsuarioRol, Validators.required],
    colaboradorId: [""],
    activo: [true],
    ldapBypass: [true],
    passwordLocal: [""],
  });

  ngOnInit(): void {
    this.sub = this.form.controls.colaboradorId.valueChanges.subscribe(id => {
      this.selectedCollaboratorId.set(id ?? "");
    });

    forkJoin({ users: this.api.listUsuarios(), collaborators: this.api.listColaboradores({ size: 100 }) })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ users, collaborators }) => {
          this.users.set(users);
          this.collaborators.set(collaborators.content);
        },
        error: error => this.error.set(apiErrorMessage(error)),
      });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  startCreate(): void {
    this.editing.set(null);
    this.showPassword.set(false);
    this.selectedCollaboratorId.set("");
    this.form.reset({
      login: "",
      nombreCompleto: "",
      email: "",
      role: "GESTOR",
      colaboradorId: "",
      activo: true,
      ldapBypass: true,
      passwordLocal: "",
    });
    this.formOpen.set(true);
    this.clearMessages();
  }

  startEdit(user: UsuarioAdmin): void {
    this.editing.set(user);
    this.showPassword.set(false);
    this.selectedCollaboratorId.set(user.colaboradorId ?? "");
    this.form.reset({
      login: user.login,
      nombreCompleto: user.nombreCompleto,
      email: user.email,
      role: user.roles[0] ?? "GESTOR",
      colaboradorId: user.colaboradorId ?? "",
      activo: user.activo,
      ldapBypass: user.ldapBypass,
      passwordLocal: "",
    });
    this.formOpen.set(true);
    this.clearMessages();
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.editing.set(null);
    this.showPassword.set(false);
    this.drawerExpanded.set(false);
  }

  toggleDrawerExpand(): void {
    this.drawerExpanded.update(v => !v);
  }

  setRole(role: UsuarioRol): void {
    this.form.controls.role.setValue(role);
  }

  setLdapBypass(useLocal: boolean): void {
    this.form.controls.ldapBypass.setValue(useLocal);
    if (!useLocal) {
      this.form.controls.passwordLocal.setValue("");
    }
  }

  toggleShowPassword(): void {
    this.showPassword.update(v => !v);
  }

  fillFromCollaborator(): void {
    const collab = this.selectedCollaborator();
    if (!collab) return;

    const currentLogin = this.form.controls.login.value.trim();
    const currentName = this.form.controls.nombreCompleto.value.trim();
    const currentEmail = this.form.controls.email.value.trim();

    const patch: { nombreCompleto?: string; email?: string; login?: string } = {};

    if (!currentName) {
      patch.nombreCompleto = collab.nombreCompleto;
    }
    if (!currentEmail && collab.correoCorporativo) {
      patch.email = collab.correoCorporativo;
    }
    if (!currentLogin) {
      const emailPart = collab.correoCorporativo ? collab.correoCorporativo.split("@")[0] : "";
      patch.login = emailPart || `${collab.dni}${collab.letra || ""}`.toLowerCase();
    }

    this.form.patchValue(patch);
    this.form.markAsDirty();
  }

  isFieldInvalid(fieldName: "login" | "nombreCompleto" | "email" | "passwordLocal" | "colaboradorId"): boolean {
    const control = this.form.get(fieldName);
    return !!(control && control.invalid && (control.touched || control.dirty));
  }

  getFieldError(fieldName: "login" | "nombreCompleto" | "email" | "passwordLocal" | "colaboradorId"): string {
    const control = this.form.get(fieldName);
    if (!control || !control.errors) return "";
    if (control.errors["required"]) return "Este campo es obligatorio.";
    if (control.errors["email"]) return "Introduce un formato de correo electrónico válido.";
    return "Valor no válido.";
  }

  openProfilesInfo(): void {
    this.profilesDialog?.nativeElement.showModal();
  }

  closeProfilesInfo(): void {
    this.profilesDialog?.nativeElement.close();
  }

  save(): void {
    this.form.markAllAsTouched();
    const value = this.form.getRawValue();
    if (this.form.invalid) return;

    if (value.role === "COLABORADOR" && !value.colaboradorId) {
      this.error.set("El perfil 'Usuario colaborador' requiere vincular obligatoriamente una ficha de colaborador.");
      return;
    }

    if (value.ldapBypass && !this.editing() && !value.passwordLocal.trim()) {
      this.error.set("Introduce una contraseña local para el primer acceso del nuevo usuario.");
      return;
    }

    const payload: UsuarioAdminCreateUpdate = {
      login: value.login.trim(),
      nombreCompleto: value.nombreCompleto.trim(),
      email: value.email.trim(),
      activo: value.activo,
      ldapBypass: value.ldapBypass,
      roles: [value.role],
      colaboradorId: value.colaboradorId || null,
      ...(value.passwordLocal.trim() ? { passwordLocal: value.passwordLocal.trim() } : {}),
    };

    const current = this.editing();
    this.saving.set(true);
    this.clearMessages();

    const request = current ? this.api.updateUsuario(current.idUsuario, payload) : this.api.createUsuario(payload);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: saved => {
        this.users.update(items => current
          ? items.map(item => item.idUsuario === saved.idUsuario ? saved : item).sort((a, b) => a.login.localeCompare(b.login))
          : [...items, saved].sort((a, b) => a.login.localeCompare(b.login)));
        this.success.set(current ? `El usuario "${saved.login}" se ha actualizado correctamente.` : `El usuario "${saved.login}" se ha creado con éxito.`);
        this.closeForm();
      },
      error: error => this.error.set(apiErrorMessage(error)),
    });
  }

  askDelete(user: UsuarioAdmin): void {
    if (user.idUsuario === this.currentUserId()) return;
    this.deleteTarget.set(user);
    this.deleteDialog?.nativeElement.showModal();
  }

  closeDelete(): void {
    this.deleteDialog?.nativeElement.close();
    this.deleteTarget.set(null);
  }

  confirmDelete(): void {
    const target = this.deleteTarget();
    if (!target) return;

    this.deleting.set(target.idUsuario);
    this.clearMessages();

    this.api.deleteUsuario(target.idUsuario).pipe(finalize(() => {
      this.deleting.set(null);
      this.closeDelete();
    })).subscribe({
      next: () => {
        this.users.update(items => items.filter(item => item.idUsuario !== target.idUsuario));
        this.success.set(`El usuario "${target.login}" ha sido eliminado del sistema.`);
        if (this.editing()?.idUsuario === target.idUsuario) {
          this.closeForm();
        }
      },
      error: error => this.error.set(apiErrorMessage(error)),
    });
  }

  toggleSort(column: UserSortColumn): void {
    if (this.sortBy() === column) {
      this.sortDirection.update(dir => dir === "asc" ? "desc" : "asc");
    } else {
      this.sortBy.set(column);
      this.sortDirection.set("asc");
    }
  }

  setPage(page: number): void {
    const target = Math.max(1, Math.min(page, this.totalPages()));
    this.currentPage.set(target);
  }

  setPageSize(size: string | number): void {
    const parsed = Number(size) as 20 | 50 | 100;
    if (parsed === 20 || parsed === 50 || parsed === 100) {
      this.pageSize.set(parsed);
      this.currentPage.set(1);
    }
  }

  onSearchChange(term: string): void {
    this.search.set(term);
    this.currentPage.set(1);
  }

  onRoleFilterChange(role: UsuarioRol | ""): void {
    this.roleFilter.set(role);
    this.currentPage.set(1);
  }

  onStatusFilterChange(status: "" | "active" | "inactive"): void {
    this.statusFilter.set(status);
    this.currentPage.set(1);
  }

  onAuthFilterChange(auth: "" | "local" | "ldap"): void {
    this.authenticationFilter.set(auth);
    this.currentPage.set(1);
  }

  onCollabFilterChange(collab: "" | "linked" | "unlinked"): void {
    this.collaboratorFilter.set(collab);
    this.currentPage.set(1);
  }

  toggleFilters(): void {
    this.filtersExpanded.update(expanded => !expanded);
  }

  resetFilters(): void {
    this.search.set("");
    this.roleFilter.set("");
    this.statusFilter.set("");
    this.authenticationFilter.set("");
    this.collaboratorFilter.set("");
    this.currentPage.set(1);
  }

  roleLabel(role: UsuarioRol): string {
    return role === "ADMIN" ? "Administrador" : role === "GESTOR" ? "Gestor de colaboradores" : "Usuario colaborador";
  }

  collaboratorName(id: string | null | undefined): string {
    return this.collaborators().find(item => item.id === id)?.nombreCompleto ?? "Sin vincular";
  }

  private clearMessages(): void {
    this.error.set(null);
    this.success.set(null);
  }
}

