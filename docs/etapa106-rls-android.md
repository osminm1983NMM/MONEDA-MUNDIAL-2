# Etapa 106 — Aislamiento RLS MWD y preparación Android (2026-10-24)

## Alcance
Laboratorio DEMO de Moneda Mundial 2.0. Créditos MWD ficticios; **no** hay dinero real, pagos bancarios, emisión de Coin ni operaciones financieras.

## Verificación de seguridad: prueba de cuatro identidades existentes

Proyecto Supabase de pruebas existente, sin crear otro proyecto o rama de pago.
Se comprobó que las 4 billeteras existentes corresponden a registros de `auth.users`. La base tiene 9 operaciones DEMO.

Método: consultas SELECT dentro de `BEGIN READ ONLY`; se adoptó transitoriamente el rol PostgreSQL `authenticated` y se estableció `request.jwt.claim.sub` para cada identidad de prueba. Al terminar cada consulta se usó `ROLLBACK`. No se usaron contraseñas ni `service_role` en clientes, no hubo inserciones ni cambios de saldo.

| Identidad de prueba | Billeteras visibles | Billeteras de otros visibles | Operaciones como participante | Operaciones no relacionadas visibles |
|---|---:|---:|---:|---:|
| A | 1 | 0 | 5 | 0 |
| B | 1 | 0 | 4 | 0 |
| C | 1 | 0 | 3 | 0 |
| D | 1 | 0 | 3 | 0 |

Las operaciones pueden contar en más de una identidad cuando ambos usuarios participan. La suma por usuario no equivale al número total de operaciones.

Comprobaciones adicionales:
- `public.mwd_wallets` y `public.mwd_operations` mantienen RLS habilitado.
- `authenticated` conserva permiso de lectura sujeto a RLS.
- `anon` carece de permiso SELECT sobre ambas tablas.
- Las políticas de billetera filtran por `user_id = auth.uid()`; las de operaciones por origen o destino autenticado.

**Límite de la evidencia:** son sesiones PostgreSQL de prueba con identidad JWT simulada, **no** dos inicios de sesión reales por la API de Supabase ni navegación extremo a extremo de la app. Las funciones privilegiadas (`SECURITY DEFINER`) requieren su revisión independiente antes de producción; esta prueba se limita a la lectura directa de estas dos tablas.

## Android — estado comprobado
- PR borrador #99: https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/pull/99
- CI de seguridad de refresco y pruebas del historial: aprobado.
- Validación Expo y `CI=1 npx expo export --platform android --output-dir dist-android`: aprobado para la versión del PR #99 (run 40102657141).
- Esto verifica empaquetado de JavaScript para Android, **no** instalación ni ejecución de una APK.
- La compilación nativa con emulador existente apunta a `desarrollo-comercios-20261013`; no se ha probado la APK del commit actual de esta propuesta.
- PR #99 depende del PR #92 y sigue sin fusionarse.

## Criterios antes de anunciar APK verificada
1. Revisar y aprobar dependencias de PR anteriores, sin fusionarlas a ciegas.
2. Compilar APK identificada por commit/huella SHA-256 y comprobar que contiene el código actualizado.
3. Instalar esa misma APK en emulador Android y registrar arranque y recorrido básico.
4. Probar cierre de sesión e inicio con cuentas DEMO A y B desde la app: una billetera por usuario, sin historial ajeno ni datos obsoletos de la sesión previa.
5. Comprobar la misma APK en Samsung. No introducir datos bancarios ni dinero real.

Estado: prueba RLS con rol simulado **aprobada**. Verificación E2E de sesiones y APK del PR actual **pendientes**.
