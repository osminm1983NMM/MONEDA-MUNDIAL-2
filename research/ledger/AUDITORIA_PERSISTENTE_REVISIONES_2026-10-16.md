# Auditoría persistente de revisiones — prueba aislada Moneda Mundial
16 octubre 2026. **No implementar en Supabase de producción.**

Se añadió `research/ledger/mock-durable-dual-review-audit.sql` al entorno PostgreSQL CI, con pruebas en `research/ledger/tests/mock-durable-dual-review-audit-assertions.sql`.

El modelo utiliza un contador serializado bajo bloqueo de fila, eventos con UUID único, referencias a casos DEMO y una cadena SHA-256 derivada del registro anterior y de los campos canónicos. El mismo event_id con iguales datos es idempotente; con datos cambiados se rechaza. Se prohíben autoaprobación, cierre repetido de revisiones y cruces entre instituciones; hay verificación de integridad de la secuencia y de la cabecera. Se restringe el acceso a roles no autorizados y se impide modificar asientos mediante vías normales. La CI prueba detección de alteración y recuperación del hash de cabecera sólo dentro de un entorno desechable.

**Limitaciones críticas:** al controlar la base de datos, un administrador malicioso puede reescribir todos los eventos y calcular hashes nuevos. Esta cadena NO sustituye WORM, respaldos independientes, firmas de terceros, sellos de tiempo externos, retención regulatoria ni auditoría real. Tampoco prueba que alguien se autenticó correctamente: los nombres `mock-reviewer-...` son alias inventados. Ningún evento autoriza pagar, reembolsar, entregar efectivo o intercambiar criptomonedas. No se conecta a la app, Supabase ni proveedor real.

**Siguiente paso:** incorporar una vista administrativa de SOLO LECTURA de esta información de investigación; más adelante, con entidad y contratos, diseñar registros independientes de auditoría real y controles de supervisión. US→HN es primer corredor candidato, NI y el catálogo global quedan en diseño. Coin y Digital no están emitidas.
