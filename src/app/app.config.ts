import { ApplicationConfig } from "@angular/core";
import { provideHttpClient, withInterceptors } from "@angular/common/http";
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from "@angular/router";
import { routes } from "./app.routes";
import { authInterceptor } from "./core/auth.interceptor";

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ anchorScrolling: "enabled", scrollPositionRestoration: "enabled" })),
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
