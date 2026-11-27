# Moneda Mundial 2.0 — cierre integrado DEMO

## Candidata vigente para aceptación física (26 de noviembre)

**Única APK vigente:** revisión `6d271511aa6dc3b6a7c383ebf82f451be01b225c`, [compilación y smoke-test aprobados](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45887015473). [Descargar artefacto MonedaMundial-LAB-Samsung](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45887015473/artifacts/15149971884), caduca el 3 de diciembre de 2026 a las 19:59:21 UTC (14:59:21 EST). La revisión incorpora la corrección PKCE. Las referencias a e9db291 y ed15a7c y sus hashes/artefactos son históricas; NO instalar esos candidatos para la aceptación final. Verificar la compilación visible `6d271511`, actualizar sin desinstalar ni borrar datos, comprobar acceso, persistencia, salida, recuperación de contraseña en el teléfono (incluido rechazo del enlace usado) y cotizador. No repetir movimientos ya aceptados. No compartir contraseña, token ni enlace de recuperación. Si falla la actualización, conservar la instalación y registrar el mensaje. La aceptación física y autorización explícita de fusión siguen pendientes. Esta corrección documental no modifica el APK ni certifica pruebas físicas. Metadatos y bytes del artefacto verificados independientemente el 26 de noviembre: ZIP SHA256 `ac52ed67b3987fa4e014b3bed67f26915f61f44076f6a87ff7436749897020d6` (16,322,589 bytes); APK original SHA256 `7b12f1d950c4156b4f2cc23ab2045e704610d8f26cec2ad61798bfa258cb0e09` (34,855,640 bytes), coincide con SHA256.txt. COMMIT.txt coincide con la revisión vigente. Lockfile y TOOLCHAIN.txt coinciden con DEPENDENCIES-SHA256.txt; lockfile `37b19f7d4ae9eddaaa18cbe1a1c2277dce212bcab46df0e6ba325cbdef31159e`. Certificado DER v2 extraído del APK: `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`, igual al de candidatas LAB previas; firma de desarrollo. La extracción de certificado no sustituye la verificación criptográfica de firma aprobada en CI ni prueba el certificado instalado en Samsung. Se entregó APK extraído sin modificar, además del enlace ZIP original.

Fecha de corte: 26 de noviembre de 2026. Alcance: Android LAB, créditos ficticios; no distribución pública ni dinero real.

## Evidencia aceptada (no repetir sin impacto)
| Área | Evidencia |
| --- | --- |
| Transferencia personal, saldo, historial y cambio de cuenta | Samsung 62cd2a5, transferencia 10 MWD y conciliación del servidor sin diferencias. |
| Aportación, conversiones bidireccionales y retiro ficticio | Flujos físicos previos; controles de servidor y recuperación automatizados. |
| Contabilidad DEMO | 32 operaciones, 64 asientos, cinco billeteras y 20 conversiones; controles de lectura aprobados. |
| PostgreSQL aislado | CI 45854220970: cinco escenarios concurrentes, contabilidad comercial, auditoría V2 con control negativo, inventario exacto de 56 RPC privilegiadas y permisos. |
| Interfaz Samsung | APK 46adc7b, CI 45853329867 y captura física del 26 nov: áreas seguras corregidas, sesión y saldo visibles conservados. |
| Sesiones cifradas | Código e9db2912eb7bf4fa64e2eba6f604a3d176975bd6; CI estático 45857215847 aprobado. CI Android 45857215779 aprobó pruebas Node, Expo, prebuild y recuperación LAB; Gradle en curso al corte. |
 
## Únicos bloqueos de esta entrega
1. **Completado en CI y verificado por extracción independiente:** APK vigente 6d271511, smoke-test, procedencia, certificado y manifiestos. Lockfile versionado. No reconstruir por rutina ni instalar candidatas históricas.
2. Validación física agrupada, únicamente por el cambio de almacenamiento: actualizar sin desinstalar; nuevo acceso con cuenta existente; cerrar y reabrir para confirmar persistencia; cerrar sesión y comprobar ausencia de sesión antigua; recuperación de contraseña PKCE con correo accesible, usando enlace válido en el mismo teléfono y rechazo de enlace reutilizado. No solicitar contraseña, token ni enlace. Si se observa un fallo, corregir ese componente y su regresión. No repetir transferencias, actualización de historial o conversiones por rutina.
3. Revisión final del diff integrado y autorización expresa antes de fusionar main. Mantener un solo candidato activo y las ramas anteriores como historial; no cerrar ni eliminar ramas sin revisar.
4. El fallo físico por pérdida de respuesta *después* del commit no está certificado. No confundir pruebas de concurrencia/recuperación simulada con esa evidencia. Registrar como limitación de DEMO; antes de dinero real, exigir un entorno controlado de prueba de red.
 
## Fuera del cierre de la DEMO
- Interfaz comercial física no aceptada; backend ficticio tiene pruebas de pago, cancelación, concurrencia y contabilidad. No anunciarlo como producto comercial completo.
- Revisión independiente de seguridad, protección de contraseñas filtradas, revisión semántica de RPC privilegiadas, custodia, revocación de sesiones, cumplimiento y gestión de incidentes.
- LLC, licencias o socio regulado, KYC/AML, sanciones, protección al consumidor y reservas/custodia de activos. No activar dinero real, emisión comercial ni conversiones reales por aprobar esta DEMO.
- No desplegar automáticamente auditoría V2 ni cambios de permisos en la base compartida.
 
## Consolidación
Comparación con main 3f2fbdb7ffb5d6c75b8c56d41b4d1fa98ef64ffc: rama de desarrollo adelantada 358 commits y sin commits atrasados al comparar e9db291. Los PR anteriores son evidencias históricas, no entregas independientes que el usuario deba instalar. El PR de consolidación se mantiene borrador; no equivale a autorización de merge.
 
Referencias: [CI Android](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45857215779), [CI estático](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45857215847), [CI PostgreSQL](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45854220970), [Aceptación Android](ANDROID-LAB-ACCEPTANCE.md).

## Complemento funcional integrado — cotizador internacional
El nuevo cotizador de remesas usa exclusivamente las RPC de lectura existentes, muestra monto USD, comisión, total y moneda destino, y no inventa FX cuando no hay tasa disponible. CI 45857867169: 122 pruebas Android y 27 regresiones aprobadas; CI 45857867189: exportación Android y auditorías aprobadas. Pendiente compilación de la entrega integrada y una comprobación física agrupada del nuevo cotizador junto a sesiones cifradas. No repetir movimientos monetarios previos. Se actualizan los workflows para no cancelar la compilación anterior, aprovechar lockfile si existe y rechazar APK antiguas cuando cambie código ejecutable. No hay pagos reales, cambios de base ni integración main.

## Verificación independiente del artefacto de seguridad — 26 de noviembre
- APK intermedia e9db291, run 45857215779, artefacto 15137420622. Job apk aprobado; smoke-test en curso al comprobar. No entregar como definitiva: la revisión integrada ed15a7c incluye cotizador y cambios de CI; preflight y auditoría estática de esa revisión aprobados (45858130745 y 45858130907), APK integrada 45858121607 en cola.
- ZIP descargado: SHA256 32c0cf520b5963bc2abe9d974dfa1dcf8a169f5f76292889ca6d0a6975da49a0 coincide con metadatos GitHub. APK: 34,847,000 bytes, SHA256 05b4dceb4d926db07efbe1d0b8ed0b03dbce7298b508b0085d67f52b805fb06f; commit y manifiestos verificados. Certificado v2 extraído: fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c, coincide con candidata física anterior. CI verifica firma; extracción no sustituye apksigner.
- Inspección del APK: clase nativa expo/modules/securestore/SecureStoreModule presente en DEX, ABI arm64-v8a y x86_64; manifiesto contiene atributos de configuración de backup y recursos XML contienen reglas de exclusión SecureStore. No implica prueba de persistencia real de sesión.
- Lockfile (728 entradas): SHA256 37b19f7d4ae9eddaaa18cbe1a1c2277dce212bcab46df0e6ba325cbdef31159e; Expo 54.0.38, SecureStore 15.0.8, Supabase JS 2.119.2, React Native 0.81.5 y safe-area-context 5.6.2. Node 22.23.5, npm 10.9.9, Java 17.0.21. Comparación Git confirma package.json sin cambios entre e9db291 y ed15a7c. Comparar lockfile exacto de la entrega integrada cuando exista; aún no está versionado en Git. No disparar otra compilación exclusivamente por registrar documentación.

## Entrega integrada ed15a7c aprobada en CI
Run 45858121607: apk y smoke-test success. Artefacto 15136713259, vence 2026-12-03T16:29:53Z. ZIP SHA256 8fb505e9236c1716ff82b2671763f53d189ad5b0973309fe9e88d6cb2d70c5d0 coincide con GitHub. APK SHA256 0011ce0de1c1beabba2c0d80e95443295074b97a8d484ebb1d3d72158430e8f1, 34855464 bytes; COMMIT.txt y manifiestos verificados. Certificado DER v2 SHA256 fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c coincide con anterior LAB; SecureStore presente en DEX. Lockfile exacto 343611 bytes SHA256 37b19f7d4ae9eddaaa18cbe1a1c2277dce212bcab46df0e6ba325cbdef31159e coincide con e9db291, todavía no versionado. Entregar ZIP verificado y validar en Samsung únicamente nuevo acceso, persistencia, recuperación PKCE y cotizador. No desinstalar, no transferir ni repetir historiales. No fusionar main todavía. Núcleo financiero sandbox separado, PR 137, 18 pruebas aprobadas run 45859652589; no incluido en APK ni conectado a dinero real.

## Cierre de dependencias y candidato único — actualización 26 nov
- Lockfile exacto recuperado y versionado en `da8ddd36c50dae0d67b5182362dc949f7f3cea24`. Preflight [45868689609](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45868689609) en `17e6f9794b13a9622623a3b39b06313559043506`: instalación limpia con npm ci, export Android, auditoría y regresiones aprobadas. Auditoría [45868689621](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45868689621) aprobada en la misma revisión. Comparación con APK ed15a7c: solo lockfile exacto y documentación antes del ajuste de CI; ninguna modificación de App.js ni dependencias declaradas.
- El preflight requiere ahora lockfile y npm ci, detecta modificaciones de manifiestos e incluye cambios a lockfile, almacenamiento de sesión e interfaz de socios en sus disparadores. El workflow EAS manual también exige lockfile; no se inicia un build de pago. Cambios exclusivamente CI/documentación no exigen regenerar el APK aprobado para aceptación física.
- **Candidato histórico (NO instalar para aceptación final):** [artefacto 15136713259](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45858121607/artifacts/15136713259), vigente hasta 2026-12-03 16:29:53 UTC. Instalar como actualización sin desinstalar. Validar acceso, persistencia, salida, recuperación PKCE y cotizador. No repetir operaciones ya aceptadas; no facilitar credenciales ni enlaces privados. La comprobación física y autorización explícita de fusión siguen pendientes. No afirmar reproducibilidad binaria exacta ni preparación para dinero real.

## Entrega histórica ed15a7c — sustituida por la candidata vigente

Registro histórico (no seguir como instrucción actual): [artefacto 15136713259](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45858121607/artifacts/15136713259); contenía `MonedaMundial-LAB.apk`. La descarga vence el **3 de diciembre de 2026 a las 16:29 UTC**. Se comprobó el hash del ZIP contra los metadatos de GitHub, el SHA-256 del APK contra el registro de la candidata y la coincidencia byte por byte del lockfile con Git. La compilación visible esperada es `ed15a7c242f2b135b98abcfaad2996b041cd60bf`. El preflight del PR también aprobó la recuperación PKCE con el SDK fijado y un sustituto local de SecureStore. [CI del candidato](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45858121607) · [Preflight PKCE](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45879072159)

| Paso | Resultado esperado |
| --- | --- |
| Actualizar la instalación LAB | Android acepta la actualización sin desinstalar. La app abre y muestra la compilación indicada. Si Android rechaza la actualización, registrar el mensaje y conservar la instalación. |
| Acceder con una cuenta DEMO | La app abre Inicio. Al cerrar y reabrir la app, conserva la sesión. Al cerrar sesión explícitamente y volver a abrir, muestra Acceso. |
| Recuperar la contraseña desde el mismo Samsung | El enlace del correo abre la pantalla de nueva contraseña. Después del cambio, la contraseña nueva permite iniciar sesión y el enlace consumido se rechaza. |
| Consultar el cotizador internacional | Una consulta DEMO muestra importe, comisión y total. Si falta una tasa, la pantalla informa que no está disponible. |

Registrar modelo de Samsung, versión de Android, compilación visible y resultado por paso. Para un fallo basta describir el mensaje y el punto donde ocurrió. Excluir contraseñas, enlaces de correo, tokens y datos de cuenta. Las transferencias, conversiones y aportaciones aceptadas conservan su evidencia previa. La aceptación física y la aprobación de fusión se registrarán cuando estén disponibles.

## Corrección del tipo de sesión PKCE

El formulario de cambio de contraseña exige que el SDK devuelva el tipo `recovery` y que la sesión corresponda al usuario observado por el callback de autenticación. La regresión reproduce un acceso PKCE normal enviado al enlace de recuperación y comprueba que permanece en Inicio y que el formulario no puede cambiar la contraseña. Como el cambio afecta al código de la app, la aceptación física final se hará con la compilación actualizada una vez aprobadas la construcción y la prueba en emulador. La entrega `ed15a7c` conserva su evidencia histórica.
