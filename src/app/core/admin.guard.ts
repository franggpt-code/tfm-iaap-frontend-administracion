import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { AuthService } from "./auth.service";

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated() && (auth.hasRole("ADMIN") || auth.hasRole("GESTOR"))) {
    return true;
  }

  return router.createUrlTree(["/login"]);
};

export const adminRoleGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(["/login"]);
  }

  if (auth.user()?.roles?.includes("ADMIN")) {
    return true;
  }

  return router.createUrlTree([auth.landingUrl()]);
};

export const collaboratorGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return router.createUrlTree(["/login"]);
  if (auth.hasRole("COLABORADOR") || auth.hasRole("ADMIN")) return true;
  return router.createUrlTree([auth.landingUrl()]);
};

export const loginGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.isAuthenticated()
    ? router.createUrlTree([auth.landingUrl()])
    : true;
};