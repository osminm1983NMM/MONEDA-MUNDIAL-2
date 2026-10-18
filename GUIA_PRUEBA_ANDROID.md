# Guía para probar Moneda Mundial 2.0 en Android
**Solo demostración: los MWD no son dinero, no se pueden depositar ni retirar.**

## Requisito previo
Esperar a que el trabajo **APK Android independiente - pruebas** en GitHub Actions tenga estado verde `success`. Si está pendiente o en rojo, NO afirmar que existe una APK nueva validada. La verificación del paquete JavaScript no sustituye las pruebas manuales. Los artefactos de Actions vencen según la retención indicada en el flujo.

## APK de demostración anterior verificada (17 de octubre de 2026, hora de Washington D. C.)
- **Ejecución GitHub:** https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/39087333726
- **Versión del código:** `1262ba893fc5a16e1ead2515a6d851d10a7ec4e2` (vista pública de retiro sin teléfono incluida; no contiene los cambios pendientes de las solicitudes #59 y #60).
- **Archivo a elegir dentro de esa ejecución, sección Artifacts:** `moneda-mundial-2-demo-apk-verificada`.
- **Pruebas automáticas completadas:** se compiló, se instaló en un emulador Android 35 y se comprobó su arranque y el recorrido público de invitado; las evidencias se guardaron como `moneda-mundial-android-smoke-test`.
- **Huella SHA-256 verificada de la APK:** `06f8bdc02c0ef00003ced7d3cb878824b794678921fa8f20c5ffba5eca58ffac`. Comparar la huella del archivo exacto antes de distribuirlo a terceros.
- **Alcance de esta compilación antigua:** incluye la visita pública sobre retiro sin teléfono (sin códigos cobrables); **no incluye** los cambios de las solicitudes #59 y #60, aunque ahora **sí están integrados en la rama de desarrollo desde el 18 de octubre**. La nueva APK requiere su propia prueba completa del mismo commit antes de compartirla.
- **Retención:** la APK se conserva en Actions hasta 14 días desde su generación (sujeto a las reglas de GitHub). Comprobar que el artefacto todavía existe.
- **Límite:** pasar en un emulador no equivale a una prueba manual en el Samsung concreto ni autoriza dinero real.

## Obtener la APK desde un teléfono Samsung Android
1. Abrir en el navegador del teléfono la **[ejecución verificada de GitHub](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/39087333726)**. Si GitHub lo solicita, iniciar sesión con la cuenta propia.
2. Desplazarse hasta la sección **Artifacts** de esa ejecución y tocar **`moneda-mundial-2-demo-apk-verificada`**. Evitar las versiones de otras ejecuciones. Si el navegador móvil no muestra Artifacts, activar temporalmente **Sitio de escritorio**.
3. Se descargará un ZIP. Abrir **Mis archivos → Descargas** en el Samsung, tocar el ZIP y elegir **Extraer**. Se encontrará `app-release.apk`.
4. Tocar `app-release.apk` y seguir la instalación. Android puede preguntar si se permite instalar desde **Mis archivos**; habilitar únicamente ese permiso si se reconoce la procedencia y no ignorar advertencias de protección del dispositivo.
5. Abrir **Moneda Mundial 2.0**. Primero probar **Conocer la aplicación sin cuenta**. No ingresar números de tarjeta, cuenta, documentos de identidad ni fondos reales.
6. Si aparece un mensaje de firma incompatible con una instalación anterior, **no desinstalar ni sobrescribir automáticamente**; conservar el mensaje para revisarlo. La demostración nunca contiene fondos reales.

Para una ejecución futura, seleccionar la versión más reciente con nombre **`moneda-mundial-2-demo-apk-verificada`** y pruebas verdes en la **rama de desarrollo**; no instalar una APK simplemente porque terminó su compilación sin prueba de arranque.

## Pruebas manuales mínimas (sin dinero real)
**Caso 0 — Sin cuenta:** Abrir la aplicación, tocar **Conocer la aplicación sin cuenta (solo demostración)**, abrir **Conocer Coin y Digital** y **Conocer retiro sin teléfono**, regresar a la visita inicial y finalmente a iniciar sesión. Comprobar que no aparece pantalla bancaria, cotización real ni saldos reales, y que **no** se genera un código de retiro cobrable.

**Caso A — Acceso:** Iniciar sesión con cuenta de prueba. Comprobar que el saldo dice **MWD · créditos ficticios** y el aviso de que saldo real no está habilitado. Cerrar sesión.

**Caso B — Transferencia:** Usar *dos cuentas demo distintas*; una comparte **Compartir código para recibir**, la otra introduce ese código en **Enviar** y realiza transferencia ficticia. Revisar saldo e historial de ambos. Probar saldo insuficiente y código propio (debe rechazarse).

**Caso C — Comercio:** En **Mi comercio y solicitudes de cobro**, registrar nombre y país ISO de prueba, pulsar **Generar cobro ficticio**, compartir el código de solicitud. La segunda cuenta entra en **Pagar** y pulsa **Consultar cobro ficticio**, revisa el importe y confirma **Confirmar pago ficticio**. Revisar historial de ambos. Repetir un cobro pagado no debe generar doble débito. Cancelar una solicitud pendiente debe impedir su pago.

**Caso D — Internacional:** Entrar en **Países del mundo y disponibilidad** y buscar Costa Rica y Honduras. Abrir **Simulador internacional de comisiones** y elegir un destino compatible. Verificar que la cotización sea **hipotética**, que `realPaymentsEnabled` no se convierta en true y que, cuando falta FX, **no aparezca monto receptor inventado**. No se envía dinero.

**Caso E — Administración:** Abrir **Administración** con un usuario común y comprobar que no se conceden permisos de propietario. El resumen y las tarifas del dueño deben requerir rol de servidor.

**Caso F — Idioma:** En **Configuración** cambiar idioma a inglés, español y modo automático; verificar etiquetas y que el saldo permanezca ficticio.

**Caso H — Recorrido completo:** Tras iniciar sesión en una cuenta de prueba, ir a **Inicio → Más opciones → Recorrido completo · Billetera, Coin, Digital y Remesa (DEMO)**. Seleccionar primero **Coin**, comprobar la conversión *hipotética* y después **Financiación externa USD** para observar la remesa ficticia. Elegir Honduras o Nicaragua y probar una tasa introducida manualmente. Verificar que **no se realicen transferencias, compras, ventas, cobros ni débitos** y que el botón **← Volver al inicio** funciona.

**Caso G — Recuperación de contraseña:** Verificar el correo de recuperación solo en cuentas de ensayo y revisar la redirección Android. Nunca enviar claves, contraseñas, capturas de sesiones ni códigos de verificación a terceros.

## Pruebas adicionales para una APK NUEVA que incorpore #59 y #60

**No buscar estas funciones en la APK antigua del 17 de octubre:** #59 y #60 ya están integradas en `desarrollo-comercios-20261013`, pero la APK antigua sigue sin contenerlas. No instalar ni distribuir una APK de la rama integrada hasta que la compilación y la prueba de emulador de **ese mismo commit** concluyan correctamente.

**Caso I — Compra y venta de Coin:** sin ingresar a ninguna cuenta, ir a **Conocer la aplicación → Conocer Coin y Digital → Compra y venta de Coin (solo ejemplo)**. Probar cantidades y precios manuales, elegir comprar y vender, cambiar la comisión, e introducir una comisión mayor al límite. Solo deben aparecer resultados ilustrativos; **no** deben existir botones funcionales de cobro, ejecución o conexión a mercados.

**Caso J — Digital a Coin:** con cuenta de demostración, ir a **Recorrido completo** y seleccionar **Moneda Mundial Digital**. Verificar el ejemplo inverso **Digital→Coin**, con precios, comisiones y deslizamiento introducidos manualmente. No se debe modificar saldo MWD ni aparecer una orden real.

**Caso K — Contactos de proveedores:** desde **Proveedores para evaluar**, seleccionar Honduras y una modalidad. Solo tras revisión consciente del responsable, la app debe poder **compartir un borrador** y **abrir el formulario oficial**. Ninguno de los dos botones debe enviar una consulta automáticamente. Para Nicaragua y otros destinos no se debe afirmar disponibilidad comercial.

Para ofrecer estas pruebas, generar **otra APK desde el commit integrado**, ejecutar CI y probar ese paquete específico en un emulador. Si se agregan nuevas pruebas de compra/venta (#61), revisar su resultado antes de dar por validada la APK. Nunca tratar el ZIP o la APK anterior como si contuviera los cambios #59/#60.

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
