# Moneda Mundial 2.0 — etapa 136: no reenviar remesas ficticias interrumpidas

**Laboratorio Node únicamente.** No son saldos bancarios, datos del Samsung ni
operaciones de dinero real.

## Problema y cambio

Antes, `createMockInterruptedTransferRecovery` protegía operaciones pendientes
solo mientras existía su instancia de controlador. Ahora puede recibir un
`createMockTransferRecoveryJournal()` compartido entre instancias **dentro
del mismo proceso**. Las dos pantallas simuladas consultan el mismo registro:

1. La intención ficticia se marca pendiente **antes** de llamar al transporte.
2. Si se pierde la respuesta, ninguna nueva instancia puede reenviar.
3. Solo una consulta de lectura puede validar que el pedido ficticio ya existe.
4. Los recibos verificados se recuerdan entre instancias para evitar repetir
   la misma intención; una segunda intención distinta espera a que se resuelva
   la anterior.
5. Si la respuesta original llega tarde después de una inspección exitosa,
   ambas instancias terminan con un estado verificado coherente.

## Garantías y límites

- `realMoneyEnabled: false`, `persistentStorageConnected: false`.
- **No sobrevive al cierre del proceso ni al reinicio del teléfono**. No está
  integrado todavía con la pantalla React Native ni con Supabase.
- No se hizo ningún envío externo; todas las cuentas y recibos son sintéticos.
- Antes de operar con fondos reales se requerirá un registro transaccional
  persistente del lado del servidor, claves únicas de idempotencia y un
  proveedor financiero que permita consultar el estado sin reenviar.

En GitHub Actions solo se ejecutan pruebas de Node de este controlador y de
conciliación ficticia. No se instala ninguna APK ni se activan pagos.
