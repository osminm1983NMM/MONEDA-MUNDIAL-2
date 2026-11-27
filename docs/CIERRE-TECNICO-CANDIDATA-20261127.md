# Cierre técnico de candidata LAB — 27 noviembre 2026

## Evidencia verificada

| Área | Revisión y evidencia | Resultado |
|---|---|---|
| Android | a24b14cd075ff792ee06b0fb7a77acafc1e06f53, [CI 45989217202](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45989217202) | 136 pruebas Android, 27 regresiones, Gradle, firma e instalación/apertura Android 35 aprobadas |
| Integración financiera | b0d3824203453918117f69c8604b9b87031691b8, [push 45991054077](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45991054077) y [PR 45991062264](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45991062264) | 274/274 pruebas Node en cada ejecución, PostgreSQL success en ambas, sin omisiones; no sumar ejecuciones duplicadas |
| Rama principal | 3f2fbdb7ffb5d6c75b8c56d41b4d1fa98ef64ffc | Sin modificaciones en la integración |

## Entrega Android

[Artefacto 15193786859](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45989217202/artifacts/15193786859), vencimiento 4 diciembre 2026 11:27:57 UTC. Archivo ZIP 16,324,004 bytes, SHA256 7859c9dbb1cf0a09843e9f232b20d027fb59f301565cd5f27debf08406552f3d. Verificado localmente contra el digest de GitHub. APK extraído sin alterar, 34,857,720 bytes, SHA256 55c2b1922434843dd1501675f0bfa4961fb96b57069268209cf5b210a120b63b, coincide con SHA256.txt. COMMIT.txt coincide con a24b14cd075ff792ee06b0fb7a77acafc1e06f53; manifiestos package-lock.json y TOOLCHAIN.txt coinciden con sus bytes. Certificado DER extraído del bloque de firma v2: SHA256 fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c, idéntico al certificado documentado de la revisión anterior. La comparación DER no sustituye la verificación criptográfica completa de apksigner realizada en CI. No acredita certificado o hash instalado físicamente.

## Aceptación física focalizada (pendiente)

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

Congelar la candidata para aceptación física y evitar nuevas compilaciones o cambios marginales sin defecto reproducido o requisito concreto. La siguiente intervención del propietario es instalar y enviar captura de Inicio; las demás pruebas físicas se hacen consecutivamente según evidencia. La siguiente dependencia externa, independiente de la prueba física, es la consulta informativa a proveedor autorizado ya preparada en docs/THUNES-ONBOARDING-GATES-20261126.md; no se ha enviado ni firmado nada. Consultar también docs/DIGITAL-ASSETS-ARCHITECTURE.md y docs/REMITTANCE-CONSUMER-PROTECTION-GATES.md. Este documento no certifica preparación para dinero real.

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

1. Verificar conclusión PostgreSQL de la última revisión exacta; corregir únicamente fallos concretos. No presentar una prueba escrita como prueba aprobada.
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
