# La Hilda — Frontend

Vidriera, panel admin y panel chofer conectados a la API de La Hilda.

## Uso local
```bash
npm install
cp .env.example .env
npm run dev
```

`VITE_API_URL` define la URL pública del backend. En desarrollo usa
`http://localhost:4000`.

## Deploy en Railway

1. Desplegá este repositorio como servicio `frontend` dentro del mismo proyecto
   que contiene `backend` y `Postgres`.
2. Configurá `VITE_API_URL` con la URL pública HTTPS del backend. Cuando ambos
   servicios estén en el mismo proyecto, conviene usar una variable de referencia:
   `https://${{backend.RAILWAY_PUBLIC_DOMAIN}}`.
3. Usá `npm run build` como build y `npm start` como start si Railway no los
   detecta automáticamente.
4. Generá un dominio público para el frontend y configurá esa URL en
   `FRONTEND_URL` dentro del backend.

El navegador necesita acceder al backend mediante su dominio público. La red
privada de Railway se usa para la conexión entre el backend y PostgreSQL.
