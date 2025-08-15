# Ejemplo Completo: Mux Sync Engine Webhooks

Este ejemplo muestra cómo usar la librería Mux Sync Engine para procesar webhooks de Mux.

## 1. Configuración Inicial

### Variables de Entorno
Crea un archivo `.env` en el directorio `packages/test/`:

```env
DATABASE_URL=postgresql://your-database-url
MUX_WEBHOOK_SECRET=your-mux-webhook-secret
MUX_TOKEN_ID=your-mux-token-id
MUX_TOKEN_SECRET=your-mux-token-secret
```

### Ejecutar Migraciones
```bash
npm run migrate
```

## 2. Tests Básicos

### Test de Configuración
```bash
npm run webhook-test
```

Este comando ejecuta tests básicos que verifican:
- Configuración de la librería
- Conexión a la base de datos
- Estructura de webhooks

### Test Avanzado
```bash
npm run advanced-test
```

Este comando ejecuta tests más detallados que incluyen:
- Validación de configuración
- Pruebas de conexión a base de datos
- Simulación de webhooks
- Preparación para tests con datos reales

## 3. Servidor de Webhooks Local

### Iniciar el Servidor
```bash
npm run webhook-server
```

El servidor se ejecutará en `http://localhost:3000` y mostrará:
```
MuxSync initialized
Webhook server running on port 3000
Webhook endpoint: http://localhost:3000/webhook
You can use ngrok or similar to expose this locally for testing with real Mux webhooks
```

### Exponer el Servidor (para webhooks reales)

1. **Instalar ngrok:**
   ```bash
   npm install -g ngrok
   ```

2. **Exponer el servidor:**
   ```bash
   ngrok http 3000
   ```

3. **Configurar webhook en Mux:**
   - Ve a tu dashboard de Mux
   - Configura un webhook que apunte a la URL de ngrok
   - Selecciona los eventos que quieres recibir (ej: `video.asset.created`)

## 4. Ejemplo de Código

### Estructura del Webhook
Los webhooks de Mux tienen esta estructura:

```json
{
  "type": "video.asset.created",
  "data": {
    "id": "asset-id",
    "status": "ready",
    "created_at": "2025-08-01T15:13:48.559Z",
    "updated_at": "2025-08-01T15:13:48.559Z"
  }
}
```

### Procesamiento de Webhooks
El servidor procesa automáticamente los webhooks:

```javascript
// El servidor maneja esto automáticamente
await muxSync.processWebhook(payload, headers)
```

### Respuesta del Servidor
- **Éxito (202):** Webhook procesado correctamente
- **Error (400):** Error en el procesamiento del webhook
- **Error (500):** Error interno del servidor

## 5. Testing con Datos Reales

### 1. Configurar Credenciales Reales
```bash
export MUX_TOKEN_ID="your-real-token-id"
export MUX_TOKEN_SECRET="your-real-token-secret"
export MUX_WEBHOOK_SECRET="your-real-webhook-secret"
```

### 2. Iniciar Servidor
```bash
npm run webhook-server
```

### 3. Exponer con ngrok
```bash
ngrok http 3000
```

### 4. Configurar Webhook en Mux
- URL: `https://abc123.ngrok.io` (la URL de ngrok)
- Eventos: `video.asset.created`, `video.asset.updated`, etc.

### 5. Crear Assets en Mux
- Ve a tu dashboard de Mux
- Crea un nuevo asset
- El webhook será enviado automáticamente a tu servidor

## 6. Logs y Debugging

### Logs del Servidor
El servidor muestra logs detallados:
```
Received webhook: {
  method: 'POST',
  url: '/',
  headers: { ... },
  bodyLength: 123
}
```

### Verificar Base de Datos
Los assets procesados se guardan en la tabla `mux_assets`:

```sql
SELECT * FROM mux.mux_assets ORDER BY created_at DESC LIMIT 10;
```

## 7. Troubleshooting

### Error de Conexión a Base de Datos
- Verifica `DATABASE_URL`
- Asegúrate de que las migraciones se ejecutaron

### Error de Autenticación de Mux
- Verifica `MUX_TOKEN_ID` y `MUX_TOKEN_SECRET`
- Confirma que las credenciales tienen permisos

### Webhooks no llegan
- Verifica que ngrok esté funcionando
- Confirma la URL del webhook en Mux
- Revisa los logs del servidor

### Error de Firma de Webhook
- Verifica `MUX_WEBHOOK_SECRET`
- Confirma que el webhook esté configurado correctamente en Mux

## 8. Próximos Pasos

1. **Implementar más tipos de eventos:** Agregar soporte para `video.asset.updated`, `video.live_stream.created`, etc.
2. **Agregar validación de datos:** Implementar validación más robusta de los datos de webhook
3. **Implementar retry logic:** Agregar lógica de reintento para webhooks fallidos
4. **Agregar métricas:** Implementar logging y métricas para monitoreo
5. **Optimizar rendimiento:** Implementar procesamiento en lotes y conexiones pool 