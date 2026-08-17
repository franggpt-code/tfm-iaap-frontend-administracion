#!/bin/zsh
set -euo pipefail

BACKEND_DIR="/Users/miarmabot/Dev/tfm-iaap-backend"
FRONTEND_DIR="/Users/miarmabot/Dev/tfm-iaap-frontend-administracion"

if [[ ! -d "$BACKEND_DIR" ]]; then
  osascript -e 'display alert "No se encuentra el backend SICOL" message "Revisa la ruta /Users/miarmabot/Dev/tfm-iaap-backend" as critical'
  exit 1
fi

if [[ ! -d "$FRONTEND_DIR" ]]; then
  osascript -e 'display alert "No se encuentra el frontend SICOL" message "Revisa la ruta /Users/miarmabot/Dev/tfm-iaap-frontend-administracion" as critical'
  exit 1
fi

osascript <<APPLESCRIPT
tell application "Terminal"
  activate

  set backendCommand to "cd '$BACKEND_DIR'; clear; echo 'SICOL BACKEND'; echo 'URL API: http://localhost:8080/sicol'; echo 'Health: http://localhost:8080/actuator/health'; echo; mvn spring-boot:run"
  do script backendCommand

  set frontendCommand to "cd '$FRONTEND_DIR'; clear; echo 'SICOL FRONTEND'; echo 'URL: http://localhost:4200'; echo 'Credenciales: admin.colaborador / admin123'; echo; if [ ! -d node_modules ]; then npm install; fi; npm start"
  do script frontendCommand
end tell
APPLESCRIPT

echo "Arrancando SICOL en dos ventanas de Terminal..."
echo "Backend:  http://localhost:8080/sicol"
echo "Frontend: http://localhost:4200"
