# Nuevo UI de convocados y aulas

La rama `feature/nuevo-ui-importacion-opositores-aulas` sustituye el frontend de
administración anterior por una base más pequeña centrada en el flujo actual del
backend SICOL.

## Alcance inicial

- importación SIRHUS obligatoria y Caronte opcional;
- simulación, revisión de contadores y avisos, y confirmación explícita;
- consulta de procesos, ejercicios y personas convocadas;
- filtros por centro, aula, asistencia y texto;
- navegación de provincias, centros y aulas;
- control de asistencia por aula con actualización optimista reversible.

## Contrato API

Los tipos de `src/app/api/generated/sicol-api.ts` se generan desde el contrato
principal del backend y no deben editarse manualmente:

```bash
npm run generate:api
```

El comando presupone que el repositorio `tfm-iaap-backend` está situado junto al
frontend, tal como ocurre en el workspace de desarrollo. `SicolApiClient`
contiene únicamente los adaptadores HTTP; los modelos proceden del archivo
generado.

## Desarrollo local

Con el backend escuchando en `http://localhost:8080`, el proxy de Angular envía
las peticiones `/api/sicol` a la API local:

```bash
npm start
```

La aplicación queda disponible en `http://localhost:4200`. Los documentos
seleccionados para importar se mantienen en memoria y nunca se escriben en
almacenamiento persistente del navegador.
