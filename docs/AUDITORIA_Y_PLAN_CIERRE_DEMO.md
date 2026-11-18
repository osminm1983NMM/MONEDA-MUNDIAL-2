# Auditoría técnica y plan de cierre — Moneda Mundial 2.0 DEMO

Fecha: 2026-11-18. Alcance: archivos presentes en la rama `fix-demo-pickup-retry-and-swap-input`, observaciones de pruebas Android compartidas por el propietario. No constituye auditoría de producción ni certificación de seguridad.

## Inventario verificado del repositorio

- `App.js`: aplicación React Native/Expo con inicio de sesión Supabase, billetera MWD ficticia, transferencias, aportaciones, historial, retiro ficticio y conversión simulada COIN/DIGITAL.
- `PartnerRegistryScreen.js`: registro interno de candidatos a socios; **no** habilita pagos reales.
- `database/mwd_secure_partner_registry_demo.sql`: definición SQL del registro interno de socios. No equivale a un sistema regulado de remesas.
- `tests/demo-input.test.cjs`: 27 pruebas de regresión principalmente estáticas; aprobaron en ejecución JavaScript aislada, **no** es una corrida oficial de Node.js.
- `package.json`: `npm test` ejecuta `node --test tests/*.test.cjs`.
- `.github/workflows/validar-demo.yml`: workflow **manual**; corregido para incluir `npm test` en Node 22. No ejecutado todavía.
- `.github/workflows/build-remesas-demo-apk-manual.yml`: workflow **manual** de APK/EAS; corregidos checkout de rama y nombre del script de pruebas. **No ejecutarlo sin revisar cuotas y autorización de gastos**.
- `app.json` / `eas.json`: configuración Expo y perfil APK de distribución interna.

## Evidencia Android recibida

- Inicio de sesión y saldo de demostración visibles en dos cuentas de prueba.
- La interfaz mostró «Saldo e historial actualizados correctamente» después de pulsar actualizar.
- El historial mostró transferencias ficticias enviadas y recibidas.
- Se visualizan pantallas de transferencia y aportación. **No se confirmó una transferencia nueva en esta ronda**.
- El encabezado «Versión 2.0» no identifica un commit ni demuestra que el APK incluya los últimos cambios.

## Brechas y riesgos por resolver antes de la entrega DEMO

1. **Validación reproducible:** ejecutar el workflow manual de Node.js o `npm test` localmente, registrar SHA, fecha y resultado; las pruebas actuales no cubren lógica de red ni UI real.
2. **Pruebas funcionales automatizadas:** incorporar mocks de Supabase para simular respuestas tardías, fallos de red, reintentos, cambios de cuenta, idempotencia y cancelación de retiro; no limitarse a búsquedas de texto.
3. **Sesiones concurrentes:** verificar que ninguna respuesta antigua modifique datos o estados de una sesión nueva, incluyendo errores y estados de carga.
4. **Conciliación:** validar saldos, operaciones, asientos y órdenes con consultas de solo lectura y sin alterar datos de prueba.
5. **APK identificable:** mostrar versión de compilación y revisión Git verificables; evitar instalaciones repetidas mientras no exista una versión candidata.
6. **Seguridad:** revisar RLS, privilegios RPC, `search_path`, permisos y gestión de secretos. No almacenar claves privilegiadas en la app.
7. **Cierre funcional:** probar con un guion único las cuentas A/B, transferencias, aportaciones, retiros, conversiones, historial y administración.
8. **Dinero real:** fuera de alcance de la DEMO. Requiere socio regulado, contratos, KYC/AML, cumplimiento por jurisdicción, soporte, protección de fondos y pruebas adicionales.

## Política de ahorro y ejecución

- Trabajar en rama aislada; no fusionar a `main` sin revisión.
- No crear ramas pagadas de Supabase ni ejecutar builds EAS por defecto.
- No pedir capturas repetitivas; agrupar las pruebas manuales en una única ronda final, salvo bloqueo crítico.
- Antes de cada servicio con posible costo: explicar objetivo, cuota y solicitar autorización.
- Conservar la diferencia entre «código preparado», «prueba estática ejecutada», «prueba Node completada» y «prueba Android completada».

## Próximo hito

Ejecutar pruebas oficiales de Node.js, ampliar pruebas de comportamiento sin fondos reales y preparar una única versión candidata para la validación final en Android. Las pruebas y builds manuales no se activan automáticamente.
