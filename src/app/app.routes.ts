import { Routes } from "@angular/router";
import { adminGuard } from "./core/admin.guard";
import { LoginComponent } from "./features/login/login.component";
import { AsistenciaComponent } from "./features/workspace/asistencia/asistencia.component";
import { ConvocadosComponent } from "./features/workspace/convocados/convocados.component";
import { DatosMaestrosComponent } from "./features/workspace/datos-maestros/datos-maestros.component";
import { DashboardComponent } from "./features/workspace/dashboard/dashboard.component";
import { ImportacionOpositoresComponent } from "./features/workspace/importacion/importacion-opositores.component";
import { ImportacionesComponent } from "./features/workspace/importacion/importaciones.component";
import { ImportacionConvocatoriasComponent } from "./features/workspace/importacion-convocatorias/importacion-convocatorias.component";
import { ProcesosExplorerComponent } from "./features/workspace/procesos/procesos-explorer.component";
import { UbicacionesComponent } from "./features/workspace/ubicaciones/ubicaciones.component";

export const routes: Routes = [
  { path: "", redirectTo: "login", pathMatch: "full" },
  { path: "login", component: LoginComponent },
  { path: "admin", component: DashboardComponent, canActivate: [adminGuard] },
  { path: "admin/importaciones", component: ImportacionesComponent, canActivate: [adminGuard] },
  { path: "admin/importaciones/convocatorias", component: ImportacionConvocatoriasComponent, canActivate: [adminGuard] },
  { path: "admin/importaciones/opositores-aulas", component: ImportacionOpositoresComponent, canActivate: [adminGuard] },
  { path: "admin/procesos", component: ProcesosExplorerComponent, canActivate: [adminGuard] },
  { path: "admin/procesos-selectivos/:procesoId/examenes/:examenId/convocados", component: ConvocadosComponent, canActivate: [adminGuard] },
  { path: "admin/examenes-aula/:examenAulaId/asistencia", component: AsistenciaComponent, canActivate: [adminGuard] },
  { path: "admin/ubicaciones", component: UbicacionesComponent, canActivate: [adminGuard] },
  { path: "admin/datos-maestros", component: DatosMaestrosComponent, canActivate: [adminGuard] },
  { path: "**", redirectTo: "admin" },
];
