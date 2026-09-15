#!/bin/bash

LOG_FILE=$(mktemp)
echo "1. Iniciando túnel de Cloudflare..."

# Levantar Cloudflare en segundo plano
npx cloudflared tunnel --url http://127.0.0.1:3001 > "$LOG_FILE" 2>&1 &
CF_PID=$!

# Limpiar proceso del túnel si cerramos con Ctrl + C
trap "kill $CF_PID 2>/dev/null; rm -f $LOG_FILE; exit" INT TERM EXIT

# Esperar la URL
URL=""
echo -n "   Esperando la URL del túnel..."
while [ -z "$URL" ]; do
  sleep 1
  echo -n "."
  URL=$(grep -o 'https://[a-zA-Z0-9-]*\.trycloudflare\.com' "$LOG_FILE" | head -n 1)
done

echo ""
echo "-> Nueva URL: $URL"

# Actualizar .env.local
ENV_PATH="./ecommerce-mobile/.env.local"
if grep -q "EXPO_PUBLIC_BASE_URL=" "$ENV_PATH"; then
  sed -i "s|EXPO_PUBLIC_BASE_URL=.*|EXPO_PUBLIC_BASE_URL=$URL|" "$ENV_PATH"
else
  echo "EXPO_PUBLIC_BASE_URL=$URL" >> "$ENV_PATH"
fi

echo "-> .env.local actualizado."
echo "2. Arrancando Expo frontend..."

# Entrar a la carpeta del frontend y ejecutar Expo
cd ecommerce-mobile || exit
npx expo start --tunnel -c