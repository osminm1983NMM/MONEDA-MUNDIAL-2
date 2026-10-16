# Moneda Mundial — ensayo de recuperación ante caídas y copias
16 octubre 2026. **Investigación exclusiva en PostgreSQL CI, sin bancos ni fondos auténticos.**

## Implementación
- `tests/forced-transaction-rollback.sh`: una sesión PostgreSQL abre BEGIN, escribe un evento de fondeo ficticio y queda pausada; otra conexión del laboratorio termina exclusivamente ese backend y verifica que el estado no se haya aplicado parcialmente. Luego reintenta de modo idempotente, sin crear una segunda confirmación.
- `tests/backup-restore-isolated.sh`: crea un evento ficticio de Nicaragua, hace un volcado `pg_dump` sólo del esquema `mwd_inbox_research`, restaura en **otra** base desechable `ledger_restore_test`, compara conteos/estados y ensaya un replay idéntico, que debe detectarse.
- Ambas pruebas están en `.github/workflows/verificar-ledger-investigacion.yml`. Las ejecuciones de CI determinan el resultado; las pruebas no constituyen autorización para operar.

## Alcance y límites
- La recuperación tras matar un backend prueba **rollback transaccional**, no apagón físico del servidor ni pérdida total del almacenamiento.
- Restaurar otra base verifica objetos y algunos registros de prueba, no recuperación ante desastre completa. No define ni garantiza RPO, RTO, cifrado de backups, secreto empresarial, retención o restore point-in-time.
- No se ha restaurado, migrado ni modificado Supabase, ni se manejan clientes, proveedores, cuentas o dinero reales.
- El desarrollo de Moneda Mundial Coin y Moneda Mundial Digital sigue separado; ambas permanecen en diseño.

## Próximo objetivo
1. Medir RPO/RTO sobre copias cifradas y demostrar Point-in-Time Recovery (PITR) en un ambiente técnico aprobado.
2. Diseñar monitoreo de anomalías, doble entrega, fraude, intervención manual y observabilidad segura.
3. Obtener contratos y entorno oficial sandbox para primer corredor US→HN; NI y el resto de países continúan en catálogo, sin rutas de producción habilitadas.
