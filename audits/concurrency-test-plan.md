# Plan de pruebas de concurrencia — Moneda Mundial DEMO

## Estado
- Nueve pruebas de modelos aislados aprobadas en GitHub Actions (run 43878645354).
- NO se ha ejecutado una prueba de concurrencia contra PostgreSQL/Supabase.
- La rama principal de Supabase contiene billeteras existentes: prohibido usarla como laboratorio.

## Condiciones previas
1. Crear o habilitar una base de datos aislada, sin datos de usuarios ni dinero real, después de confirmar cualquier costo.
2. Verificar que su esquema y funciones coincidan con la versión que se quiere evaluar.
3. Crear identidades ficticias A, B y C, billeteras y saldos iniciales exclusivamente en esa base.
4. Obtener evidencia del estado inicial: saldos, número de operaciones y claves de solicitud.

## Casos mínimos contra la función real
1. Enviar 20 llamadas concurrentes con la misma clave, remitente, destinatario e importe: exactamente un débito y un registro; los demás reintentos no duplican.
2. Enviar dos solicitudes con claves distintas que compiten por un saldo insuficiente para ambas: solo una puede completarse, sin saldo negativo.
3. Reutilizar la misma clave con importe o destinatario diferente: error de conflicto y ninguna segunda transferencia.
4. Transferencias A→B y B→A simultáneas: comprobar que no hay bloqueos permanentes, pérdida de fondos ni duplicación. Registrar si ocurre deadlock y definir reintentos seguros.
5. Simular fallo/reintento tras respuesta perdida: verificar estado por request_id antes de volver a enviar.
6. Ejecutar con sesiones autenticadas A/B y comprobar que una sesión no puede hacerse pasar por otra.

## Evidencia y criterio de aprobación
- Registrar IDs ficticios de solicitudes, respuestas, códigos de error, conteos y sumas antes/después, sin tokens ni secretos.
- Suma de saldos conservada para transferencias internas; sin saldos negativos; una operación por clave.
- Si falla cualquier caso, no integrar ni activar dinero real.
- Ejecutar audits/demo-ledger-readonly.sql antes y después en la base aislada.

## Seguridad
- No usar service_role en el cliente móvil.
- No modificar main, usuarios existentes ni saldos actuales.
- Las pruebas de modelos locales no certifican PostgreSQL, RLS, licencias ni procesamiento de dinero real.
