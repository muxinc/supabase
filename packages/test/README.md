# Mux Sync Engine Tests

Este directorio contiene tests para probar la funcionalidad de la librería Mux Sync Engine.

## Archivos de Test

### 1. `index.js` - Test de Migraciones
Ejecuta las migraciones de la base de datos para crear las tablas necesarias.

```bash
npm run migrate
```

### 2. `webhook-test.js` - Test Básico de Webhooks
Simula el procesamiento de un webhook de Mux con datos mock y verifica la configuración básica.

```bash
npm run webhook-test
```

### 3. `webhook-server.js` - Servidor de Webhooks
Crea un servidor HTTP local para recibir webhooks reales de Mux.

```bash
npm run webhook-server
```

### 4. `advanced-webhook-test.js` - Test Avanzado
Ejecuta tests más detallados incluyendo validación de configuración y preparación para tests reales.

```bash
npm run advanced-test
```

### 5. `EXAMPLE.md` - Ejemplo Completo
Documentación completa con ejemplos de uso, configuración y troubleshooting.

## Configuración

### Variables de Entorno

Crea un archivo `.env` en este directorio con las siguientes variables:

```env
DATABASE_URL=postgresql://your-database-url
MUX_WEBHOOK_SECRET=your-mux-webhook-secret
MUX_TOKEN_ID=your-mux-token-id
MUX_TOKEN_SECRET=your-mux-token-secret
```

### Para Testing con Webhooks Reales

1. **Ejecuta el servidor de webhooks:**
   ```bash
   npm run webhook-server
   ```

2. **Expone el servidor localmente usando ngrok:**
   ```bash
   npx ngrok http 3000
   ```

3. **Configura el webhook en Mux:**
   - Ve a tu dashboard de Mux
   - Configura un webhook que apunte a la URL de ngrok (ej: `https://abc123.ngrok.io`)
   - Selecciona los eventos que quieres recibir (ej: `video.asset.created`)

4. **Prueba creando un asset en Mux:**
   - El webhook será enviado automáticamente a tu servidor local
   - Verás los logs en la consola del servidor

## Estructura de los Tests

### Test Simulado (`webhook-test.js`)
- Usa datos mock para simular un webhook de Mux
- Útil para probar la lógica de procesamiento sin necesidad de webhooks reales
- No requiere configuración de webhooks en Mux

### Servidor de Webhooks (`webhook-server.js`)
- Crea un servidor HTTP en el puerto 3000
- Recibe webhooks reales de Mux
- Procesa los webhooks usando la librería MuxSync
- Requiere exposición pública (ngrok) para recibir webhooks de Mux

## Troubleshooting

### Error de Conexión a Base de Datos
- Verifica que `DATABASE_URL` esté correctamente configurado
- Asegúrate de que las migraciones se hayan ejecutado

### Error de Autenticación de Mux
- Verifica que `MUX_TOKEN_ID` y `MUX_TOKEN_SECRET` sean correctos
- Asegúrate de que las credenciales tengan los permisos necesarios

### Webhooks no llegan
- Verifica que ngrok esté funcionando correctamente
- Confirma que la URL del webhook en Mux sea la correcta
- Revisa los logs del servidor para errores 