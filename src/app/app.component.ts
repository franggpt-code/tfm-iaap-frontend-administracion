import { Component, computed, inject } from "@angular/core";
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { AuthService } from "./core/auth.service";

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

  logout(): void {
    this.auth.logout().subscribe({
      next: () => void this.router.navigateByUrl("/login"),
      error: () => void this.router.navigateByUrl("/login"),
    });
  }
}
