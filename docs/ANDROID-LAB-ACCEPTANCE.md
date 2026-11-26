# Aceptación Android LAB — Moneda Mundial

Estado: pendiente de evidencia del APK actualizado. Exclusivamente créditos ficticios.

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
