import { Component, computed, inject, signal } from "@angular/core";
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { AuthService } from "./core/auth.service";
import { APP_VERSION } from "./version";

@Component({
  selector: "app-root",
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.scss",
})
export class AppComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = this.auth.user;
  readonly isAuthenticated = computed(() => this.auth.isAuthenticated());
  readonly isAdmin = this.auth.isAdmin;
  readonly isManager = this.auth.isManager;
  readonly isCollaborator = this.auth.isCollaborator;
  readonly homeLink = computed(() => this.auth.landingUrl());
  readonly appVersion = APP_VERSION;

  /** Estado del menú en desktop: expandido (false) o compacto a iconos (true) */
  readonly isCollapsed = signal(false);

  /** Estado del cajón de navegación en pantallas móviles */
  readonly menuOpen = signal(false);

  /** Iniciales del usuario conectado para el avatar */
  readonly userInitials = computed(() => {
    const name = this.user()?.nombreCompleto || this.user()?.login || "U";
    const parts = name.split(/[ ,._-]+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  });

  /** Etiqueta descriptiva del rol del usuario para la tarjeta de sesión */
  readonly userRoleLabel = computed(() => {
    if (this.isAdmin()) return "Administrador (TIC)";
    if (this.isManager()) return "Gestor de Selección";
    if (this.isCollaborator()) return "Colaborador";
    return "Usuario";
  });

  toggleCollapse(): void {
    this.isCollapsed.update((collapsed) => !collapsed);
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  logout(): void {
    this.closeMenu();
    this.auth.logout().subscribe({
      next: () => void this.router.navigateByUrl("/login"),
      error: () => void this.router.navigateByUrl("/login"),
    });
  }
}
