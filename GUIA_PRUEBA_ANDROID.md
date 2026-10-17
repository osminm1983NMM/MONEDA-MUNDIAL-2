# Guía para probar Moneda Mundial 2.0 en Android
**Solo demostración: los MWD no son dinero, no se pueden depositar ni retirar.**

## Requisito previo
Esperar a que el trabajo **APK Android independiente - pruebas** en GitHub Actions tenga estado verde `success`. Si está pendiente o en rojo, NO afirmar que existe una APK nueva validada. La verificación del paquete JavaScript no sustituye las pruebas manuales. Los artefactos de Actions vencen según la retención indicada en el flujo.

## APK de demostración verificada para la prueba del teléfono (17 de octubre de 2026)
- **Ejecución GitHub:** https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/39076729575
- **Versión del código:** `c7372e5147195c4010cad4c920c55ebfa4d414cd` (pantalla de recorrido completo; las modificaciones de documentación posteriores no cambian esta APK).
- **Archivo a elegir dentro de esa ejecución, sección Artifacts:** `moneda-mundial-2-demo-apk-verificada`.
- **Pruebas automáticas completadas:** se compiló, se instaló en un emulador Android 35 y se comprobó su arranque y el recorrido público de invitado; las evidencias se guardaron como `moneda-mundial-android-smoke-test`.
- **Retención:** la APK se conserva en Actions hasta 14 días desde su generación (sujeto a las reglas de GitHub). Comprobar que el artefacto todavía existe.
- **Límite:** pasar en un emulador no equivale a una prueba manual en el Samsung concreto ni autoriza dinero real.

## Obtener la APK desde un teléfono Samsung Android
1. Abrir en el navegador del teléfono la **[ejecución verificada de GitHub](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/39076729575)**. Si GitHub lo solicita, iniciar sesión con la cuenta propia.
2. Desplazarse hasta la sección **Artifacts** de esa ejecución y tocar **`moneda-mundial-2-demo-apk-verificada`**. Evitar las versiones de otras ejecuciones. Si el navegador móvil no muestra Artifacts, activar temporalmente **Sitio de escritorio**.
3. Se descargará un ZIP. Abrir **Mis archivos → Descargas** en el Samsung, tocar el ZIP y elegir **Extraer**. Se encontrará `app-release.apk`.
4. Tocar `app-release.apk` y seguir la instalación. Android puede preguntar si se permite instalar desde **Mis archivos**; habilitar únicamente ese permiso si se reconoce la procedencia y no ignorar advertencias de protección del dispositivo.
5. Abrir **Moneda Mundial 2.0**. Primero probar **Conocer la aplicación sin cuenta**. No ingresar números de tarjeta, cuenta, documentos de identidad ni fondos reales.
6. Si aparece un mensaje de firma incompatible con una instalación anterior, **no desinstalar ni sobrescribir automáticamente**; conservar el mensaje para revisarlo. La demostración nunca contiene fondos reales.

Para una ejecución futura, seleccionar la versión más reciente con nombre **`moneda-mundial-2-demo-apk-verificada`** y pruebas verdes en la **rama de desarrollo**; no instalar una APK simplemente porque terminó su compilación sin prueba de arranque.

## Pruebas manuales mínimas (sin dinero real)
**Caso 0 — Sin cuenta:** Abrir la aplicación, tocar **Conocer la aplicación sin cuenta (solo demostración)**, abrir **Conocer Coin y Digital**, volver a la visita inicial y finalmente a iniciar sesión. Comprobar que no aparece pantalla bancaria, cotización real ni saldos reales.

**Caso A — Acceso:** Iniciar sesión con cuenta de prueba. Comprobar que el saldo dice **MWD · créditos ficticios** y el aviso de que saldo real no está habilitado. Cerrar sesión.

**Caso B — Transferencia:** Usar *dos cuentas demo distintas*; una comparte **Compartir código para recibir**, la otra introduce ese código en **Enviar** y realiza transferencia ficticia. Revisar saldo e historial de ambos. Probar saldo insuficiente y código propio (debe rechazarse).

**Caso C — Comercio:** En **Mi comercio y solicitudes de cobro**, registrar nombre y país ISO de prueba, pulsar **Generar cobro ficticio**, compartir el código de solicitud. La segunda cuenta entra en **Pagar** y pulsa **Consultar cobro ficticio**, revisa el importe y confirma **Confirmar pago ficticio**. Revisar historial de ambos. Repetir un cobro pagado no debe generar doble débito. Cancelar una solicitud pendiente debe impedir su pago.

**Caso D — Internacional:** Entrar en **Países del mundo y disponibilidad** y buscar Costa Rica y Honduras. Abrir **Simulador internacional de comisiones** y elegir un destino compatible. Verificar que la cotización sea **hipotética**, que `realPaymentsEnabled` no se convierta en true y que, cuando falta FX, **no aparezca monto receptor inventado**. No se envía dinero.

**Caso E — Administración:** Abrir **Administración** con un usuario común y comprobar que no se conceden permisos de propietario. El resumen y las tarifas del dueño deben requerir rol de servidor.

**Caso F — Idioma:** En **Configuración** cambiar idioma a inglés, español y modo automático; verificar etiquetas y que el saldo permanezca ficticio.

**Caso H — Recorrido completo:** Tras iniciar sesión en una cuenta de prueba, ir a **Inicio → Más opciones → Recorrido completo · Billetera, Coin, Digital y Remesa (DEMO)**. Seleccionar primero **Coin**, comprobar la conversión *hipotética* y después **Financiación externa USD** para observar la remesa ficticia. Elegir Honduras o Nicaragua y probar una tasa introducida manualmente. Verificar que **no se realicen transferencias, compras, ventas, cobros ni débitos** y que el botón **← Volver al inicio** funciona.

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
