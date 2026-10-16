# Doble revisión institucional — Moneda Mundial 2.0
16 octubre 2026. **Sólo simulación sin dinero, criptomonedas ni autorización financiera.**

Se creó `src/server/mock-dual-review.mjs` para estudiar la intervención de dos empleados ficticios distintos de una misma institución en acciones sensibles: desembolso bancario, reembolso, entrega de efectivo, cambio de permisos e intercambio de criptomonedas. El iniciador necesita una sesión de laboratorio válida y la misma institución y país que el caso sintético. La segunda revisión exige un empleado distinto, sesión vigente, concordancia de entidad, no vencimiento de la solicitud y que la membresía del iniciador siga activa. La solicitud caduca en cinco minutos y no puede repetirse una revisión ya completada.

**Punto esencial:** el resultado `dual_review_recorded_mock` NO es aprobación de desembolso, orden ejecutable, transacción, autenticación WebAuthn/MFA ni validación legal. `canExecute=false`, `approvedForProduction=false` y `realMoneyEnabled=false` en cada respuesta. La información vive únicamente en RAM. No se integra en la app ni Supabase y no sustituye control dual real, roles verificados o libros contables.

Pruebas: `tests/mock-dual-review.test.mjs` verifica separación entre empleados, bloqueo de autoaprobaciones y actores de otro banco, expiración, revocación y prohibición de ejecutar dinero.

**Antes de dinero verdadero:** identidad institucional y KYB, MFA resistente a phishing comprobada en servidor, autorización por operación y montos, segregación de funciones persistente, auditoría independiente, doble consentimiento vinculado a la misma transacción verificable, proveedor regulado contratado y cumplimiento por país. US→Honduras primera ruta candidata; Nicaragua y catálogo mundial preservados.
