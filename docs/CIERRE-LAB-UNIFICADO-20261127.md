# Acta de cierre técnico parcial — LAB unificado, 27 noviembre 2026

Estado: candidata de laboratorio congelada, aceptación física y proveedor oficial pendientes. No constituye aprobación comercial, legal, de custodia o de producción. No fusionar ni activar fondos reales.

## Referencia única de entrega

- Revisión exacta del APK: `1c33a3e3560bbfa6a28caa980a7bc4f0886bf08d`.
- [Compilación, firma de desarrollo y emulador API 35 — 46086203951](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/46086203951): tres jobs success.
- [Descarga verificada — artefacto 15239726329](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/46086203951/artifacts/15239726329). Caducidad 2026-12-05 00:15:44 UTC (4 dic 19:15 ET). No usar el artefacto intermedio INTERNAL-NOT-VALIDATED.
- SHA-256 ZIP: `e1a94859f0c4e5ed580251abeb5c19584ac07027dea3bdc0c8c5b3fc20d57c0a`. SHA-256 APK, según manifiesto y verificación registrada en #137: `0a9a54f94dc8ee1456ccff56ce88e4c1c9f3892e26b6c6ef34508722d700ab4f`.
- Paquete independiente `com.monedamundial.unifiedlab`. Firma de desarrollo; no publicar en tienda.
- [Regresiones de la revisión exacta — 46087672335](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/46087672335): 137 Android/Auth SDK y 387 Node financieros, 524/524 sin fallos, cancelaciones ni omisiones. Excluye el gate de frontera Android del lockfile anterior independiente. No sumar 14 pruebas preflight a ese total.
- [PostgreSQL de revisión financiera a0ebee9 — 46085007552](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/46085007552): aprobado; 54 SQL idénticos por blob y job postgres-lab idéntico. Es evidencia histórica, no ejecución de PostgreSQL en nueva revisión.
- Auditoría npm de dependencias de producción: cero hallazgos reportados en CI de construcción; no garantía absoluta de seguridad.
- [Registro financiero y evidencias](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/pull/137); [aceptación LAB independiente](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/pull/139); [aceptación DEMO independiente](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/pull/135).

## Puertas de aceptación física (una sesión, sin repetir movimientos aprobados)

| Caso | Acción | Resultado requerido | Estado |
|---|---|---|---|
| U1 | Instalar APK verificado sin desinstalar anteriores; abrir | Selector con aviso sin dinero real | Pendiente |
| U2 | Entrar en DEMO con cuenta sintética | Identidad de revisión visible y acceso correcto | Pendiente |
| U3 | Cancelar cotización pendiente y salir de pantalla | Respuesta tardía no restaura la cotización | Pendiente |
| U4 | Forzar detención desde ajustes Android, reabrir y elegir LAB financiero | Selector reaparece; cuenta y servidor de LAB separados de DEMO | Pendiente |
| U5 | Consultar remesa y billetera propias con cuenta de prueba; cerrar sesión | Sin datos de la cuenta anterior en pantalla | Pendiente |

No introducir dinero, credenciales en el chat o datos personales en evidencias. La recuperación por correo del paquete unificado está deshabilitada deliberadamente; usar la DEMO independiente para el caso negativo PKCE, sujeto a configuración autorizada. La pérdida física de respuesta tras commit requiere un escenario controlado sintético y reconciliación de la misma referencia; no intentar provocar duplicados en producción. Las pruebas automatizadas de estos flujos ya pasaron; no equivalen a aceptación física.

## Puertas externas que impiden cierre total

- Thunes: formulario comercial recibido según registro previo, respuesta/acceso oficial pendientes. Validar elegibilidad, corredor USD/HNL, pagadores, contrato de pruebas, autenticación y conciliación oficial antes de implementar o habilitar transporte. No reenviar consulta duplicada.
- Seguridad de lanzamiento: advertencia de contraseñas filtradas en Supabase Free, revisar protección y costes con autorización. El entorno alojado continúa con barreras sandbox y sin despacho ni fondos reales; no confundir snapshots con saldo vivo.
- Digital/Coin reales: custodia, red, emisión, reservas y reglas de precio definitivas no autorizadas; no crear tokens comerciales ni mezclar fondos.
- Lanzamiento: decisiones del titular y revisión regulatoria/contable/seguridad, aceptación y autorización explícitas. No cambiar main ni producción.

## Regla de congelación

No generar otra compilación ni repetir auditorías para sustituir dependencias externas. Si se reproduce un defecto, registrar caso, revisión, impacto, corregir únicamente en rama de desarrollo y validar los cambios. Si caduca el enlace, recuperar copia íntegra verificada existente antes de decidir una nueva compilación. Esta acta es documental y no cambia la revisión del APK.

## Actualización de la candidata reforzada — 28 noviembre 2026

La revisión de entrega vigente es `ec1477daf5e7afc7919a38892180c59322b77ef0`, no la revisión inicial de esta acta. [Comparación con la candidata anterior](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/compare/1c33a3e3560bbfa6a28caa980a7bc4f0886bf08d...ec1477daf5e7afc7919a38892180c59322b77ef0): siete commits; cambios limitados a workflows, esta acta, configuración de staging y su test. No cambió el código de negocio ni el lockfile en esa comparación.

- [CI APK reforzada 46088465052](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/46088465052): preflight, apk y smoke success. Log de preflight: 14/14 pruebas. Manifiesto binario: backup deshabilitado, permisos overlay y almacenamiento legado ausentes, INTERNET conservado; firma v2 verificada; arquitecturas x86_64 y arm64-v8a; emulador API 35 abre ambos entornos y recupera selector tras detención. No equivale a certificación de seguridad integral.
- [Artefacto verificado 15239803884](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/46088465052/artifacts/15239803884), 25,384,374 bytes ZIP, SHA-256 ZIP `30e4e0ebb772e139c3ad727462555f9b7898bda699234bcc57784d981aa56e4f` según metadatos de GitHub; vence 2026-12-05 00:43:58 UTC. No usar el artefacto intermedio. No se ha comprobado aquí el digest de los bytes descargados ni el hash instalado.
- Evidencia visual Samsung del 28 noviembre: captura 9:17 muestra selector de los dos modos y aviso sin dinero real; captura 9:22 muestra entrada DEMO e identificador completo ec1477daf5e7afc7919a38892180c59322b77ef0 coincidente. U1 observado; de U2, entrada y compilación visible observadas, autenticación en esta revisión no acreditada por estas capturas. No conservar imágenes, datos personales ni credenciales en repositorio. Los recorridos ordinarios previamente aprobados no se solicitan de nuevo sin necesidad.
- [Regresión exacta de candidata reforzada 46154437285](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/46154437285) iniciada con commit de CI `c423bd1e0c0bbba1b1de7fa355eaa03ab09fdb2f`, checkout fijado a ec1477d. Resultado verificado en job 141007850307: success; Android/Auth SDK 137/137 y financiero Node 387/387, total 524/524, cero fallos, cancelaciones, omisiones o TODO en los conjuntos ejecutados. No sumar la ejecución histórica ni las 14 pruebas preflight. No genera otra APK. Excluye el gate de frontera que fija el lockfile anterior independiente, como en la ejecución de referencia.
- El propietario solicita una etapa exclusivamente técnica y reserva toda intervención física para más adelante; no repetir U1 ni la identificación visible. Mantener congelada esta APK mientras no exista defecto concreto. Pendientes externos Thunes, producción y decisiones de activos permanecen sin cambios; no activar ni fusionar a main.

- [Frontera Android/financiera 46154517224](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/46154517224), commit `10fd762dde099a174d528c455d84760a6653dfbb`, job 141008096244: lock SHA256 OK, 2/2 pruebas de inventario e integridad de archivos aprobadas, cero fallos/omisiones. Actualización deliberada de las dos huellas de dependencias a la candidata ec1477d; los demás archivos raíz y artefactos alojados conservan las huellas anteriores verificadas en el árbol. Son dos pruebas independientes adicionales al conjunto de 524, no una nueva APK. La candidata instalada permanece congelada.
