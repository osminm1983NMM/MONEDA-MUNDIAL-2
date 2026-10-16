# Prueba de concurrencia de eventos financieros simulados
16 de octubre de 2026 — **únicamente laboratorio PostgreSQL desechable**.

Se añadió `research/ledger/tests/concurrency-two-clients.sh` a la automatización `verificar-ledger-investigacion.yml`.

Dos sesiones SQL distintas intentan procesar simultáneamente el mismo evento de fondeo ficticio. La primera retiene el bloqueo de la orden; la segunda debe esperar y detectar el evento como ya procesado, sin escribir una segunda fila. Después, dos sesiones compiten por una transición distinta sobre la misma orden (pago contra devolución). Una sola debe entrar y la otra ha de rechazarse por transición de estado incompatible. Se comprueba la cantidad final de filas.

Se limita la ejecución a `PGDATABASE=ledger_test` y no contiene claves, datos privados ni transferencias reales. El cierre de sesiones se comprueba en GitHub Actions. La prueba no simula miles de conexiones, interrupción total del motor Postgres, corrupción de disco, disaster recovery, respaldo/restauración ni confirmación real de banco.

**Siguientes controles a diseñar:** simular rollback forzado y caída de cliente en mitad de transacción, y respaldos/restauración de DB temporal con RPO/RTO medibles. Integración real con proveedor sigue bloqueada hasta constitución, contratos, revisiones AML/KYC/OFAC y sandbox oficial US→HN. Nicaragua y catálogo de países quedan preservados. Moneda Mundial Digital y Coin no están emitidas.
