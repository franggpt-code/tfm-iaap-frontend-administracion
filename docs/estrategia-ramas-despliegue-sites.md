# Estrategia de ramas y despliegue en Sites

Fecha de referencia: 2026-08-17

## Ramas y repositorios

- `gitlab/main` es la fuente de verdad del producto.
- Las funcionalidades se desarrollan en ramas `feature/*` publicadas en GitLab
  y se integran en `main` exclusivamente mediante Merge Request (MR).
- `origin/main` es el espejo de GitHub. Solo se actualiza después de integrar la
  MR correspondiente en GitLab.
- `origin/deploy/sites` es una rama exclusiva de GitHub para el despliegue en
  OpenAI Sites. No se publica en GitLab.

La rama predeterminada de ambos repositorios debe seguir siendo `main`.

## Flujo normal

```bash
git switch main
git pull --ff-only gitlab main

git switch -c feature/nombre-funcionalidad
# desarrollar, probar y hacer commit
git push -u gitlab feature/nombre-funcionalidad
```

Después de integrar la MR en GitLab:

```bash
git switch main
git pull --ff-only gitlab main
git push origin main
```

Cuando el despliegue de Sites deba recibir los cambios de producto:

```bash
git switch deploy/sites
git pull --ff-only origin deploy/sites
git merge origin/main
git push origin deploy/sites
```

Se usa `merge` en `deploy/sites` para conservar una historia estable de una rama
publicada y desplegada.

## Separación de despliegues

Pertenecen a `main` los cambios funcionales, las pruebas, la documentación
general y la futura configuración de CI/CD y OpenShift de la Junta.

Pertenecen únicamente a `deploy/sites`:

- `.openai/hosting.json`;
- el adaptador de compilación y ejecución de Sites;
- la configuración de entorno necesaria para conectar el frontend desplegado
  con el backend accesible desde Internet.

No se deben añadir a `main` configuraciones específicas de Sites o Vercel. La
configuración corporativa de OpenShift tampoco debe mezclarse con
`deploy/sites`.

## Configuración local recomendada

La rama local `main` debe seguir a GitLab:

```bash
git branch --set-upstream-to=gitlab/main main
```

No se configura un remoto de envío implícito: cada publicación indica su destino
de forma explícita.

## Reglas de protección

- No empujar directamente a `gitlab/main`.
- No desarrollar funcionalidades únicamente en GitHub.
- No publicar `deploy/sites` en GitLab.
- No integrar `deploy/sites` en `main`.
- No incorporar una feature a `origin/main` antes de que su MR esté integrada
  en GitLab.
