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

## Aportación física — 26 de noviembre de 2026, 06:33 EST

Capturas Samsung antes/después: cuenta B, 9,913.00 → 9,903.00 MWD. Consulta Supabase de solo lectura confirma 990300 centavos de saldo y última operación contribution por 1000 centavos, a las 11:33:06 UTC; una sola fila con la referencia del actor. Débito ficticio y registro aprobados; historial visual pendiente. La vista de auditoría devuelve contribution_requires_accounting_policy: no equivale a conciliación contable completa y debe revisarse antes de cierre financiero. Identidad exacta del APK físico pendiente. No se modificaron datos ni configuración de Supabase.

## Historial y conciliación contable de aportación física

Captura Samsung: aportación ficticia -10.00 MWD, 26/11/2026 06:33:06 EST, coincide con el registro SQL. Consulta independiente de solo lectura confirma transacción demo_contribution posted con exactamente dos asientos, débito 1000 y crédito 1000 centavos MWD, diferencia cero. La definición de demo_operations_audit_v1 devuelve incondicionalmente contribution_requires_accounting_policy para kind=contribution; es una clasificación heredada, no una detección de descuadre. Queda pendiente actualizar esa vista con verificaciones reales en entorno aislado, sin ocultar anomalías. Aportación física normal, saldo, historial y doble partida de esta operación aprobados. No se cambió esquema, datos ni saldos. Identidad exacta del APK y demás pruebas físicas siguen pendientes.

## Retiro ficticio físico a Honduras — 26 de noviembre de 2026

Captura Samsung: «Orden creada». Consulta de solo lectura por identificador de la orden confirma destino HN, importe 1000 centavos MWD, estado pending, creación 11:34:46 UTC, expiración exactamente 24 horas después, titular esperado y una sola fila por referencia. Saldo permanece 990300 centavos MWD, coherente con una orden de retiro exclusivamente simulada sin débito. Creación física y persistencia aprobadas; listado y cancelación física pendientes. No registrar código de retiro en documentación. No se modificaron datos, saldos ni configuración de Supabase.

## Historial físico de retiro — 26 de noviembre de 2026

Captura Samsung 06:35 EST: listado de retiros muestra Honduras, 10.00 MWD ficticios, estado pending y creación 06:34:46 EST del 26/11/2026, coincidentes con la consulta SQL anterior. Listado físico aprobado para esta orden. Hallazgo de interfaz: el estado pending aparece en inglés dentro de una pantalla en español; traducir etiquetas de estado sin modificar los valores internos en una revisión posterior. Pendiente cancelación física de esta orden, sin crear otra. No se modificaron saldos ni datos de Supabase.

## Cancelación física de retiro — 26 de noviembre de 2026

Captura Samsung 06:37 EST: «Orden cancelada correctamente», estado cancelled. Consulta independiente de solo lectura confirma la misma orden HN de 1000 centavos, titular correcto, una fila por referencia, estado cancelled persistido y saldo sin cambios de 990300 centavos MWD. Creación, listado y cancelación físicos aprobados para el flujo normal simulado. Pendiente traducir pending/cancelled/expired al español sin modificar estados internos. No se cambió Supabase ni main. La identidad exacta del APK, recuperación por correo, conversión inversa y reintento físico de red siguen sujetos a evidencia independiente.

## Conversión inversa física — 26 de noviembre de 2026

Capturas Samsung 06:38–06:40 EST: origen DIGITAL, cotización de 10 DIGITAL, bruto 80 COIN, comisión 0.2 COIN (0.25%), neto 79.8 COIN. Mensaje «Operación registrada correctamente». Saldos COIN 282.500000 → 362.300000; DIGITAL 977.119684 → 967.119684. Consulta independiente de solo lectura confirma cotización de 11:39:50 UTC ejecutada una vez, importes 10000000/79800000/200000 micro-unidades, cuatro asientos, cero activos descuadrados y ambos saldos coincidentes. Conversión inversa normal física aprobada. Identidad exacta del APK, recuperación por correo y reintento de red físico siguen pendientes. No se cambió Supabase ni main.

## Pérdida de conexión física — 26 de noviembre de 2026

Captura Samsung 06:42 EST: modo avión activo, actualización manual de saldo e historial devuelve diálogo Sincronización / TypeError: Network request failed. La pantalla permanece abierta y muestra que no pudo actualizar. Detección de error de red en lectura aprobada visualmente; pendiente comprobar recuperación al restaurar conexión y verificar reintento de operación con la misma referencia. Hallazgo UX: localizar mensaje de red en español sin ocultar otros errores ni presentar datos antiguos como actualizados. No se hicieron operaciones financieras ni cambios de código o base de datos en esta revisión.

## Recuperación física de conexión — 26 de noviembre de 2026

Captura Samsung 06:43 EST: modo avión desactivado, conexión 5G y mensaje «Saldo e historial actualizados correctamente» tras actualización manual. Recuperación visual de lectura aprobada. La captura no muestra el valor del saldo; no se certifica conciliación nueva por esta evidencia sola. Pendiente prueba física de una operación interrumpida con la misma referencia, recuperación por correo e identificación exacta del APK. No se cambió código de aplicación, main ni datos de Supabase.

## Recuperación física de aportación interrumpida — 26 de noviembre de 2026

Control previo: aportación normal de 1 MWD registrada a las 11:44:36 UTC, saldo 990200 centavos. Captura 06:45 EST con modo avión y aviso «Operación no confirmada… La referencia queda guardada». Consulta de solo lectura posterior al fallo: saldo 990200, cero operaciones posteriores al control. Captura 06:46 EST con 5G y mensaje «Operación ficticia confirmada» tras las instrucciones de reintentar la operación pendiente. Consulta independiente confirma exactamente una nueva aportación por 100 centavos a las 11:46:37 UTC, una fila por referencia, transacción posted, dos asientos (débito y crédito de 100 cada uno), saldo 990100 centavos, sin duplicación observada. Flujo físico de recuperación tras fallo previo al registro aprobado; no demuestra pérdida de respuesta después de commit ni permite comparar la referencia local exacta, no visible en las capturas. Pendiente recuperación de contraseña por correo e identificación exacta del APK; se mantienen hallazgos de interfaz y auditoría heredada. No se modificaron datos de Supabase ni main.


## Recuperación real por correo en Samsung — 26 de noviembre de 2026, 08:50–08:58 EST

- El usuario agregó una segunda Redirect URL en el dashboard de Supabase siguiendo la instrucción para el esquema LAB exacto; la captura confirma dos entradas y conserva la anterior, pero no muestra completa la segunda. No se cambió Site URL por el asistente.
- Capturas físicas: respuesta genérica de solicitud, formulario de nueva contraseña abierto en Moneda Mundial desde el flujo de correo, regreso a la billetera y listado de movimientos previos. Flujo principal de recuperación y retorno a cuenta aprobados visualmente. No se guardan correos, enlaces, tokens, contraseñas ni identificadores de cuenta en este documento.
- Consulta SQL de solo lectura: saldo de la cuenta observada 1,008,400 centavos MWD, coincide exactamente con 10,084.00 MWD en pantalla; 17 operaciones en su historial. Metadatos de Auth muestran actividad de acceso a las 08:55:58 y actualización a las 08:57:36 EST. Estos datos no acreditan un nuevo inicio de sesión manual después del cambio ni revelan el método de acceso. Pendiente comprobar acceso con contraseña nueva tras cierre explícito, rechazo de contraseña anterior, enlace consumido/vencido y comportamiento de app abierta/cerrada.
- Auditoría global puntual mediante COUNT exacto: cinco billeteras, 31 operaciones y 31 filas en ledger_balance_check; cero saldos negativos, importes no positivos, duplicados actor/request o transacciones con débitos/créditos distintos o menos de dos asientos. La estimación del catálogo no se usa como recuento exacto. No demuestra conciliación exhaustiva operación por operación ni integridad bajo toda condición.
- Verificadas restricciones UNIQUE(actor_id, request_id), límite de saldo no negativo y límites de importe; los RPC de transferencia y aportación comprueban auth.uid(), bloquean filas, verifican parámetros de reintento y no permiten EXECUTE a anon. Los seis objetos tabla públicos tienen RLS; lectura de billeteras propia y operaciones por participante. Advisor conserva 30 avisos informativos de RLS sin políticas en tablas privadas, 56 advertencias de RPC SECURITY DEFINER accesibles a authenticated y protección contra contraseñas filtradas deshabilitada. No equivale a 86 vulnerabilidades confirmadas; revisar autorización individual y protección de contraseña antes de producción.
- Pendientes de cierre: identidad del APK instalado, casos negativos Auth, recuperación física de respuesta perdida después del commit, revisión de avisos y ajustes UX/auditoría heredada. No se cambió main, esquema ni datos de Supabase; exclusivamente DEMO.


## Identificación de la próxima compilación — 26 de noviembre de 2026

- App.js muestra el commit completo en un texto seleccionable; fuera de CI muestra «sin verificar». El workflow LAB reemplaza el marcador por GITHUB_SHA (40 caracteres hexadecimales) y falla si el marcador falta o está duplicado. COMMIT.txt utiliza el mismo SHA. El smoke-test exige encontrarlo en la jerarquía visible del emulador, además de comprobar hash e instalación del APK. No es una atestación criptográfica del APK físico por sí sola.
- Cinco casos de tests/android/build-identity.test.cjs aprobados en un entorno JavaScript con adaptadores de archivos y aserciones; no se confirmó CI real. La versión instalada anterior no cambia hasta una actualización, ni se solicita desinstalar. Pendiente obtener una nueva ejecución aprobada y verificar identidad visible en Samsung con su COMMIT.txt. No se modificó main, Supabase, saldos ni dinero real.


## Cierre de sesión y recuperación — 26 de noviembre de 2026

- Se incorporó bloqueo compartido de autenticación para evitar doble cierre de sesión, captura de errores devueltos y excepciones, mensajes sin detalles internos y salida explícita desde la pantalla de recuperación. Se conserva el evento de Supabase como fuente del estado de sesión; no se borran referencias pendientes de operaciones.
- Seis escenarios aprobados al ejecutar la lógica real de App.js con dobles de autenticación y aserciones: doble toque, error devuelto, excepción, cambio de cuenta durante error, ausencia de cuenta y botones protegidos. Prueba guardada en tests/android/logout.test.cjs. No equivale a ejecución nativa de Node ni a validación física.
- Cambios en rama de desarrollo exclusivamente. Pendientes: verificar CI, compilación y prueba física de cierre/reingreso con nueva contraseña, sin solicitar contraseñas ni tokens en el chat. No se modificaron Supabase, saldos ni main.


## Aislamiento visual durante cambio de cuenta — 26 de noviembre de 2026

- App.js incorpora preparedUserId y una barrera de render que oculta pantallas privadas hasta limpiar billetera, historial, roles, conversión, retiros, campos y referencias de la cuenta anterior. La referencia de cotización también se invalida al renderizar una cuenta no preparada. No se borran referencias persistentes en AsyncStorage.
- Siete pruebas de lógica y estructura aprobadas con adaptadores JavaScript: transición A/B, inicio, cuenta preparada, cierre, carga, orden de limpieza e invalidación de cotización. Guardadas en tests/android/account-privacy.test.cjs. No son pruebas de render React Native físico ni de todas las carreras A/B/A o revocación de sesiones. Pendiente CI y APK de esta revisión. No se modificaron main, Supabase ni saldos.


## Exclusión mutua de recuperación de retiros — 26 de noviembre de 2026

- La recuperación local de retiro adquiere el mismo bloqueo que la creación antes de leer AsyncStorage y lo libera en finally para la cuenta vigente. Evita lectura y creación concurrentes durante ese intervalo. El cambio de cuenta limpia también importe y dirección de conversión.
- Cuatro casos de tests/android/pickup-recovery-lock.test.cjs aprobados mediante adaptadores JavaScript: lectura pendiente bloquea creación y otra recuperación, lectura fallida y vacía liberan el bloqueo, cambio de cuenta limpia campos. No certifica carreras A/B/A, render físico ni CI nativo.
- PR 132 conserva evidencia de una compilación anterior (run 45809213055); no certifica el código nuevo. La consulta de workflows por commit no devuelve los runs por push. Consultar Actions del branch para confirmar el APK actualizado. No fusionar main, ni modificar Supabase o saldos. Solo DEMO.


## Validación PostgreSQL de cierre integral — 26 de noviembre de 2026

- PR [133](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/pull/133), revisión de desarrollo `fc5caa753f6c03f9afd47257a45dec54f4daf698`, rama de validación `852c8b21af501212f0153321ac7d4f0b087d793d`, con dos archivos de configuración CI como únicas diferencias respecto a esa revisión.
- [Run 45840521789](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45840521789), job 139980627020, conclusión success: reconstrucción del esquema PostgreSQL 17 desechable, tres controles funcionales transaccionales, cuatro escenarios concurrentes con contención observada (transferencia, aportación, conversión y retiro simulado), 14 controles contables y de seguridad posteriores, y ensayo de auditoría V2 con control negativo de cuenta de débito incorrecta y restauración de la línea base.
- La nueva auditoría V2 pasó en el entorno desechable; no se ha desplegado en el proyecto compartido. Auth es un doble SQL, no una prueba de correo real. La base de pruebas se eliminó por el flujo de CI. No se modificaron Supabase compartido, saldos ni main.
- [Android LAB 45840521938](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45840521938): instalación de dependencias, pruebas Android, auditoría previa, compatibilidad Expo, esquema LAB y prebuild aprobados; compilación Gradle en curso en la última consulta. No declarar nuevo APK aprobado hasta comprobar artefacto, emulador y aceptación física.
