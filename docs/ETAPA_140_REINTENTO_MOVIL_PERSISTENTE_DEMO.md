# Moneda Mundial 2.0 — etapa 140: reintento móvil persistente (DEMO)

**Base de trabajo:** rama de investigación de etapa 139.  
**Estado:** cambio local de código y pruebas automatizadas; no publicado en GitHub ni instalado en Samsung.

## Riesgo encontrado

En la versión anterior, el identificador UUID de una transferencia o aportación
pendiente se guardaba únicamente en un `useRef`. Al cerrar o reiniciar la app,
o incluso al navegar a otra pantalla, se perdía. Si el servidor había
confirmado el movimiento pero la respuesta no llegó al teléfono, el siguiente
intento podía llevar un UUID nuevo y descontar créditos ficticios por segunda vez.

## Protección implementada

- Antes de llamar a `mwd_transfer_demo` o `mwd_contribute_demo`, el cliente
  guarda en AsyncStorage el mismo UUID, tipo, monto, cuenta de origen y destino.
- El registro es **por usuario** y se recupera al abrir una nueva sesión en
  el dispositivo. No se guardan contraseñas, tokens ni claves privadas.
- Mientras exista una solicitud sin resolver, la aplicación no permite
  iniciar otra transferencia/aportación ficticia de ese usuario.
- La pantalla Inicio permite consultar
  `mwd_operation_status_demo` y reintentar **exactamente la misma solicitud**.
  Un estado `unconfirmed` no borra el registro: puede existir una
  confirmación tardía. Una respuesta `processed` solo permite borrarlo si
  coinciden UUID, tipo, importe y destinatario.
- Si el almacenamiento local falla o contiene un registro corrupto, se
  bloquean las nuevas operaciones (fallo seguro); no se inventa otro UUID.
- Cambio de cuenta o salida de sesión elimina solo la copia en memoria,
  **no** el registro pendiente de la cuenta anterior.

## Verificación realizada

- Doce pruebas específicas del registro local: reinicio simulado, separación
  de usuarios, recuperación de UUID, reintento idéntico, rechazo de cambios,
  corrupción, fallo de disco, confirmación coincidente y contradictoria,
  conservación de estados inciertos y aportación.
- La suite completa de Node ejecutó **96 archivos de pruebas, 96 aprobados**.
- `App.js` pasó el análisis sintáctico de JavaScript con JSX.
- Ninguna prueba hizo transferencias ni modificó la base de datos conectada.

## Prueba pendiente en un Samsung

1. Compilar una nueva APK de demostración desde esta rama y verificar su
   identidad/firma. No instalarla encima de otra con firma incompatible
   sin conservar primero los datos de prueba necesarios.
2. Iniciar sesión con una cuenta DEMO; comprobar el saldo y el historial.
3. Con una solicitud ficticia previamente autorizada, interrumpir la
   conexión después de iniciar el envío; reiniciar la app.
4. Comprobar que aparece la **misma** solicitud pendiente. Consultar su
   estado; reintentar con su UUID original, nunca con uno nuevo.
5. Confirmar, desde dos cuentas de prueba, que solo existe un movimiento
   contable y que ambas cifras cuadran.
6. Repetir cambios de cuenta, red lenta, cierre forzado y respuesta tardía.

## Límites y próximos controles

- AsyncStorage protege contra reinicios ordinarios del dispositivo, **no**
  garantiza recuperación tras desinstalar la app, borrar datos locales o
  cambiar de teléfono. Un registro de solicitudes en servidor por identidad
  y conciliación sigue siendo necesario.
- La protección de esta etapa se aplica solo a transferencias y aportaciones
  MWD ficticias. Pagos a comercios, remesas y Coin requieren sus propios
  contratos de idempotencia y recuperación.
- La app no maneja dinero real ni demuestra autorizaciones regulatorias.
  No hay nueva APK validada ni despliegue en producción.
- El comportamiento del servidor con carreras entre sesiones y sus
  permisos `SECURITY DEFINER` requiere pruebas aisladas adicionales.

**Criterio de cierre de etapa:** pruebas Samsung y de dos cuentas
documentadas, sin doble movimiento tras cortes de red y reinicios.
Hasta entonces, la etapa está **implementada localmente y pendiente de
aceptación en Android**.
