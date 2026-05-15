import { Routes } from "@angular/router";
import { adminGuard } from "./core/admin.guard";
import { AdminDashboardComponent } from "./features/admin/admin-dashboard.component";
import { LoginComponent } from "./features/login/login.component";

export const routes: Routes = [
  { path: "", redirectTo: "login", pathMatch: "full" },
  { path: "login", component: LoginComponent },
  { path: "admin", component: AdminDashboardComponent, canActivate: [adminGuard] },
  { path: "**", redirectTo: "admin" },
];
