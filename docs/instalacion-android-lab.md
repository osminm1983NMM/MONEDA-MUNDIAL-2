# Instalación controlada — Moneda Mundial 2.0 LAB

## Estado
Esta rama contiene una DEMO de créditos ficticios. Las comprobaciones de código no prueban que la APK compile ni que el backend funcione en Android. No enviar dinero real.

## Configuración comprobable
- Perfil EAS: `preview`, distribución interna, `android.buildType=apk`.
- Expo owner: `12051983`.
- Expo projectId: `93c31760-4d1e-49f3-888b-9b5845c31e53`.
- Nombre visible: Moneda Mundial 2.0 LAB.
- Paquete Android: `com.monedamundial.app.samsunglab`.
- Versión: `2.0.1`, versionCode `2`.

## Antes de compilar
1. Verificar en Expo que el projectId pertenece a la cuenta y proyecto esperados. No modificar el projectId a ciegas.
2. Confirmar que la compilación utiliza esta rama, no `main` sin revisar.
3. Confirmar firma Android, cuota y permisos de EAS antes de lanzar una compilación.
4. No añadir credenciales privadas ni claves service_role al repositorio o APK.

## Compilación e instalación
Con la cuenta Expo autenticada, iniciar compilación Android con el perfil `preview` desde el código de esta rama (`eas build --platform android --profile preview`). Comprobar que el resultado es APK y no AAB. Descargar el archivo desde la página oficial del build en Expo e instalarlo en Samsung. El paquete LAB se instala por separado de otros paquetes; si existe una instalación anterior con el mismo paquete LAB, Android puede pedir actualización o rechazarla si la firma difiere. No desinstalar aplicaciones anteriores antes de comprobar la nueva.

## Pruebas mínimas
1. Abrir LAB y verificar que muestra explícitamente créditos ficticios.
2. Iniciar sesión en cuenta A, revisar saldo e historial.
3. Transferir una cantidad pequeña ficticia a cuenta B, comprobar saldo e historial en ambas cuentas.
4. Simular interrupción de red durante una transferencia; reintentar la misma operación pendiente sin duplicarla.
5. Cerrar y reabrir LAB, recuperar una operación pendiente y comprobar el resultado.
6. Probar aportación y conversión COIN/Digital; confirmar idempotencia y actualización de saldo.
7. Verificar que la renovación de sesión no cambia la pantalla activa y que cambiar de cuenta no limpia operaciones pendientes de otra cuenta.
8. Solo tras validar la nueva LAB, decidir si conviene desinstalar versiones anteriores.

## Condición de salida
No declarar lista la aplicación ni apta para dinero real sin build exitoso, pruebas manuales en Android y revisión de cumplimiento financiero y seguridad.
