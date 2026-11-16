# Transferencias concurrentes en PostgreSQL — resultado 2026-11-16

**Ejecución:** https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/43887313372 — `success`.

**Evidencia:** el registro del job contiene `POSTGRES_TRANSFER_CONCURRENCY_PASS`; las fases de alta, concurrencia y fallos también pasaron.

**Escenario:** en PostgreSQL 16 efímero, tres billeteras sintéticas empiezan con 1,000,000 centavos MWD cada una. Dos conexiones intentan debitar 700,000 centavos cada una desde la misma billetera hacia destinatarios distintos. Solo una solicitud tiene éxito; el emisor queda con 300,000 centavos, el total de las tres billeteras sigue siendo 3,000,000 centavos y hay exactamente una operación. Repetir el identificador de la solicitud aceptada no vuelve a descontar.

**Límite esencial:** `public.test_atomic_transfer` es una implementación mínima **solo para pruebas**. El resultado NO demuestra que `public.mwd_transfer_demo` en Supabase tenga el mismo comportamiento bajo concurrencia. No hubo acceso ni modificaciones a Supabase principal.

**Siguiente trabajo:** auditar el SQL de `mwd_transfer_demo` y preparar una prueba aislada de la función real con dependencias sintéticas, controles de permisos y fallos; no desplegar hasta revisión y autorización.
