# Preparación del despliegue corporativo

Esta rama prepara la estructura de CI/CD y OpenShift tomando como referencia el
proyecto `corrector-examen-frontend-administracion`.

Incluye:

- imagen de runtime UBI 9 con Nginx en el puerto 8043;
- pipeline Node.js 22 con instalación reproducible mediante `npm ci`;
- manifiestos Kustomize para `test`, `pre` y `pro`;
- `ConfigMap` por entorno preparado para inyectar la URL del backend.

## Valores pendientes antes de activar el pipeline

La preparación no activa todavía el despliegue. Antes de hacerlo se deben
confirmar con la plataforma corporativa:

- `pipeline.gitRepo.repoID` en `ci.json`;
- nombres definitivos de imagen, namespace y rutas OpenShift;
- URLs del backend SICOL para `test`, `pre` y `pro`;
- mecanismo de configuración en tiempo de ejecución del nuevo frontend.

El frontend actual compila `apiBaseUrl` en el bundle. Los `ConfigMap` se dejan
como contrato de despliegue, pero el nuevo UI deberá cargar
`/config/config.json` al arrancar antes de que el despliegue se considere
operativo.

Los archivos de OpenAI Sites y Vercel quedan expresamente fuera de esta rama y
de la futura `main` corporativa.
