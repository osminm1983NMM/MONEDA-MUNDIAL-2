# Recuperación de operaciones y reintentos — Moneda Mundial 2.0
16 octubre 2026. **Laboratorio sin cuentas bancarias reales.**

Se amplió la CI PostgreSQL de investigación con dos sesiones `psql` independientes. La primera crea una orden US→HN, registra un fondeo ficticio y provoca un evento de devolución fuera de orden que debe rechazarse; la segunda sesión, sin depender de la RAM de la primera, recupera estado y evento persistido, valida deduplicación por proveedor+event_id, rechaza un replay alterado y comprueba que no se acreditó un segundo movimiento.

Se corrigió además la omisión de `realFundsEnabled:false` en la respuesta del gateway HMAC mock; un fallo de test previo detectó ese valor ausente. La respuesta de test no permite fondos.

**Importante:** esta prueba verifica reinicio del CLIENTE SQL, no caída real del servidor PostgreSQL, concurrencia a gran escala, durabilidad tras corrupción de disco o recuperación mediante copias. Las escrituras están protegidas mediante bloqueo de fila en `record_mock_event` y restricciones únicas, pero todavía deben probarse carreras entre procesos independientes y failover en un entorno formal, además de RPO/RTO, backups y restauraciones periódicas.

**Siguiente objetivo técnico:** ensayar dos clientes SQL concurrentes sobre la misma orden, caída durante una transacción, reintentos y recuperación de una copia de seguridad en CI, sin tocar el proyecto Supabase existente.

**Objetivo comercial pendiente:** contrato/credenciales sandbox oficiales de proveedor regulado, cumplimiento y entidad jurídica para US→HN. El catálogo conserva Nicaragua y otros destinos sin habilitar dinero real. Moneda Mundial Digital y Coin no están emitidas.
