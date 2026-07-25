# Documentación del frontend de administración

Este directorio separa la documentación vigente de la trazabilidad histórica.

## Lectura recomendada

| Documento | Propósito |
| --- | --- |
| [Arquitectura](ARQUITECTURA.md) | Estructura, navegación, estado y comunicación con el backend |
| [Desarrollo local](DESARROLLO.md) | Instalación, ejecución, validación y resolución de problemas |
| [Contexto para IA](CONTEXTO_IA.md) | Mapa compacto y reglas para asistentes que vayan a modificar el proyecto |
| [Trazabilidad](trazabilidad/README.md) | Registro histórico de sesiones y decisiones |

## Fuentes de verdad

1. `src/app/app.routes.ts` para la navegación.
2. `src/app/core/admin-api.service.ts` para las operaciones consumidas.
3. `src/app/core/api.models.ts` para los modelos usados por la interfaz.
4. El OpenAPI de `tfm-iaap-backend/contracts/openapi/sicol-v1.yaml` para el
   contrato HTTP completo.
5. El código y las pruebas prevalecen si un documento histórico queda
   desactualizado.

Los documentos de este directorio describen el estado de `main` en junio de
2026. Deben actualizarse cuando cambien rutas, requisitos, arquitectura o
flujos de desarrollo.
