import { Component, computed, inject, OnInit, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { finalize, forkJoin } from "rxjs";
import { apiErrorMessage } from "../../../api/api-error";
import { SicolApiClient } from "../../../api/sicol-api-client.service";
import { Colaborador, UsuarioAdmin, UsuarioAdminCreateUpdate, UsuarioRol } from "../../../api/sicol.types";
import { AuthService } from "../../../core/auth.service";

@Component({
  selector: "app-usuarios",
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: "./usuarios.component.html",
  styleUrl: "./usuarios.component.scss",
})
export class UsuariosComponent implements OnInit {
  private readonly api = inject(SicolApiClient);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly users = signal<UsuarioAdmin[]>([]);
  readonly collaborators = signal<Colaborador[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly deleting = signal<string | null>(null);
  readonly formOpen = signal(false);
  readonly editing = signal<UsuarioAdmin | null>(null);
  readonly search = signal("");
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly currentUserId = computed(() => this.auth.user()?.idUsuario);
  readonly filteredUsers = computed(() => {
    const term = this.search().trim().toLocaleLowerCase("es");
    if (!term) return this.users();
    return this.users().filter(user => `${user.login} ${user.nombreCompleto} ${user.email} ${user.roles.join(" ")}`.toLocaleLowerCase("es").includes(term));
  });

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

  startCreate(): void {
    this.editing.set(null);
    this.form.reset({ login: "", nombreCompleto: "", email: "", role: "GESTOR", colaboradorId: "", activo: true, ldapBypass: true, passwordLocal: "" });
    this.formOpen.set(true);
    this.clearMessages();
  }

  startEdit(user: UsuarioAdmin): void {
    this.editing.set(user);
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
  }

  save(): void {
    this.form.markAllAsTouched();
    const value = this.form.getRawValue();
    if (this.form.invalid) return;
    if (value.role === "COLABORADOR" && !value.colaboradorId) {
      this.error.set("Selecciona el colaborador vinculado al usuario.");
      return;
    }
    if (value.ldapBypass && !this.editing() && !value.passwordLocal.trim()) {
      this.error.set("Introduce una contraseña para el acceso local.");
      return;
    }
    const payload: UsuarioAdminCreateUpdate = {
      login: value.login.trim(),
      nombreCompleto: value.nombreCompleto.trim(),
      email: value.email.trim(),
      activo: value.activo,
      ldapBypass: value.ldapBypass,
      roles: [value.role],
      colaboradorId: value.role === "COLABORADOR" ? value.colaboradorId : null,
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
        this.success.set(current ? "El usuario y sus permisos se han actualizado." : "El usuario se ha creado correctamente.");
        this.closeForm();
      },
      error: error => this.error.set(apiErrorMessage(error)),
    });
  }

  deleteUser(user: UsuarioAdmin): void {
    if (user.idUsuario === this.currentUserId() || !window.confirm(`¿Eliminar el usuario ${user.login}?`)) return;
    this.deleting.set(user.idUsuario);
    this.clearMessages();
    this.api.deleteUsuario(user.idUsuario).pipe(finalize(() => this.deleting.set(null))).subscribe({
      next: () => {
        this.users.update(items => items.filter(item => item.idUsuario !== user.idUsuario));
        this.success.set("El usuario se ha eliminado.");
      },
      error: error => this.error.set(apiErrorMessage(error)),
    });
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
