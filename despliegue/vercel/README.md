# Despliegue en Vercel

Configuracion temporal para desplegar el frontend de administracion en Vercel mientras el despliegue definitivo se prepara en el CI/CD de la Junta.

## Backend

El build de Vercel usa `src/environments/environment.vercel.ts` y llama al backend:

```text
https://tfm-iaap-backend.onrender.com/sicol
```

## Comandos

```bash
npm run build:vercel
vercel --local-config despliegue/vercel/vercel.json
```

Tambien se deja un `vercel.json` equivalente en la raiz del repositorio para que Vercel lo detecte automaticamente al conectar el proyecto desde su interfaz.
