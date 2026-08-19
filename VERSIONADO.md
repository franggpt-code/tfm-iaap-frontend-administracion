# Versionado del frontend SICOL

Este repositorio se versiona de forma independiente del backend.

- `VERSION` contiene la base de la siguiente entrega: `X.Y.Z`.
- `package.json`, `package-lock.json` y `src/app/version.ts` contienen
  `X.Y.Z-SNAPSHOT`.
- Tras integrar la entrega en GitLab, el tag de prueba es `X.Y.Z-test`.

Antes de crear un tag, ejecutar `npm run check:version`; `npm run build` ya
ejecuta esa comprobación. Un despliegue debe registrar por separado el tag y
el SHA del frontend y los del backend.

## Compilacion GitLab

La pipeline nativa .gitlab-ci.yml solo compila; no despliega ni contiene
secretos. En una entrega X.Y.Z-test valida que el tag coincide con VERSION,
genera el frontend para la ruta /sicol/ y publica un .tar.gz junto a su
SHA-256 como artefactos de GitLab.

En ramas de merge request o lanzadas desde la interfaz de GitLab, el job es
