# Moneda Mundial 2.0 — etapa 137: checkpoint serializable de remesa ficticia

**Estado:** prueba unitaria de Node, sin app Samsung, base de datos, cuentas
reales, proveedor regulado ni operaciones financieras.

## Avance

`createMockTransferRecoveryJournal()` ahora expone `exportSnapshot()` y permite
crear un nuevo registro con `createMockTransferRecoveryJournal({snapshot})`.
El checkpoint incluye solamente referencias y alias sintéticos:

- pendientes por cuenta, con el `requestId` original;
- recibos ficticios verificados y referencias ya resueltas;
- versión del formato y un SHA-256 del contenido para detectar cambios
  **accidentales**.

Pruebas cubiertas:

1. Reconstituir en otro controlador una orden ficticia cuyo envío quedó
   incierto: bloquear un segundo envío y comprobar en **solo lectura**.
2. Restaurar un recibo completado y devolver la misma referencia sin volver
   a ejecutar la confirmación ficticia.
3. Mantener los registros independientes de dos cuentas sintéticas.
4. Bloquear checkpoints truncados o modificados; nunca asumirlos vacíos.

## Límites que no debemos ocultar

El checkpoint es **exportable pero no se guarda automáticamente**. Otro
componente necesitará almacenamiento seguro y confirmación durable **antes**
de iniciar la llamada a un proveedor. SHA-256 detecta corrupción accidental,
pero **no autentica** quién creó el archivo: no protege contra falsificación
deliberada si el atacante puede recalcular la huella.

No existe aún integración con AsyncStorage, Supabase o servicios bancarios para
este registro. Ni esta prueba ni una restauración de JSON demuestran que una
transacción real pueda recuperarse tras apagar el Samsung. Antes de usar fondos
reales se requerirá un registro del lado del servidor con control de
concurrencia, idempotencia, autorizaciones y conciliación bancaria.
