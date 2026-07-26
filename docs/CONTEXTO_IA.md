# Contexto para asistentes de IA

## Resumen operativo

Aplicación Angular 21 standalone para la administración de SICOL. Consume el
backend Spring Boot hermano `tfm-iaap-backend`; no contiene reglas de negocio
persistentes ni acceso directo a base de datos.

Antes de cambiar código, leer:

1. `README.md`
2. `docs/ARQUITECTURA.md`
3. `src/app/app.routes.ts`
4. `src/app/core/admin-api.service.ts`
5. los modelos y componentes concretos afectados
6. el OpenAPI del backend si cambia una integración

## Fuentes de verdad y límites

- Contrato HTTP: `tfm-iaap-backend/contracts/openapi/sicol-v1.yaml`.
- URL base local del frontend: `/api/sicol`.
- URL real del backend local tras el proxy: `/sicol`.
- No inventar endpoints, campos, estados ni roles.
- No duplicar llamadas HTTP dentro de componentes.
- No confiar solo en los guards: el backend autoriza cada petición.
- No incluir secretos ni datos personales reales en código, pruebas o docs.
- Preservar cambios locales y archivos no relacionados.

## Mapa de cambio

| Si cambia... | Revisar... |
| --- | --- |
| Ruta o navegación | `app.routes.ts`, dashboard y guards |
| Petición o respuesta | `api.models.ts`, `admin-api.service.ts`, componente y OpenAPI |
| Sesión o roles | `auth.service.ts`, interceptor, guards y backend |
| Una pantalla | TS, HTML y SCSS del mismo directorio |
| Estilo compartido | `styles.scss`, `admin-pages.scss` y accesibilidad |
| Importación | componente, modelos de resultado y endpoints multipart |

## Convenciones actuales

- Componentes standalone con dependencias en `imports`.
- Inyección con `inject(...)`.
- Estado local mediante signals; RxJS para operaciones HTTP.
- Formularios reactivos.
- Tipos explícitos para DTO y páginas.
- Textos de interfaz en español.
- Identidad visual y accesibilidad coherentes con ADA/Junta de Andalucía.

## Criterios mínimos de una modificación

- La funcionalidad compila con `npm run build`.
- Las pruebas relevantes pasan con `npm test`, o se documenta el bloqueo.
- Los estados de carga, vacío y error son comprensibles.
- Los formularios tienen etiquetas y mensajes accesibles.
- Los modelos coinciden con el contrato.
- No quedan `console.log`, credenciales nuevas ni datos reales.
- Se actualizan los Markdown si cambia arquitectura, arranque o contrato.

## Estado funcional

El frontend contiene pantallas operativas para usuarios, colaboradores, datos
maestros, procesos/exámenes, importaciones, asignaciones, control, firmas y
pagos. El panel usa datos reales de la API. Para conocer el detalle exacto de
operaciones disponibles, consultar los métodos públicos de
`AdminApiService` y el OpenAPI.

## Handoff esperado

Al terminar una tarea, informar de:

- comportamiento implementado;
- archivos modificados;
- comandos de validación y resultado;
- supuestos o limitaciones;
- cambios coordinados que aún requiera el backend.
