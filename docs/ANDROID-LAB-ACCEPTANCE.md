# Aceptación Android LAB — Moneda Mundial

Estado: CI anterior aprobado; validación física parcial; nueva compilación en curso. Identidad exacta del APK instalado pendiente. Exclusivamente créditos ficticios.

## Evidencia de compilación
- Registrar URL de ejecución, commit y conclusión de los trabajos apk y smoke-test.
- Descargar únicamente el artefacto MonedaMundial-LAB-Samsung de la ejecución exitosa correspondiente.
- Verificar SHA256.txt y COMMIT.txt; paquete com.monedamundial.lab.samsung, firma de desarrollo. No distribuir como producción.

## Prueba física Samsung
- Instalar sin desinstalar otras versiones ni borrar datos; comprobar nombre LAB.
- Abrir dos veces, iniciar sesión con cuenta DEMO A, actualizar saldo e historial.
- Transferir importe ficticio pequeño a B, comprobar ambos saldos e historial; registrar referencia sin publicar datos personales.
- Simular pérdida de red y reintentar la misma referencia; verificar ausencia de segundo débito.
- Cambiar de cuenta y verificar que no se muestran datos de A en B.
- Probar aportación, conversión y retiro ficticios, sin financiación ni pago real.
- Probar cierre de sesión, reapertura y recuperación de contraseña con el esquema LAB permitido en Supabase. No cambiar configuración sin revisar impacto.
- Registrar cada resultado como aprobado, fallido o no ejecutado. No confundir emulador con teléfono físico.

## Criterio de salida
APK verificable, instalación y pruebas físicas aprobadas, sin errores críticos abiertos. No autoriza dinero real. No crear infraestructura de pago ni modificar main para completar esta lista.


## Evidencia CI — 25/26 de noviembre de 2026

- Commit auditado: `822f2fa15e9ebd1100fb84a6f983c6bb7582bf4a`.
- [Ejecución 45736122605](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45736122605): completada con éxito; jobs `apk` y `smoke-test` aprobados.
- [APK y archivos SHA256/COMMIT](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45736122605/artifacts/15078693162).
- [Captura del emulador](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45736122605/artifacts/15079287815).
- Artefactos temporales: vencen el 3 de diciembre de 2026 (UTC).
- Pendiente: instalación y pruebas funcionales en Samsung físico. No aprobado para dinero real.
- Recuperación LAB: autorizar exactamente `com.monedamundial.lab.samsung://auth/reset-password` en Supabase Auth y probar enlace abierto/cerrado, vencido y consumido. No se ha cambiado esa configuración.

## Evidencia física parcial — 25 de noviembre de 2026

- Capturas del Samsung aportadas por el usuario: aplicación abierta, sesión activa, saldo ficticio visible de 10,104.00 MWD.
- Actualización manual: interfaz muestra «Saldo e historial actualizados correctamente».
- No se ha verificado aún la identidad exacta del APK instalado ni la coincidencia independiente del saldo con el servidor en esta sesión.
- Pendientes: transferencia física A→B, conciliación de ambos saldos, historial, reintento de red, cambio de cuenta, conversiones, aportación, retiro y recuperación de contraseña.

## Conciliación independiente de saldo

Consulta de solo lectura en Supabase: saldo de la billetera observada en Samsung = 1,010,400 centavos MWD, igual a 10,104.00 MWD en pantalla. Diferencia cero. Cinco billeteras, 26 operaciones, cero saldos inválidos y cero referencias duplicadas por actor. No equivale a una prueba de transferencia física ni a conciliación bancaria real.

## Transferencia física A→B — 25 de noviembre de 2026

Usuario confirma dos envíos voluntarios de 10 MWD. Supabase registra dos transferencias con referencias distintas a las 20:48:32 y 20:49:26 EST. Saldo A inicial 10,104.00 y final 10,084.00 MWD; diferencia esperada cero. Saldo B observado 9,913.00 MWD; pendiente verificar visualmente en sesión B y saldo previo independiente. Total 28 operaciones, cero referencias duplicadas. Transferencia normal física y débito aprobados; no implica prueba física de reintento idempotente. Sin modificación de saldos por el asistente.

## Historial físico del destinatario

Captura Samsung 20:52 EST: dos transferencias recibidas de +10.00 MWD, a las 20:49:26 y 20:48:32 del 25/11/2026, coincidentes con los registros SQL. Recepción e historial visual aprobados. Pendiente captura de saldo B (esperado 9,913.00 MWD según consulta anterior) y prueba de recuperación de red. No se alteraron saldos.

## Conciliación física del destinatario

Captura Samsung 20:53 EST: cuenta B con código destinatario correcto y saldo 9,913.00 MWD, idéntico a la consulta Supabase posterior a los dos envíos voluntarios. Diferencia cero. Aprobada transferencia normal de extremo a extremo y visualización de saldo e historial receptor. Pendientes pruebas físicas de reintento, conversión, aportación, retiro y recuperación de contraseña. No se modificaron saldos.

## Conversión física COIN → DIGITAL

Capturas Samsung 20:55–20:57 EST: saldo inicial 124.920000 COIN y 996.872809 DIGITAL; cotización de 10 COIN, neto 1.246875 DIGITAL, comisión 0.003125 DIGITAL (0.25% del bruto). Diálogo de confirmación visible. Saldo final 114.920000 COIN y 998.119684 DIGITAL, coincide con cálculo exacto. Aprobada evidencia visual de conversión normal; pendiente conciliación independiente SQL y conversión inversa física.

## Candidata de cierre — 26 de noviembre de 2026

- [CI Android actualizado, ejecución 45809213055](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45809213055), revisión borrador 132. Dependencias, pruebas Android, auditoría integral, compatibilidad Expo, configuración LAB, recuperación simulada con esquema LAB y prebuild aprobados. Compilación Gradle pendiente de conclusión al registrar. No instalar un artefacto hasta aprobar procedencia y emulador.
- [CI PostgreSQL 45809212853](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45809212853) completada con éxito, segunda ejecución: tres puertas funcionales, cuatro escenarios simultáneos con bloqueo observado y diez puertas de auditoría. Contenedor eliminado. No certifica correo real ni dispositivo físico.
- Priorizar una sola sesión de aceptación del APK nuevo: identidad del artefacto y apertura; recuperación de contraseña con redirect LAB exacto; pérdida de red y reintento con la misma referencia; conversión inversa DIGITAL→COIN; aportación y retiro ficticios. No repetir transferencias normales ya conciliadas salvo prueba de regresión necesaria. No enviar contraseñas, códigos privados ni enlaces de recuperación en capturas. No desinstalar la versión instalada ni borrar datos ante error de firma: conservar y diagnosticar.

## APK candidata generada — 26 de noviembre de 2026

- Run 45809213055, commit `202d429176fd5cae3a8fbd1a3f35b147bfe6ddb0`; job apk 139872348424 completado con éxito. Logs: 31 pruebas Android y 23 regresiones Node aprobadas, 12 escenarios de recuperación normales y 12 LAB, auditorías y compilación Gradle aprobadas.
- Firma APK v2 válida de desarrollo; paquete `com.monedamundial.lab.samsung`, versionCode 1, versionName 2.0.0, arquitecturas arm64-v8a y x86_64.
- Artefacto [MonedaMundial-LAB-Samsung](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45809213055/artifacts/15112630795), vence 2026-12-03 11:22:33 UTC. ZIP 15,977,744 bytes; digest SHA256 del ZIP `181f12fdcbd3de0d304c847d4621ca838cc5870f7071f46fb51ce74788b8184b`. No confundir digest ZIP con SHA256.txt del APK.
- Verificación de procedencia del APK aprobada en el job smoke-test 139875153066; estado observado al registrar: [{"name":"Install and launch Android 35","status":"in_progress","conclusion":null,"number":5},{"name":"Run actions/upload-artifact@v4","status":"pending","conclusion":null,"number":6}]. Aceptación de emulador y física se registran por separado; no instalar antes de verificar el resultado final. Si Android rechaza actualización por firma, no desinstalar ni borrar datos.

## Aceptación automática Android — COMPLETADA

Run [45809213055](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45809213055), commit `202d429176fd5cae3a8fbd1a3f35b147bfe6ddb0`, jobs apk y smoke-test completados con éxito. Los logs del job 139875153066 confirman SHA256 del ZIP coincidente, `MonedaMundial-LAB.apk: OK`, commit verificado, instalación exitosa y dos aperturas `Status: ok` de MainActivity en Android 35. Captura archivada: https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45809213055/artifacts/15110759610. APK: https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45809213055/artifacts/15112630795; vence el 3 de diciembre de 2026 a las 11:22:33 UTC. Candidata DEMO lista para aceptación física, no para producción. Pendientes: identificar versión en Samsung, comprobar que instalación/actualización no requiera borrar datos, probar reintento de red, conversión inversa, aportación/retiro ficticios y recuperación por correo con redirect LAB permitido. No se modificaron main, Supabase, saldos ni pagos reales.

## Verificación independiente del archivo entregable

Se descargó el ZIP del artefacto 15112630795 y se verificó su SHA-256 contra GitHub. Se extrajo el APK original sin modificación (34,148,529 bytes), SHA-256 `7959d65155f28d8530c3d50ac885a0a42df402312db4560907aa30f42dfc7c97`, coincidente con SHA256.txt. Aclaración de procedencia: `202d429176fd5cae3a8fbd1a3f35b147bfe6ddb0` es el HEAD de la rama del PR; `119303c46bad66b02fa6a917e3af7b628df475bc` es el commit de integración temporal del PR que aparece en COMMIT.txt y en los logs de checkout. Comparación de ambos confirma que solo difieren en docs/DEMO-RELEASE-GATES.md. El PR sigue sin fusionar. La captura física posterior confirma apertura y saldo coincidente con servidor, pero no identifica de manera concluyente el APK instalado. No declarar aceptada la candidata física hasta confirmar instalación y pruebas restantes. No se modificaron datos de Supabase.

## Compatibilidad de actualización LAB — verificación de certificados

Se descargaron los artefactos 15078693162 (run 45736122605) y 15112630795 (run 45809213055). SHA-256 de cada APK coincide con su SHA256.txt. Se extrajo el certificado DER del bloque de firma APK v2 de ambos archivos: SHA-256 idéntico `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`. Los dos APK tienen certificado Android Debug; esta comparación no es una nueva verificación criptográfica completa de la firma, que ya pasó en CI. Es compatible por certificado con la actualización de la candidata LAB anterior; no demuestra qué paquete/certificado está instalado en el Samsung. No desinstalar ni borrar datos ante un rechazo. Se mantiene pendiente la instalación física de la candidata exacta, las pruebas de reintento, conversión inversa, aportación/retiro y recuperación por correo. No se cambia main, código de la app, Supabase ni saldos.
