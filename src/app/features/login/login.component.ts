import { Component, computed, inject, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { finalize } from "rxjs";
import { AuthService } from "../../core/auth.service";

@Component({
  selector: "app-login",
  imports: [ReactiveFormsModule],
  templateUrl: "./login.component.html",
  styleUrl: "./login.component.scss",
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly showPassword = signal(false);

  readonly passwordType = computed(() => (this.showPassword() ? "text" : "password"));

  readonly form = this.fb.nonNullable.group({
    usuario: ["", [Validators.required]],
    password: ["", [Validators.required]],
  });

  submit(): void {
    this.error.set(null);
    this.form.markAllAsTouched();

    if (this.form.invalid || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.auth
      .login(this.form.getRawValue())
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => void this.router.navigateByUrl(this.auth.landingUrl()),
        error: () => this.error.set("No ha sido posible iniciar sesión. Revisa las credenciales e inténtalo de nuevo."),
      });
  }
}
