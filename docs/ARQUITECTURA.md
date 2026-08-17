# Arquitectura

## Propósito y alcance

Este repositorio contiene exclusivamente el portal de administración de SICOL.
La API, la persistencia y las reglas de negocio viven en
`tfm-iaap-backend`.

## Flujo de una petición

```text
Componente de página
  -> AdminApiService / AuthService
  -> HttpClient + authInterceptor
  -> /api/sicol/*
  -> proxy de Angular
  -> http://127.0.0.1:8080/sicol/*
```

En desarrollo, `src/environments/environment.ts` define
`apiBaseUrl: "/api/sicol"` y `proxy.conf.json` elimina el prefijo `/api`.

## Organización del código

```text
src/app
├── core
│   ├── admin-api.service.ts  # fachada HTTP del área de administración
│   ├── api.models.ts         # tipos de petición y respuesta
│   ├── auth.service.ts       # login, logout, refresh y sesión local
│   ├── auth.interceptor.ts   # cabecera Authorization
│   └── admin.guard.ts        # protección por autenticación y rol
├── features
│   ├── login
│   └── admin
│       ├── colaboradores
│       ├── usuarios
│       ├── datos-maestros
│       ├── procesos
│       ├── importaciones
│       ├── asignaciones
│       ├── control
│       ├── firmas
│       └── pagos
├── app.config.ts
└── app.routes.ts
```

Los componentes son standalone. No hay NgModules de funcionalidad ni una
biblioteca externa de estado global.

## Navegación

| Ruta | Función | Protección |
| --- | --- | --- |
| `/login` | Inicio de sesión | Pública |
| `/admin` | Panel y accesos rápidos | Usuario autenticado |
| `/admin/usuarios` | Gestión de usuarios | Rol `ADMIN` |
| `/admin/colaboradores` | CRUD de colaboradores | `ADMIN` o `GESTOR` |
| `/admin/datos-maestros` | OEP, accesos, vinculaciones y cuerpos | `ADMIN` o `GESTOR` |
| `/admin/procesos` | Procesos, exámenes y aulas | `ADMIN` o `GESTOR` |
| `/admin/importaciones` | Importación ODS/XLSX | `ADMIN` o `GESTOR` |
| `/admin/asignaciones` | Asignación de colaboradores | `ADMIN` o `GESTOR` |
| `/admin/control` | Resumen de colaboraciones | `ADMIN` o `GESTOR` |
| `/admin/firmas` | Hojas de firma por centro y aula | `ADMIN` o `GESTOR` |
| `/admin/pagos` | Importes por colaboración | `ADMIN` o `GESTOR` |

## Autenticación

`AuthService` guarda en `localStorage`, bajo la clave
`sicol.admin.session`, el token, la caducidad y el usuario. El interceptor
añade `Authorization: Bearer <token>` a las peticiones. Los guards mejoran la
experiencia de navegación, pero la autorización efectiva siempre corresponde
al backend.

## Estado y formularios

- El estado de sesión usa signals de Angular.
- Cada página mantiene su estado de carga, filtros y edición.
- Los formularios de edición usan Reactive Forms.
- `AdminApiService` centraliza URLs y tipos HTTP; los componentes no deben
  construir endpoints directamente.

## Estilos

`src/styles.scss` contiene estilos globales y tokens visuales. Los estilos del
área administrativa compartidos están en
`src/app/features/admin/admin-pages.scss`; cada pantalla mantiene los ajustes
locales en su propio SCSS cuando son necesarios.

## Pruebas

Las pruebas usan Jasmine y Karma. Actualmente se concentran en el servicio de
API y la importación. Las nuevas reglas de transformación, guards y flujos con
errores deben acompañarse de pruebas.
