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
