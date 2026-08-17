# Desarrollo local

## Preparación

```bash
npm install
```

El `package-lock.json` debe mantenerse versionado. En integración continua es
preferible `npm ci`.

## Ejecución con el backend

En una terminal, desde `tfm-iaap-backend`:

```bash
mvn spring-boot:run
```

En otra terminal, desde este repositorio:

```bash
npm start
```

Abrir <http://localhost:4200> y entrar con:

- Usuario: `admin.colaborador`
- Contraseña: `admin123`

Servicios útiles del backend:

- API: <http://localhost:8080/sicol>
- Swagger UI: <http://localhost:8080/swagger-ui.html>
- Health: <http://localhost:8080/actuator/health>

## Validación antes de entregar

```bash
npm run build
npm test
git status --short
```

Si el entorno no dispone de Chrome, la compilación sigue siendo una validación
útil, pero debe indicarse que las pruebas Karma no se ejecutaron.

## Cambiar o añadir una funcionalidad

1. Confirmar primero el endpoint y los esquemas en el OpenAPI del backend.
2. Añadir o ajustar los tipos en `src/app/core/api.models.ts`.
3. Encapsular la llamada en `src/app/core/admin-api.service.ts`.
4. Implementar la pantalla bajo `src/app/features/admin`.
5. Registrar la ruta en `src/app/app.routes.ts`, aplicando el guard adecuado.
6. Añadir pruebas para transformaciones, validaciones y casos de error.
7. Actualizar esta documentación si cambia el flujo o la arquitectura.

## Problemas frecuentes

### La interfaz devuelve 404 o no conecta

Comprobar que el backend escucha en el puerto 8080. El navegador llama a
`/api/sicol`; el proxy lo convierte en `/sicol`.

### Respuesta 401

La sesión puede haber caducado. Borrar la clave `sicol.admin.session` de
`localStorage` o cerrar sesión y volver a entrar.

### Respuesta 403

El usuario no tiene el rol necesario. La administración general admite
`ADMIN` o `GESTOR`; la gestión de usuarios exige `ADMIN`.

### Error al importar

Las importaciones de datos base y procesos usan `multipart/form-data`. No se
debe fijar manualmente la cabecera `Content-Type`, porque el navegador genera
el boundary.
