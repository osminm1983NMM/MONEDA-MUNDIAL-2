# Pruebas de recuperación e idempotencia — Moneda Mundial 2.0

**Alcance:** créditos MWD ficticios. No habilitar pagos reales. Ejecutar con cuentas de prueba y registrar resultados; este documento **no significa que las pruebas se hayan ejecutado**.

## Condiciones de aprobación

1. No hay dos cargos para un mismo `request_id` del mismo actor.
2. Si la respuesta del servidor se pierde después del commit, la app reconoce la operación original y **no vuelve a debitar**.
3. Si se cierra Android durante una operación incierta, se restaura `type/cents/code/id` desde AsyncStorage y se usa el mismo `id`.
4. Nunca se envía una solicitud nueva si la lectura de pendientes falla o los datos almacenados son inválidos.
5. Una respuesta de estado `processed` solo se acepta si coinciden tipo, importe y destinatario.
6. La actualización visual de saldo/historial no modifica el resultado contable confirmado.

## Matriz manual de pruebas

| ID | Escenario | Resultado esperado |
| --- | --- | --- |
| T01 | Transferencia normal A → B | Un débito y un crédito; una operación; asiento balanceado |
| T02 | Aportación normal | Un débito; una operación; **asiento pendiente de política contable** |
| T03 | Dos toques rápidos en Confirmar | Una sola solicitud |
| T04 | Respuesta perdida después de commit del servidor | Consulta `processed`; no segundo débito |
| T05 | Timeout antes de recibir el servidor | Consulta `unconfirmed`; reintento con mismo ID |
| T06 | Sin conexión durante consulta de estado | Conserva ID; no genera otro |
| T07 | Cerrar app después de guardar ID, antes del RPC | Restaura la solicitud; reintenta con mismo ID |
| T08 | Cerrar app después de commit, antes de respuesta | Restaura ID; consulta `processed`; no duplica |
| T09 | Cambiar importe/destinatario con solicitud pendiente | Bloqueado hasta resolver pendiente |
| T10 | Intentar aportación cuando existe transferencia pendiente | Bloqueado por diferencia de tipo |
| T11 | Falla de lectura AsyncStorage | Bloquea nuevas operaciones; aviso claro |
| T12 | Falla de borrado AsyncStorage después de commit | Conserva referencia para verificación posterior |
| T13 | Refrescar saldo falla después de commit | La operación sigue confirmada; permite refrescar más tarde |
| T14 | Saldo disminuido tras commit pero respuesta perdida | Permite consultar/reintentar solicitud original sin bloqueo por saldo |
| T15 | Cerrar sesión e iniciar con otra cuenta | No muestra ni reutiliza ID pendiente de otro usuario |
| T16 | Estado `processed` con datos diferentes | Bloquea y solicita revisión, sin crear otra solicitud |
| T17 | Reiniciar con almacenamiento pendiente corrupto | Bloquea envío; no reemplaza el ID silenciosamente |

## Evidencia requerida por caso

- Versión/commit de App.js y versión Android/Expo.
- Cuenta A/B de prueba (sin contraseñas ni tokens).
- ID de solicitud, importe ficticio, destinatario y hora.
- Estado antes/después de billeteras, operación y libro de doble partida.
- Captura de error de conexión y resultado al recuperar.
- Marcar PASS/FAIL/SIN EJECUTAR; registrar incidencias.

## Consultas SQL de apoyo

Usar `audits/contribution-ledger-readonly.sql` para conciliación general. Para un caso específico, consultar por `request_id` de prueba con acceso administrativo autorizado, sin publicar datos personales.

```sql
-- Sustituir el UUID por el request_id de prueba.
select kind, count(*) as operaciones, sum(amount_cents) as total_centavos
from public.mwd_operations
where request_id = '00000000-0000-0000-0000-000000000000'::uuid
group by kind;
```

## Estado

**SIN EJECUTAR en Android.** La revisión estática del código no reemplaza la prueba de pérdida de conexión ni la validación contable del entorno.
