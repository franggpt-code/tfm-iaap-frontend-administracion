# Versionado del frontend SICOL

Este repositorio se versiona de forma independiente del backend.

- `VERSION` contiene la base de la siguiente entrega: `X.Y.Z`.
- `package.json`, `package-lock.json` y `src/app/version.ts` contienen
  `X.Y.Z-SNAPSHOT`.
- Tras integrar la entrega en GitLab, el tag de prueba es `X.Y.Z-test`.

Antes de crear un tag, ejecutar `npm run check:version`; `npm run build` ya
ejecuta esa comprobación. Un despliegue debe registrar por separado el tag y
el SHA del frontend y los del backend.
