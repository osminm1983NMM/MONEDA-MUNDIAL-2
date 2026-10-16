# Monitor de frecuencia de transferencias — solo laboratorio

Moneda Mundial 2.0 · Investigación técnica (16 de octubre de 2026)

El motor `src/server/mock-transfer-velocity.mjs` analiza **exclusivamente
eventos inventados y aportados manualmente**, agrupados por alias ficticio
`SIM-HN-A001`, etc. No dispone de cuentas, PII, IP, biometría, proveedor,
billeteras ni registros monetarios.

## Controles de ejemplo
- Ventanas móviles de 1 y 24 horas con reloj suministrado para pruebas.
- Deduplicación idempotente por evento y rechazo de ID reutilizado con datos
  distintos, incluso cuando cambia el alias.
- Señales explicativas por frecuencia de intentos, rechazos, volumen de
  muestra, importe alto y múltiples destinos.
- Aislamiento entre perfiles, rechazo de campos no previstos y
  valores que aparenten pagos reales.

Los umbrales son **arbitrarios y pedagógicos**. Un patrón señalado no
demuestra fraude, lavado, sanciones ni culpabilidad. Un patrón no señalado
tampoco certifica ausencia de riesgo. `requiresManualReview` no bloquea
ni habilita pagos; no existe conexión con proveedores reales.

Para producción serían imprescindibles controles adaptados por corredor,
moneda, leyes, perfiles y riesgos, pruebas independientes y revisión humana,
datos autorizados y minimizados, gobierno de modelos, registros inmutables,
resolución de disputas y respuesta a incidentes. El criterio regulatorio
no se implementa con simples límites dentro de la aplicación móvil.
