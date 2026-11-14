# Pruebas de aceptación — Remesas ficticias US → HN

Rama: `feature/remesas-demo-ui`. Solo sandbox, sin dinero real.

## Preparación
- Usar una sesión autenticada con rol `owner`.
- Confirmar que el menú Administración presenta el componente de remesas.
- Confirmar que una cuenta sin rol `owner` no puede utilizarlo.
- No usar cuentas, contraseñas ni códigos reales de beneficiarios.

## Casos manuales
1. **Crear**: ingresar `100.00`, confirmar; esperar una orden con estado `draft`.
2. **Revisar**: pulsar «Enviar a revisión»; esperar `review`.
3. **Simular**: pulsar «Completar simulación»; esperar `simulated`.
4. **Cancelar**: crear otra orden y cancelarla desde `draft` o `review`; esperar `cancelled`.
5. **Terminal**: verificar que no hay botones de cambio de estado desde `simulated` ni `cancelled`.
6. **Validación**: probar vacío, 0, 0.99, 100000.01, letras y tres decimales; no deben crear órdenes.
7. **Doble pulsación**: no deben generarse dos órdenes por una sola confirmación.
8. **Error de red**: simular fallo después de confirmar; reintentar sin cambiar monto y verificar la idempotencia. No declarar éxito hasta consultar el registro.
9. **Contabilidad**: comprobar que no cambia el saldo MWD de la cuenta.
10. **Permisos**: una cuenta no propietaria debe recibir rechazo del servidor aunque intente invocar la función.

## Pendientes antes de producción
- Verificar compilación Android real y funcionamiento en dispositivo.
- Agregar recuperación de orden tras reinicio o respuesta de red incierta.
- Incorporar listado/reconciliación de remesas y manejo de errores accesible.
- Mantener desactivadas las transferencias reales; requieren proveedor regulado, cumplimiento y contratos.

**No fusionar a main ni publicar APK hasta completar pruebas.**
