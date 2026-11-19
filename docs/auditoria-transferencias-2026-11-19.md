# Auditoría estática — Moneda Mundial 2.0 (2026-11-19)

Alcance: lectura del `App.js` de `main` y `package.json`; no se ejecutaron transferencias, SQL, APK ni llamadas de escritura a Supabase. Este documento se guarda en rama de desarrollo, no en `main`.

## Hallazgos comprobados por lectura

- `refreshAccount` (App.js líneas 144-172) consulta billetera, últimas 50 operaciones y rol en paralelo. Muestra mensaje de error y libera `syncing` en `finally`.
- La consulta de `mwd_operations` no aplica filtro explícito de usuario. Debe verificarse que las políticas RLS limiten resultados a operaciones propias; añadir filtro explícito de origen/destino para defensa en profundidad si el esquema lo permite.
- `executeOperation` (líneas 208-241) usa un `p_request_id` reutilizado mientras la operación permanece pendiente, y acepta estados `ok` y `already_processed`. La garantía real de idempotencia depende de la implementación SQL de las funciones RPC, que no está incluida en los archivos de `main` inspeccionados.
- Tras respuesta exitosa, el identificador pendiente se borra antes de refrescar la cuenta. Si falla la sincronización posterior, la operación ya pudo haberse confirmado: la interfaz debe distinguir entre confirmación del servidor y fallo de refresco.
- `pendingRef` es memoria de proceso: cerrar la app puede perder el identificador de una operación cuyo resultado se desconoce. Diseñar persistencia local segura del identificador hasta conciliación, sin guardar secretos.
- `package.json` usa Expo SDK 54. No se validó APK ni compatibilidad real con el dispositivo.

## Pruebas necesarias antes de declarar cierre

1. Dos solicitudes simultáneas con el mismo `p_request_id`: una sola contabilización y respuesta estable.
2. Pérdida de conexión después de que el servidor confirme, antes de recibir respuesta: reintento con el mismo ID, sin doble cargo.
3. Reinicio de Android durante una operación incierta: recuperar y conciliar ID original.
4. A -> B y B -> A con cantidades enteras en centavos: conservación del total y movimientos coherentes.
5. RLS: usuario A no puede leer operaciones privadas de terceros ni ejecutar RPC como B.
6. Fallo de consulta de historial tras transferencia exitosa: comunicar estado real, sin afirmar que falló la transferencia.
7. Botón Actualizar saldo e historial: estado de carga, errores, red lenta, respuesta vacía y cierre de sesión.
8. APK: compilación, instalación, inicio, autenticación y pruebas en Android real.

## Criterio de seguridad

Mantener exclusivamente MWD ficticios. No habilitar dinero real ni criptomonedas operativas sin auditoría de RPC, RLS, contabilidad, cumplimiento y pruebas integrales. No desplegar ni iniciar recursos de pago durante esta auditoría.
