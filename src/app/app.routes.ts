import { Routes } from "@angular/router";
import { adminGuard, adminRoleGuard, collaboratorGuard } from "./core/admin.guard";
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
import { ColaboradoresComponent } from "./features/workspace/colaboradores/colaboradores.component";
import { AsignacionesComponent } from "./features/workspace/asignaciones/asignaciones.component";
import { InformesComponent } from "./features/workspace/informes/informes.component";
import { UsuariosComponent } from "./features/workspace/usuarios/usuarios.component";
import { MiEspacioComponent } from "./features/portal/mi-espacio.component";

export const routes: Routes = [
  { path: "", redirectTo: "login", pathMatch: "full" },
  { path: "login", component: LoginComponent },
  { path: "admin", component: DashboardComponent, canActivate: [adminGuard] },
  { path: "admin/importaciones", component: ImportacionesComponent, canActivate: [adminRoleGuard] },
  { path: "admin/importaciones/convocatorias", component: ImportacionConvocatoriasComponent, canActivate: [adminRoleGuard] },
  { path: "admin/importaciones/opositores-aulas", component: ImportacionOpositoresComponent, canActivate: [adminRoleGuard] },
  { path: "admin/procesos", component: ProcesosExplorerComponent, canActivate: [adminGuard] },
  { path: "admin/procesos-selectivos/:procesoId/examenes/:examenId/convocados", component: ConvocadosComponent, canActivate: [adminGuard] },
  { path: "admin/examenes-aula/:examenAulaId/asistencia", component: AsistenciaComponent, canActivate: [adminRoleGuard] },
  { path: "admin/ubicaciones", component: UbicacionesComponent, canActivate: [adminRoleGuard] },
  { path: "admin/colaboradores", component: ColaboradoresComponent, canActivate: [adminGuard] },
  { path: "admin/asignaciones", component: AsignacionesComponent, canActivate: [adminGuard] },
  { path: "admin/informes", component: InformesComponent, canActivate: [adminGuard] },
  { path: "admin/datos-maestros", component: DatosMaestrosComponent, canActivate: [adminRoleGuard] },
  { path: "admin/usuarios", component: UsuariosComponent, canActivate: [adminRoleGuard] },
  { path: "mi-espacio", component: MiEspacioComponent, canActivate: [collaboratorGuard] },
  { path: "mi-espacio/asignaciones/:asignacionId/llamamiento", component: AsistenciaComponent, canActivate: [collaboratorGuard] },
  { path: "**", redirectTo: "login" },
];
