# Guía para probar Moneda Mundial 2.0 en Android
**Solo demostración: los MWD no son dinero, no se pueden depositar ni retirar.**

## Requisito previo
Esperar a que el trabajo **APK Android independiente - pruebas** en GitHub Actions tenga estado verde `success`. Si está pendiente o en rojo, NO afirmar que existe una APK nueva validada. La verificación del paquete JavaScript no sustituye las pruebas manuales. Los artefactos de Actions vencen según la retención indicada en el flujo.

## Obtener la APK desde un teléfono Android
1. Abrir https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions
2. Entrar al flujo **APK Android independiente - pruebas** y elegir la **ejecución exitosa más reciente de la rama `desarrollo-comercios-20261013`** (evitar instalar versiones de ramas antiguas).
3. En la parte inferior, buscar **Artifacts** y pulsar `moneda-mundial-2-demo-independiente`. GitHub puede exigir iniciar sesión.
4. Android descargará un **ZIP** que contiene la APK; abrir `Archivos / Mis archivos > Descargas`, extraer el ZIP y abrir `app-release.apk`.
5. Android puede solicitar permiso para instalar desde el navegador o gestor de archivos. Autorizar solo si se reconoce la procedencia. NO ignorar avisos de seguridad del sistema.
6. Si Android avisa que la firma no coincide con una app instalada, **no sobrescribir ni desinstalar sin respaldar datos importantes**; informar del mensaje. La versión de demostración no debe guardar fondos ni contraseñas fuera del servicio de autenticación.

## Pruebas manuales mínimas (sin dinero real)
**Caso A — Acceso:** Iniciar sesión con cuenta de prueba. Comprobar que el saldo dice **MWD · créditos ficticios** y el aviso de que saldo real no está habilitado. Cerrar sesión.

**Caso B — Transferencia:** Usar *dos cuentas demo distintas*; una comparte **Compartir código para recibir**, la otra introduce ese código en **Enviar** y realiza transferencia ficticia. Revisar saldo e historial de ambos. Probar saldo insuficiente y código propio (debe rechazarse).

**Caso C — Comercio:** En **Mi comercio y solicitudes de cobro**, registrar nombre y país ISO de prueba, pulsar **Generar cobro ficticio**, compartir el código de solicitud. La segunda cuenta entra en **Pagar** y pulsa **Consultar cobro ficticio**, revisa el importe y confirma **Confirmar pago ficticio**. Revisar historial de ambos. Repetir un cobro pagado no debe generar doble débito. Cancelar una solicitud pendiente debe impedir su pago.

**Caso D — Internacional:** Entrar en **Países del mundo y disponibilidad** y buscar Costa Rica y Honduras. Abrir **Simulador internacional de comisiones** y elegir un destino compatible. Verificar que la cotización sea **hipotética**, que `realPaymentsEnabled` no se convierta en true y que, cuando falta FX, **no aparezca monto receptor inventado**. No se envía dinero.

**Caso E — Administración:** Abrir **Administración** con un usuario común y comprobar que no se conceden permisos de propietario. El resumen y las tarifas del dueño deben requerir rol de servidor.

**Caso F — Idioma:** En **Configuración** cambiar idioma a inglés, español y modo automático; verificar etiquetas y que el saldo permanezca ficticio.

**Caso G — Recuperación de contraseña:** Verificar el correo de recuperación solo en cuentas de ensayo y revisar la redirección Android. Nunca enviar claves, contraseñas, capturas de sesiones ni códigos de verificación a terceros.

## Criterios para informar un error
Tomar nota de:
- Qué botón se pulsó y qué mensaje apareció.
- Pantalla y hora aproximada.
- Si usaba Wi-Fi o datos móviles.
- La ejecución de GitHub y versión exacta.

No enviar contraseñas, tokens, códigos temporales, datos financieros ni capturas que muestren secretos.

## Qué aún no está listo
- APK no es autorización regulatoria.
- No existe depósito real, retiro a tarjetas, transferencia bancaria ni cotización real de divisas.
- Las pruebas automáticas no prueban que la app funcione en **todos** los modelos Android.
- Antes de la LLC aún hacen falta pruebas E2E, seguridad, privacidad, accesibilidad y revisión de especialistas para el futuro lanzamiento financiero.
