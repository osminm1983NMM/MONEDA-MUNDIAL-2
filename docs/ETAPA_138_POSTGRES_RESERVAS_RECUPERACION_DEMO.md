# Moneda Mundial 2.0 — etapa 138: reserva persistente DEMO en PostgreSQL aislado

Este diseño se ejecuta **solo** en el servicio PostgreSQL 16 desechable de
GitHub Actions. No está instalado en el Supabase del proyecto ni conectado a
React Native, proveedores financieros, cuentas bancarias o criptomonedas.
La propia migración de investigación bloquea la ejecución si la base no se
llama exactamente `ledger_test` (nombre reservado para este laboratorio).

## Avance concreto

- La referencia de solicitud y su importe ficticio se registran antes de que
  pudiera invocarse un proveedor externo. La respuesta marca siempre
  `safe_to_submit_again: false`.
- Una restricción única sobre `(actor_alias, request_id)` hace idempotente
  la misma solicitud; reutilizarla con otro monto o destinatario se rechaza.
- Un índice único parcial admite **solo una operación pendiente** por cuenta
  sintética, incluso si dos conexiones compiten simultáneamente.
- Una consulta de solo lectura localiza una operación tras abrir una conexión
  distinta. Una confirmación manual ficticia queda vinculada a un solo recibo.
- El registro es separado para dos cuentas de prueba, una hacia Honduras y
  otra hacia Nicaragua; estos países son **ejemplos, no el catálogo completo**.
- Las tablas privadas tienen RLS activado y acceso a `anon`/`authenticated`
  revocado. Las funciones son `SECURITY INVOKER`, sin llaves privilegiadas.

## Lo que esto NO prueba

1. El actor es un alias sintético, **no** una identidad autenticada. El acceso
   real requerirá autorización del servidor y enlace a la cuenta verificable.
2. El recibo se confirma con un fixture manual: no demuestra dinero recibido,
   autenticidad bancaria, KYC, derechos de retiro ni provisión de fondos.
3. No existe escritura transaccional desde la app al proveedor; la prueba SQL
   verifica el registro de solicitudes, no una transferencia financiera real.
4. Aún falta conectar este estudio al libro mayor de partida doble, a
   conciliación bancaria y a una recuperación después de caídas de red.

Antes de dinero real deberemos introducir custodia y segregación reales,
autenticación fuerte, roles, revisión legal por país, socios regulados y
pruebas de resiliencia supervisadas.

Referencias técnicas: [PostgreSQL índices parciales](https://www.postgresql.org/docs/current/indexes-partial.html),
[PostgreSQL bloqueo por filas](https://www.postgresql.org/docs/current/explicit-locking.html)
y [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
