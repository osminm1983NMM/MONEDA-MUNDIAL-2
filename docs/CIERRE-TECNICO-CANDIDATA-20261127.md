# Cierre técnico de candidata LAB — 27 noviembre 2026

## Evidencia verificada

| Área | Revisión y evidencia | Resultado |
|---|---|---|
| Android | a24b14cd075ff792ee06b0fb7a77acafc1e06f53, [CI 45989217202](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45989217202) | 136 pruebas Android, 27 regresiones, Gradle, firma e instalación/apertura Android 35 aprobadas |
| Integración financiera | de968fd68d19bb364a4644137871a13a4ee8778a, [CI 46011498636](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/46011498636) | 306/306 pruebas Node, cero fallos, cancelaciones, omisiones o todo; PostgreSQL success. Evidencia solo LAB |
| Rama principal | 3f2fbdb7ffb5d6c75b8c56d41b4d1fa98ef64ffc | Sin modificaciones en la integración |

## Entrega Android

[Artefacto 15193786859](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45989217202/artifacts/15193786859), vencimiento 4 diciembre 2026 11:27:57 UTC. Archivo ZIP 16,324,004 bytes, SHA256 7859c9dbb1cf0a09843e9f232b20d027fb59f301565cd5f27debf08406552f3d. Verificado localmente contra el digest de GitHub. APK extraído sin alterar, 34,857,720 bytes, SHA256 55c2b1922434843dd1501675f0bfa4961fb96b57069268209cf5b210a120b63b, coincide con SHA256.txt. COMMIT.txt coincide con a24b14cd075ff792ee06b0fb7a77acafc1e06f53; manifiestos package-lock.json y TOOLCHAIN.txt coinciden con sus bytes. Certificado DER extraído del bloque de firma v2: SHA256 fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c, idéntico al certificado documentado de la revisión anterior. La comparación DER no sustituye la verificación criptográfica completa de apksigner realizada en CI. No acredita certificado o hash instalado físicamente.

## Aceptación física focalizada (parcial; conservar evidencia posterior)

1. Actualizar la app LAB sin desinstalar ni borrar datos; ante rechazo, conservar la instalación y registrar mensaje.
2. Abrir y confirmar identificador completo de compilación a24b14cd075ff792ee06b0fb7a77acafc1e06f53. Verificar sesión y saldo visible sin mostrar datos personales innecesarios.
3. Actualizar saldo/historial; repetir con modo avión, verificar que el estado de carga termina y avisa del fallo; volver a conectar y comprobar actualización correcta. No iniciar operaciones monetarias.
4. Abrir cotización internacional, calcular una simulación, salir o cambiar de pantalla durante consulta y comprobar que no se restaura resultado obsoleto. No confirmar pago.
5. Cerrar sesión, abrir nuevamente, confirmar ausencia de datos de sesión previa, iniciar con contraseña vigente sin compartirla. Los casos negativos de recuperación por enlace consumido/vencido y pérdida de respuesta tras commit se mantienen separados y pendientes si no existe evidencia física.
6. Registrar resultado observado, commit y tipo de evidencia. No repetir transferencias normales, aportaciones, retiros o conversiones ya conciliados salvo regresión justificada.

## Separación de entregables

- **DEMO Android:** candidata automática aprobada; aceptación física de esta revisión pendiente.
- **Infraestructura financiera aislada:** validada por CI y PostgreSQL desechable; proyecciones, seguridad, conciliación, recuperación, simuladores y contratos internos no prueban integración externa ni servicio móvil conectado. La APK no incorpora la infraestructura financiera sandbox.
- **Sandbox oficial:** pendiente acceso autorizado, contrato y corredor USD/HNL, Auth y DB aislados, pruebas con proveedor, liquidación, consumidor, credenciales de mínimo privilegio y validación nativa.
- **Digital/Coin:** laboratorios validados, pendiente diseño legal/contable autorizado, custodia, reservas, mercado y política de emisión. Ningún crédito ficticio se convierte automáticamente en dinero real.
- **Producción:** pendiente requisitos regulatorios, contratos, revisión de seguridad y contabilidad independientes y autorización explícita. No activar fondos, no fusionar PR 137 a main, no desplegar infraestructura.

## Regla de continuidad

Congelar la candidata para aceptación física y evitar nuevas compilaciones o cambios marginales sin defecto reproducido o requisito concreto. La instalación, Inicio, identidad visible y recuperación de actualización ya cuentan con evidencia física posterior; reservar únicamente los casos restantes para la etapa conjunta. Según el registro de incorporación docs/THUNES-ONBOARDING-GATES-20261126.md, el formulario comercial a Thunes fue recibido el 27 de noviembre; no reenviar. Pendientes respuesta escrita, elegibilidad y acceso oficial; no hay contrato ni activación acreditados. Consultar también docs/DIGITAL-ASSETS-ARCHITECTURE.md y docs/REMITTANCE-CONSUMER-PROTECTION-GATES.md. Este documento no certifica preparación para dinero real.

## Evidencia física inicial — 27 noviembre 2026

Captura aportada por el propietario desde Samsung a las 6:38 (hora visible, sin inferir zona ni metadatos): Inicio abierto, versión 2.0, identificador visible completo `a24b14cd075ff792ee06b0fb7a77acafc1e06f53` coincidente con la candidata aprobada en CI, sesión activa, saldo ficticio 9,911.00 MWD igual al previamente documentado, aviso SOLO DEMOSTRACIÓN / SIN DINERO REAL visible. Contenido inicial dentro de las barras de sistema. Aprobada evidencia visual de apertura, identidad de compilación y saldo/sesión visibles tras la actualización; la captura no demuestra el hash instalado ni una consulta nueva de servidor. No conservar correo, código de cuenta ni imagen en el repositorio. Siguiente paso: actualización manual de saldo e historial con conexión activa; después prueba de desconexión y recuperación. No repetir movimientos ya conciliados. Sin cambios de código, datos, producción ni main.

### Actualización manual y desplazamiento — Samsung, 27 noviembre 2026

Captura de seguimiento a las 6:39 (hora visible): conexión 5G indicada, botón Actualizar saldo e historial habilitado, mensaje «Saldo e historial actualizados correctamente», botones Administración y Cerrar sesión visibles y pie de pantalla alcanzado sin superposición aparente con la barra de navegación. Aprobada la evidencia visual de actualización manual y desplazamiento inferior. No es verificación independiente de importes en el servidor ni de todos los flujos de navegación. Siguiente prueba: pérdida de conexión y recuperación del mismo botón, sin realizar movimientos monetarios. No se modifican código, datos ni producción.

### Pérdida de conexión — Samsung, 27 noviembre 2026

Captura a las 6:39 (hora visible), indicador de modo avión activo. Tras la actualización manual aparece diálogo Sincronización: no hay conexión con el servidor, revisar Internet y volver a pulsar Actualizar saldo e historial, con advertencia explícita de datos potencialmente desactualizados. Aprobada evidencia visual de detección de fallo de red y mensaje localizado, sin cierre inesperado de aplicación observado. No se acredita duración exacta de la espera, transporte no cooperativo ni rehabilitación del botón hasta cerrar diálogo y reintentar. Próximo paso: pulsar OK, desactivar modo avión, recuperar conexión y actualizar saldo e historial. No se solicitan operaciones monetarias. Sin modificaciones de código, datos o producción.

### Recuperación de conexión — Samsung, 27 noviembre 2026

Captura de seguimiento a las 6:40 (hora visible): indicador 5G activo, botón Actualizar saldo e historial habilitado y mensaje «Saldo e historial actualizados correctamente». Aprobada evidencia visual de recuperación de la actualización tras la prueba de modo avión inmediatamente anterior, sin reinicio reportado. No acredita por sí sola importes consultados ni recuperación de operaciones monetarias en vuelo. Siguiente prueba: cotización internacional DEMO a Honduras, sin enviar ni confirmar fondos. Sin cambios de código, datos o producción.


## Consolidación del laboratorio y plan de cierre — 27 noviembre 2026

La decisión posterior del titular es terminar primero el desarrollo técnico y reservar pruebas físicas restantes para una etapa conjunta. Esto sustituye las indicaciones anteriores de probar una cotización normal o instalar inmediatamente otra APK. No repetir pruebas de transferencias, conversiones y otros recorridos ordinarios ya registrados salvo defecto reproducido o cambio que afecte el recorrido. Mantener las pruebas automáticas de cada cambio.

### Evidencia acumulada por revisión (no sumar ejecuciones duplicadas)

| Revisión funcional | Alcance adicional | Evidencia de CI |
| --- | --- | --- |
| 7f573de2bfbe368e59f5171c375c406579bf7a11 | Cancelación TCP y servicio de estado | [push 45992800966](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45992800966), [PR 45992808393](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45992808393): ambos jobs success |
| 417e8f2b8dc814a25b1d4ebabadaae65910c131d | Integridad de metadatos Digital/Coin | [push 45992936570](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45992936570), [PR 45992944730](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45992944730): ambos jobs success |
| d8e26636174b9aa92ed537d4c99e9aa74728ad61 | Respaldo de conciliación | [push 45993278084](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45993278084), [PR 45993287415](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45993287415): ambos jobs success |
| 12ef69187c2b32b5f337659df2e848c831cbb00f | Aislamiento de selección móvil | [push 45993566553](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45993566553), [PR 45993573815](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45993573815): ambos jobs success |
| c3d1fa71e26d0cda7e3f70902b5f36dfd44e5f65 | Entrega, seguimiento y contabilidad PostgreSQL | [push 45993708328](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45993708328), [PR 45993717818](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45993717818): ambos jobs success |
| cda0f5ba464fe9cd5612e37d3dc3579888014d1f | Recuperación verificable USD/HNL | [push 45993883197](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45993883197), [PR 45993889033](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45993889033): ambos jobs success |
| 19d9081b42b80c9154dc31ecd997aa143cbe8ce9 | Devolución, replay y seguimiento | [push 45994000366](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45994000366), [PR 45994009998](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45994009998): ambos jobs success |
| 453b2287e7757b405f89415ee61ceec4dfe0ad5d | Eventos firmados sintéticos integrados | [push 45994170425](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45994170425), [PR 45994179284](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45994179284): sandbox success en ambos; PostgreSQL en curso al registrar. Log job 140489260701: 287 tests, 287 pass, 0 fail, 0 cancelled, 0 skipped, 0 todo |

### Próximas puertas, en orden de utilidad

1. CI de la revisión financiera de968fd confirmada: ambos jobs success y 306/306 pruebas Node; cerrar esta puerta LAB, corregir únicamente fallos concretos. No presentar una prueba escrita como prueba aprobada.
2. Preparar integración real únicamente contra contrato autorizado: configuración privada de servidor, Auth y base aislados, roles mínimos, TLS, límites de consulta, protección de secretos, monitoreo, manejo de incidentes y recuperación independiente. El transporte loopback y las respuestas Auth ficticias no son un despliegue. No usar producción como sandbox.
3. Obtener respuesta escrita al borrador de incorporación de proveedor; confirmar corredor, métodos y responsabilidades. No elegir identidad contractual, pagador, tarifas ni endpoint activo por inferencia. Documento THUNES-ONBOARDING-GATES-20261126.md.
4. Definir con asesoría y titular las reglas de emisión/redención, reserva, custodia, liquidez, precisión, red y precio de Digital/Coin. El ledger SQLite no es motor de activos productivo ni modelo legal aprobado. Documento DIGITAL-ASSETS-ARCHITECTURE.md.
5. Tras contar con entorno autorizado, implementar adaptadores reales y unir interfaz nativa a servicios aprobados en una rama de desarrollo revisada. No mezclar saldo MWD ficticio con fondos reales. PR 137 sigue borrador y no se fusiona.
6. Etapa física conjunta: pendientes específicos de cancelación de cotización durante consulta, aislamiento de sesión, casos negativos de recuperación y pérdida de respuesta tras commit cuando proceda. No repetir apertura, identidad visible, actualización, fallo de red y recuperación ya observados para candidata a24b14c. No afirmar aceptación física de cambios que no están en esa APK.
7. Diseño visual definitivo, aceptación de seguridad y contabilidad independientes, requisitos regulatorios y autorización explícita antes de lanzamiento.

Rama principal comprobada sin cambio: 3f2fbdb7ffb5d6c75b8c56d41b4d1fa98ef64ffc. Base Android de PR 137: a24b14cd075ff792ee06b0fb7a77acafc1e06f53, borrador mergeable en la revisión observada. Ninguna nueva APK, credencial, contacto con proveedor, aprobación, despliegue o movimiento de dinero se deriva de este registro. No mantener ciclos indefinidos de mejoras marginales a fixtures como sustituto de las dependencias de integración oficial.


## Cierre de consultas financieras aisladas — revisión 5f297387

- [CI push 45995409215](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45995409215) y [CI PR 45995424616](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45995424616): jobs sandbox y postgres-lab completados con success para `5f297387ca057a3afca40fba649d6f1f9aec045b`. Log Node del job 140493504569: 299 pruebas, 299 aprobadas, 0 fallos, cancelaciones, omisiones o todo. No sumar las ejecuciones duplicadas.
- Verificadas las cuatro regresiones de cancelación: evitar búsqueda de vínculo después de Auth cancelado, propagar cancelación a registro, no comenzar transacción tras adquisición tardía y rollback antes de consulta de estado. No implica cancelación física de una operación que el driver ya inició.
- La composición de servidor local y la consulta PostgreSQL restringida tienen evidencia de laboratorio. El servicio oficial autenticado y el transporte TLS remoto siguen sin desplegar. No usar la rama Supabase principal como laboratorio financiero ni crear recursos con costo sin autorización. La verificación física restante se conserva para la etapa conjunta; no regenerar APK por este cambio aislado.


## Evidencia de conexión directa restringida — 27 noviembre

Revisión `710501bb5c39a4cf44193462f2561be66a101c11`: [CI push 45995883034](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45995883034) y [CI PR 45995891996](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45995891996) completadas con success en ambos jobs. El log PostgreSQL del job 140495062832 confirma acceso directo por socket local con session_user=current_user=mwd_lab_status_service, funciones autorizadas, rechazo de acceso a tablas, escritura, roles ajenos y tablas temporales, retorno a NOLOGIN y restauración independiente posterior. La prueba utiliza exclusivamente la autenticación local del clúster desechable; no prueba contraseña, TLS, pool remoto ni identidad de Supabase Auth real. No cambia código de la APK, main, permisos de Supabase ni dinero real.

El cierre de este requisito de laboratorio no sustituye la respuesta escrita y el acceso autorizado del proveedor ni la provisión de un entorno de integración separado. No crear ramas o proyectos facturables, activar endpoints ni repetir pruebas sintéticas aprobadas como sustituto de estas dependencias.


## Punto de control vigente — revisión 1a4ab9b, 27 noviembre

[CI 46009942094](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/46009942094): verificados directamente los jobs sandbox y postgres-lab completados con success y el resumen del log 140542578569 (304 tests, 304 pass, 0 fail, 0 cancelled, 0 skipped, 0 todo). La revisión incorpora captura única de datos de eventos Digital/Coin y rechaza accesores, campos ocultos y transiciones malformadas antes de persistencia. No acredita identidad, cotización, custodia ni liquidación externa. El artefacto Android 15193786859 sigue no expirado según listado de GitHub; vence 4 diciembre 11:27:57 UTC. Conservar candidata y evidencia física previa. No iniciar nuevas simulaciones ni compilaciones sin defecto concreto; quedan acceso oficial del proveedor, entorno aislado autorizado y aceptación física conjunta. Estado de recepción de la solicitud del proveedor no verificado mediante correo en esta revisión. Sin cambio de código funcional, producción ni fondos.


## Puerta de conexión móvil y proveedor — estado operativo

Revisión funcional `de968fd68d19bb364a4644137871a13a4ee8778a`, [CI 46011498636](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/46011498636): Node 306/306 y PostgreSQL success. Incluye captura única de evidencia contable y de precio, recuperación y rechazo sin escritura de comprobantes mutables. Las pruebas y componentes `mobile/remittance-status-host.js`, `mobile/remittance-status-panel.js`, `mobile/order-status-expo.js`, `order-status-client.cjs` ya cubren composición de seguimiento de solo lectura en laboratorio; no sustituirlos por otra simulación equivalente. La interfaz no se importa en App.js.

Orden de integración una vez autorizada: (1) verificar identidad y alcance de proveedor, método bancario HNL y acceso de prueba, sin asumir disponibilidad de efectivo; (2) provisionar entorno de Auth y PostgreSQL aislados autorizado, origen HTTPS y credenciales de servidor de alcance mínimo, no incorporar secretos al cliente; (3) enlazar únicamente la consulta de estado existente POST `/v1/sandbox/remittances/status` con actor derivado de sesión verificada y UUID autorizado; (4) integrar el host Expo en rama de desarrollo con estado desactivado por defecto, token de sesión del entorno aislado, selección invalidada en cada cambio de identidad y sin credenciales del proveedor en el móvil; (5) comprobar transporte nativo, aislamiento de usuarios, redirecciones, timeout, cancelación y recuperación con datos sintéticos en el entorno oficial; (6) conectar creación/confirmación y liquidación solo tras contrato de estados, idempotencia, conciliación, financiación y devolución. El seguimiento no autoriza pagos. No publicar un endpoint de loopback ni desplegar SQL LAB directamente. No iniciar compilación, gasto o recurso remoto en esta revisión. La respuesta al formulario se mantiene pendiente según el registro del proyecto; no se accedió al buzón para verificarla. No fusionar main ni habilitar dinero real.


## Candidata Android financiera alojada — verificación CI del 27 de noviembre, revisión ecda775

- Revisión funcional congelada para aceptación: `ecda7753937bd7284d9cc2c6f98a8a5616f5b3b5`. Las ramas dev/hosted-financial-android-20261127 y dev/stage-wallet-lab-20261127 apuntaban a esa misma revisión al comprobarlas. No se fusiona main.
- [CI financiero 46055471781](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/46055471781): jobs sandbox y postgres-lab success. Log 140696772864: 374 tests, 374 pass, 0 fail, 0 cancelled, 0 skipped, 0 todo. Job PostgreSQL 140696773322 confirma restauración desechable y concurrencia posteriores, entre otras puertas. No sumar ejecuciones de revisiones anteriores.
- [CI Android 46055471681](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/46055471681): job 140696772666 success, npm ci, compatibilidad Expo, staging aislado, prebuild y assembleRelease aprobados. Esta ejecución no incluye instalación en emulador ni aceptación física.
- [Artefacto 15227565065](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/46055471681/artifacts/15227565065): ZIP 25,333,831 bytes; digest publicado por GitHub sha256:e7302fd2fc6adac129c9d00d61d0414eaa3898a87804a5cba6aa940b4abcfe97; no expirado al consultar; vence 4 diciembre 2026 19:23:40 UTC. El digest corresponde al ZIP y no fue recalculado localmente en esta revisión; no se ha comprobado la firma instalada.
- El código de la entrada alojada integra seguimiento de remesa y consulta de cartera con una misma sesión de laboratorio, invalida ambos hosts al cerrar sesión, no persiste credenciales de sesión y ofrece diagnóstico de acceso antes/después del cierre. La interfaz no permite depósitos, transferencias ni pagos. El paquete independiente es com.monedamundial.financiallab. Esta APK no sustituye a la candidata DEMO previamente probada. No inferir que la compilación valida el servicio remoto, la revocación efectiva ni los importes.

### Aceptación conjunta pendiente de la candidata alojada

| Caso | Criterio |
|---|---|
| Identidad y aislamiento | Verificar ZIP, SHA256SUMS, revisión, firma y paquete independiente antes de instalar junto a DEMO; conservar los datos de la DEMO. |
| Auth y remesa propia | Con cuenta de prueba autorizada, comprobar consulta propia y ausencia de acceso a referencia de otra cuenta, sin compartir tokens ni datos personales. |
| Cartera | Contrastar saldo y captura sintética con fixture autorizado; comprobar separación de identidades y ausencia de datos de cuenta anterior. |
| Red y sesión | Probar pérdida de red, cancelación, recuperación, cierre y reapertura; no mostrar resultados obsoletos. |
| Revocación | Comprobar acceso propio positivo a ambos recursos y rechazo posterior verificable; diferenciar error de red o prueba inconclusa de denegación autorizativa. |
| No monetario | Confirmar ausencia de acciones de movimiento y mantener separación del proveedor oficial. |

No instalar otra APK ni repetir los recorridos físicos aprobados de la DEMO sin etapa conjunta acordada. El entorno remoto y los casos físicos de esta candidata no fueron probados en esta revisión; el sandbox oficial Thunes, contratos, permisos y activación permanecen pendientes según el registro del proyecto, sin comprobación del buzón. No se generan nuevas compilaciones ni se modifican servicios, fondos o código funcional para este registro de evidencia.


## Invalidación de sesión compartida — revisión 20ad831

- Revisión funcional `20ad831486f0a2a5b8cbf681993433db617118ea`: [CI financiero 46062515161](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/46062515161), job sandbox 140719918162 completado success. Log verificado: 378 tests, 378 pass, 0 fail, 0 cancelled, 0 skipped, 0 todo. Las cuatro nuevas pruebas de pérdida de autorización cruzada, recuperación mediante nueva sesión, fallo de red/orden ausente y captura contable ausente aprobaron; no sumar a los 374 de la revisión anterior.
- Una respuesta AUTH_REQUIRED de remesas o pérdida de acceso a captura de billetera invalida ambos hosts y borra la selección visible. La captura ausente se trata de modo conservador; no constituye prueba de revocación remota. Una falla de red o remesa no encontrada no cierra automáticamente toda la sesión. Evidencia de composición automática de hosts, no de comportamiento nativo observado.
- [CI Android 46062515157](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/46062515157): prebuild y validación de dependencias aprobados, assembleRelease en ejecución al consultar. Job postgres-lab 140719917919 posteriormente verificado con success: exclusión de cortes simultáneos y replay, recuperación del proveedor sintético tras reinicio, acceso restringido PostgreSQL, restauración independiente de registros/roles/permisos/secuencias y concurrencia de límites diarios y eventos multimoneda tras restauración. Evidencia en log del job, exclusivamente clúster desechable; no acredita servicio remoto ni fondos reales. No declarar nueva APK aprobada ni solicitar instalación hasta comprobar el resultado Android y verificar su artefacto. La candidata anterior ecda775 conserva su evidencia independiente.
- main verificado en `3f2fbdb7ffb5d6c75b8c56d41b4d1fa98ef64ffc`. No se modifican datos, infraestructura remota o fondos. No iniciar compilaciones duplicadas mientras estas puertas estén en curso.


### Entrega Android verificada — revisión 20ad831

- [CI Android 46062515157](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/46062515157), job 140719917492: success en dependencias, prebuild, Gradle assembleRelease, colección y publicación. [CI financiero 46062515161](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/46062515161): ambos jobs success, 378/378 pruebas Node y PostgreSQL desechable.
- [Artefacto 15229337418](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/46062515157/artifacts/15229337418): ZIP 25,334,304 bytes, vence 4 diciembre 2026 20:21:48 UTC. Descargado; CRC de todos los miembros correcto y SHA256 recalculado coincide con GitHub: 5217c36a337c7e1a3c1c6307507d07e1ae094aed4493c92a7abd56b82da431f2.
- APK extraída sin modificar, 58,162,572 bytes; SHA256 d88583de93e55b02b4c0df54acbd2fac440330508f15866c0d871417a967a72c coincide con SHA256SUMS. revision.txt coincide con 20ad831486f0a2a5b8cbf681993433db617118ea y metadatos GitHub. Contiene manifiesto Android y DEX.
- Verificación independiente de la firma v2 mediante código local y biblioteca criptográfica: clave pública coincide con certificado DER, firma RSA PKCS#1 v1.5 SHA-256 válida sobre datos firmados, digest de 58 bloques de contenido coincide. Certificado Android Debug SHA256 fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c. No se dispone de apksigner en ese entorno; no equivale a certificación completa de plataforma, firma de distribución ni comprobación en dispositivo.
- Configuración fuente identifica paquete com.monedamundial.financiallab; conservar DEMO Android previa. La aceptación física, acceso real a las consultas de laboratorio alojado y diagnóstico de revocación conjunta siguen pendientes. Congelar revisión funcional, sin otra compilación por documentación. main comprobado en 3f2fbdb7ffb5d6c75b8c56d41b4d1fa98ef64ffc. Sin despliegue, fondos ni cambios funcionales adicionales.
