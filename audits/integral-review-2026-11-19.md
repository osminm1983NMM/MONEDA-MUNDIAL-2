# Auditoría integral Moneda Mundial 2.0 — 2026-11-19

**Alcance:** demo de créditos ficticios. Este documento no certifica funcionamiento Android ni autoriza dinero real. Rama de revisión: `fix/pickup-retry-idempotency-20261119`. PR #125, sin fusionar.

## Verificado directamente
- Código de App.js y pruebas estáticas inspeccionados en GitHub.
- Corregida la expresión regular de entrada de cotizaciones: usar `\d` y `\.` dentro del literal RegExp, no `\\d` o `\\.`. Se agregó aserción estática; **no ejecutada en runner**.
- Supabase security advisors: 30 avisos informativos de tablas privadas con RLS sin políticas; 56 advertencias de funciones SECURITY DEFINER ejecutables por authenticated; 1 aviso de protección de contraseñas filtradas.
- Consulta de catálogo de funciones públicas: funciones MWD listadas no conceden EXECUTE a anon; funciones de negocio conceden EXECUTE a authenticated. **Esto NO prueba que todas validen autorización internamente**.

## Hallazgos y prioridades
1. **P0 / antes de dinero real:** revisar cada función SECURITY DEFINER, en especial `mwd_owner_*`, para verificar controles de rol/propiedad en su cuerpo; no retirar permisos en bloque.
2. **P1 / Android:** ejecutar pruebas de recuperación tras desconexión, respuesta perdida, reinicio y cambio de cuenta; validar idempotencia de transferencias y retiros.
3. **P1 / automatización:** ejecutar manualmente `.github/workflows/validar-demo.yml`; aún no hay ejecución verificada. Revisar instalación de dependencias y compilación real.
4. **P1 / aportaciones:** seis aportaciones ficticias requieren política de contrapartida antes de asientos nuevos.
5. **P1 / conversión:** comprobar valores con 1–6 decimales, límites, caducidad, doble confirmación y reintentos de red.
6. **P2 / seguridad Auth:** revisar configuración de protección de contraseñas filtradas en dashboard.
7. **P2 / dependencias:** fijar versiones y generar lockfile reproducible en un entorno con npm; no afirmar que npm install o Android build se ejecutaron.

## Condiciones de cierre
- Todas las comprobaciones automáticas ejecutadas y registradas, no solo inspeccionadas.
- Pruebas de Android T01–T17 ejecutadas con resultados documentados.
- Cero operaciones duplicadas, saldos negativos o asientos descuadrados después de las pruebas.
- Revisión de permisos privilegiados y protección de sesiones completada.
- Decisión contable explícita sobre aportaciones antes de activar su asiento.
- PR revisado antes de fusionar con main.

## Protección de costos
- No se creó rama temporal ni recurso de pago en Supabase.
- No se ejecutaron transacciones de prueba que alteren saldos.
- GitHub Actions continúa manual y pendiente de ejecución.
