import { Routes } from "@angular/router";
import { adminGuard } from "./core/admin.guard";
import { AsignacionesComponent } from "./features/admin/asignaciones/asignaciones.component";
import { ColaboradoresComponent } from "./features/admin/colaboradores/colaboradores.component";
import { ControlComponent } from "./features/admin/control/control.component";
import { FirmasComponent } from "./features/admin/firmas/firmas.component";
import { AdminDashboardComponent } from "./features/admin/admin-dashboard.component";
import { PagosComponent } from "./features/admin/pagos/pagos.component";
import { PerfilesComponent } from "./features/admin/perfiles/perfiles.component";
import { ProcesosComponent } from "./features/admin/procesos/procesos.component";
import { LoginComponent } from "./features/login/login.component";

export const routes: Routes = [
  { path: "", redirectTo: "login", pathMatch: "full" },
  { path: "login", component: LoginComponent },
  { path: "admin", component: AdminDashboardComponent, canActivate: [adminGuard] },
  { path: "admin/colaboradores", component: ColaboradoresComponent, canActivate: [adminGuard] },
  { path: "admin/procesos", component: ProcesosComponent, canActivate: [adminGuard] },
  { path: "admin/perfiles", component: PerfilesComponent, canActivate: [adminGuard] },
  { path: "admin/asignaciones", component: AsignacionesComponent, canActivate: [adminGuard] },
  { path: "admin/control", component: ControlComponent, canActivate: [adminGuard] },
  { path: "admin/firmas", component: FirmasComponent, canActivate: [adminGuard] },
  { path: "admin/pagos", component: PagosComponent, canActivate: [adminGuard] },
  { path: "**", redirectTo: "admin" },
];
