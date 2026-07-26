# SICOL Administración

Aplicación web de administración del Sistema de Información de Colaboradores
del IAAP. Permite gestionar usuarios, colaboradores, datos maestros, procesos
selectivos, exámenes, asignaciones, controles, hojas de firma, pagos e
importaciones.

## Inicio rápido

Requisitos:

- Node.js 20 o superior
- npm 10 o superior
- backend `tfm-iaap-backend` disponible en `http://127.0.0.1:8080`

```bash
npm install
npm start
```

La aplicación queda disponible en <http://localhost:4200>. El servidor de
desarrollo redirige `/api` al backend local.

Credenciales del entorno local:

- Usuario: `admin.colaborador`
- Contraseña: `admin123`

## Comandos

```bash
npm start       # servidor de desarrollo en el puerto 4200
npm run build   # compilación de producción
npm test        # pruebas unitarias en modo no interactivo
```

## Documentación

- [Índice de documentación](docs/README.md)
- [Arquitectura](docs/ARQUITECTURA.md)
- [Desarrollo local](docs/DESARROLLO.md)
- [Contexto para asistentes de IA](docs/CONTEXTO_IA.md)
- [Trazabilidad de sesiones](docs/trazabilidad/README.md)

## Stack

- Angular 21 con componentes standalone
- TypeScript 5.9 y RxJS 7.8
- Reactive Forms y `HttpClient`
- SCSS con identidad visual ADA / Junta de Andalucía
- Sesión Bearer persistida en `localStorage`

## Licencia

EUPL-1.2.
