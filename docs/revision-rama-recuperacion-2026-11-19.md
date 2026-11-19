# Revisión de implementación existente — 2026-11-19

Se inspeccionó `App.js` en la rama `dev/recuperacion-transferencias`, no solo en `main`. No se ejecutaron llamadas RPC ni se modificó la base de datos.

## Capacidades ya presentes en esta rama

- Persistencia del identificador de solicitud en AsyncStorage **antes** de llamar a `mwd_transfer_demo` / `mwd_contribute_demo` (aprox. líneas 323-345).
- Recuperación del identificador al iniciar sesión, validación de formato y bloqueo de operaciones nuevas cuando la referencia está pendiente o no puede leerse (aprox. líneas 128-172).
- Consulta de estado mediante `mwd_operation_status_demo` y reintento explícito con el mismo ID, sin crear otro (aprox. líneas 249-321).
- Protección contra resultados tardíos de otra cuenta mediante `activeUserRef` y secuencia de sincronización.

## Riesgos y comprobaciones pendientes

1. **RLS:** la consulta de `mwd_operations` carece de filtro explícito por `source_user_id` / `destination_user_id`. Verificar RLS en Supabase y añadir defensa en profundidad.
2. **Garantía SQL:** confirmar que `mwd_transfer_demo` y `mwd_contribute_demo` tienen unicidad atómica por usuario+request_id y validan que reusar el ID con parámetros diferentes no produzca otra operación. El código cliente por sí solo no demuestra idempotencia.
3. **RPC de estado:** confirmar que `mwd_operation_status_demo` existe, limita resultados al usuario autenticado y diferencia `processed` de `unconfirmed` de forma confiable.
4. **Carrera de sesión:** simular cierre/cambio de sesión durante `AsyncStorage.setItem`, la RPC y `removeItem`; comprobar que una operación persistida nunca se pierde ni permite iniciar otra operación insegura.
5. **Error de sincronización:** `refreshAccount` muestra su error internamente y no devuelve un estado al llamador. Verificar que no se presente una confirmación de saldo actualizado si la lectura falló.
6. **Confirmación tardía:** probar que cerrar la app después del commit remoto y antes de recibir respuesta recupera el mismo identificador, no duplica cargos y muestra estado correcto.
7. **Cobertura:** no se verificaron tests automáticos, compilación APK ni ejecución en dispositivo real en esta revisión.

## Nota de precisión

El informe anterior basado en `main` no describía todas las defensas que **ya existen en esta rama**. No duplicar implementación ni declarar pendientes funcionalidades que están escritas; primero verificar su comportamiento y las garantías del servidor.

## Prueba manual recomendada (solo créditos ficticios)

Cuenta A envía 1.00 MWD a B con un request_id. Repetir la misma solicitud en dos conexiones simultáneas y verificar exactamente un débito y un crédito. Interrumpir la conexión tras el commit y volver a consultar con el mismo request_id. Repetir con cambio de sesión y reinicio Android. Registrar saldos antes/después, operaciones y errores. No habilitar dinero real.
