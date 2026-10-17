# Ensayo aislado de transferencias entre dos cuentas ficticias

**Estado: EJECUTADO Y APROBADO en PostgreSQL 17 desechable por GitHub Actions (17 de octubre de 2026).**

Evidencia: ejecución **39056502402** del workflow «Validar RLS en PostgreSQL aislado».
Resultado: «PRUEBAS APROBADAS: 2 cuentas; transferencias, idempotencia, pagos, cancelaciones, autorizaciones y RLS. A=1000050, B=999900».
Las cantidades se representan en centavos de MWD ficticios: A=10,000.50 MWD y B=9,999.00 MWD al final de la prueba.
No se usaron cuentas reales, Supabase ni dinero real.

Estos archivos **no crean usuarios de Supabase**, no envían mensajes de registro
y no alteran las billeteras instaladas en Android:

- `tests/transferencias-dos-cuentas-fixture.sql`: estructura limitada en
  PostgreSQL independiente, dos identidades ficticias A y B, 10,000 MWD de
  inicio por billetera, dos solicitudes de comercio de ensayo, permisos/RLS
  y copias de las seis funciones financieras leídas del demo.
- `tests/transferencias-dos-cuentas-assertions.sql`: envía 1 MWD de A a B,
  prueba reintentos por UUID, evita autotransferencia y fondos insuficientes,
  paga un cobro de 2 MWD desde B, cancela otro cobro, valida protección de
  roles y saldos. Cada comprobación falla con error SQL si no se cumple.
  
## Ejecutar solamente en una base vacía y desechable

**NUNCA** ejecutar estos scripts en Supabase de Moneda Mundial ni en
ninguna base con información real, pues el fixture define usuarios, roles,
esquemas, tablas y revoca permisos. Su nombre no basta como aislamiento.

Con una base nueva PostgreSQL 17 separada, conectada explícitamente a
un servidor de ensayo y usando un usuario administrador desechable:

```bash
psql -X -v ON_ERROR_STOP=1 -f tests/transferencias-dos-cuentas-fixture.sql
psql -X -v ON_ERROR_STOP=1 -f tests/transferencias-dos-cuentas-assertions.sql
```

El segundo archivo debe terminar con:
`PRUEBAS APROBADAS: 2 cuentas; transferencias, idempotencia, pagos, cancelaciones, autorizaciones y RLS`.

Una revisión de código, sin esa salida de `psql`, **no constituye prueba exitosa**.

## Limitaciones

Es un ensayo secuencial; no verifica tráfico simultáneo ni dos dispositivos
reales. No es auditoría de dinero real ni autoriza operar con pagos. La próxima
etapa es ejecutar en CI aislada y documentar el resultado, luego validar
las mismas pantallas de la APK con dos cuentas de prueba autenticadas.

## Verificación adicional ejecutable sin PostgreSQL

`tests/dos-cuentas-simulacion.test.mjs` describe con seis pruebas unitarias
el comportamiento que esperamos de dos identidades A/B ficticias. GitHub
Actions lo ejecuta con `node --test tests/*.test.mjs` junto con las pruebas
anteriores.

**Diferencia esencial:** es un modelo JavaScript en memoria para verificar
reglas e idempotencia; no demuestra que las RPC de Supabase se hayan ejecutado.
La suite PostgreSQL de arriba **se ejecutó y aprobó en CI aislada**. Aún falta probar estas operaciones con dos sesiones autenticadas y dispositivos reales.
