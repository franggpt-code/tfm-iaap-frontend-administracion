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
  readonly menuOpen = signal(false);
  readonly appVersion = APP_VERSION;

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
