# Moneda Mundial 2.0 — cierre integrado DEMO
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
1. Finalizar APK e9db291 y smoke-test; verificar origen, firma compatible con LAB, manifiestos y lockfile. Registrar versión resuelta de dependencias; guardar lockfile reproducible en repositorio para siguiente release sin reconstrucciones innecesarias. No sustituir la APK comprobada por otra no verificada.
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
