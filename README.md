# SICOL Administración

Frontend de administración para el Sistema IAAP de Colaboradores.

## Stack

- Angular standalone
- Reactive Forms
- HttpClient con interceptor Bearer
- SCSS con tokens ADA/Junta de Andalucía

## Desarrollo local

```bash
npm install
npm start
```

El proxy de desarrollo redirige `/api` hacia `http://127.0.0.1:8080`, por lo que el backend debe exponer la API bajo `/sicol`.

Credenciales semilla del backend local:

- Usuario: `admin.colaborador`
- Contraseña: `admin123`
