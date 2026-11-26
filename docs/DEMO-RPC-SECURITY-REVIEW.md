# Revisión de seguridad RPC DEMO — 26 de noviembre de 2026

Consulta de catálogo de solo lectura en Supabase compartido; no se ejecutaron mutaciones, no se cambió RLS ni se habilitaron pagos.

## Inventario de funciones privilegiadas públicas

56 funciones MWD SECURITY DEFINER ejecutables por authenticated: 21 contienen la referencia auth.uid(), 35 restantes contienen un marcador de comprobación de autorización delegada. Ninguna carece de ambos marcadores, ninguna contiene el marcador user_metadata y ninguna de las 56 es ejecutable por anon. Estos resultados son clasificación textual del cuerpo, no prueba formal de autorización ni de ausencia de vulnerabilidades. La validación PostgreSQL 45840521789 pasó los controles de aislamiento, autorización y permisos incluidos en CI.

## Comercios (módulo no incluido en la aceptación física principal)

- 3 comercios, 4 solicitudes de pago, ninguna en moneda distinta de MWD. Las restricciones exigen MWD ficticios, importe de 1 a 100000000 centavos y estado permitido; el INSERT de solicitudes está limitado a su comercio titular y al estado pending mediante RLS.
- Revisión de los cuerpos actuales: mwd_get_payment_request_demo requiere usuario autenticado y permite consultar una solicitud pendiente por ID o una propia; mwd_cancel_payment_request_demo exige titular y bloquea la fila; mwd_pay_merchant_demo bloquea fila, rechaza autopago y divisa no MWD, usa mwd_transfer_demo con la referencia de la solicitud y revisa reintentos de una solicitud pagada.
- Antes de exponer esta función en la app: comprobar doble pago concurrente entre dos pagadores, cancelación concurrente con pago, reintento del mismo pagador, referencia coincidente con otra operación, pago ajeno a solicitud no pendiente, monedas/estados inválidos, y que saldo e historial correspondan exactamente. Usar exclusivamente PostgreSQL desechable y usuarios sintéticos. El estado de solicitud y el movimiento contable deben quedar atómicos. No certificar este módulo por las pruebas de transferencias únicamente.
- Pendiente de producción: protección contra contraseñas filtradas, revisión semántica de permisos de RPC, caducidad de solicitudes y limitación de abuso; sin pagos reales.

## Reproducción

```sql
WITH f AS (
 SELECT p.* FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname LIKE 'mwd_%' AND p.prosecdef
 AND has_function_privilege('authenticated',p.oid,'EXECUTE')
)
SELECT count(*) AS privileged_authenticated,
 count(*) FILTER (WHERE prosrc ~* 'auth[.]uid') AS direct_uid_marker,
 count(*) FILTER (WHERE prosrc !~* 'auth[.]uid' AND prosrc ~* 'mwd_(require|assert|is)_|require_owner|assert_owner') AS delegated_guard_marker,
 count(*) FILTER (WHERE prosrc !~* 'auth[.]uid|mwd_(require|assert|is)_|require_owner|assert_owner') AS no_marker,
 count(*) FILTER (WHERE prosrc ~* 'user_metadata') AS metadata_marker,
 count(*) FILTER (WHERE has_function_privilege('anon',oid,'EXECUTE')) AS anon_executable
FROM f;
```

No se certifica el módulo comercial, la autorización de todas las ramas de ejecución ni un lanzamiento con dinero real. La revisión no modifica archivos del APK ni los disparadores del workflow en ejecución.
