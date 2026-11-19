# Informe integral de revisión — 2026-11-19

## Alcance
Revisión conjunta del cliente React Native/Expo, controles de recuperación, funciones de Supabase, permisos y conciliación contable. Todo se mantiene en **modo demostración** con créditos MWD ficticios. Sin escrituras en Supabase, sin transferencias nuevas, sin recursos de pago y sin cambios en `main`.

## Cambios de código en la rama de desarrollo
- `902d34d`: historial filtrado explícitamente por origen/destino, además de RLS.
- `55ced3f`: diferencia confirmación de RPC y fallo posterior de sincronización.
- `b2a31b5`: respuestas de sincronización obsoletas retornan `false`; en error de consulta se retiran saldo e historial potencialmente obsoletos; recuperación y reintento notifican lectura fallida; cierre de sesión bloqueado ante error de almacenamiento pendiente.
- `555492e`: ampliación de pruebas estáticas en `tests/security-static.test.cjs`.

## Verificaciones SQL de solo lectura
- 5 billeteras, 25 operaciones: 19 transferencias y 6 aportaciones.
- 0 solicitudes duplicadas por `(actor_id,request_id)`, 0 `request_id` nulos, 0 saldos negativos.
- Vistas de conciliación: 5 billeteras y 19 transferencias verificadas, 0 alertas de billetera y 0 alertas de libro mayor.
- RLS activo en billeteras, operaciones y roles; políticas SELECT por usuario/participante.
- Índice único `mwd_unique_request`; funciones RPC de transferencia/aportación bloquean filas, validan montos y reutilización de ID.
- 20 tablas de cuatro esquemas privados sin SELECT anónimo ni SELECT/INSERT/UPDATE autenticado.
- Funciones administrativas examinadas comprueban rol propietario directa o indirectamente mediante `assert_owner()`.

## Validación de código
Se ejecutaron **7 verificaciones estáticas de fragmentos** sobre el código obtenido de GitHub; 7/7 conformes: filtro historial, persistencia previa a RPC, recuperación mismo ID, limpieza de saldo obsoleto, retorno de lectura obsoleta, aviso de recuperación y rótulo demostración.

**No se ejecutó `npm test`, no se compiló APK, ni se efectuaron pruebas de Android o RPC con sesiones A/B.** Las pruebas estáticas del repositorio se ampliaron, pero requieren ejecución en un entorno Node con copia del proyecto.

## Riesgos y bloqueos pendientes
1. Pruebas autenticadas A/B: idempotencia simultánea, errores de red, recuperación tras reinicio y permisos de acceso. Requieren credenciales de prueba gestionadas de forma segura o ejecución controlada desde dispositivo; no se deben fabricar sesiones.
2. Auditoría exhaustiva de las 56 RPC privilegiadas advertidas por Supabase; se inspeccionaron funciones críticas, no todas.
3. Aviso de protección de contraseñas filtradas en Supabase Auth.
4. Compilación e instalación APK Android y comprobación visual de todos los flujos.
5. Antes de dinero real: regulación, proveedor autorizado, KYC/AML, custodia y pruebas independientes.

## Conclusión
**Revisión integrada de código y contabilidad actual completada en el alcance descrito, pero no certificación integral de la aplicación.** No se debe afirmar que todas las pruebas funcionales han concluido. Priorizar cierre de los bloqueos anteriores antes de liberar.
