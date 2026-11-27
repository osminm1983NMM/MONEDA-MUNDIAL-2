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
