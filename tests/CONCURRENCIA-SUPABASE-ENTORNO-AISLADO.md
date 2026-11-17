# Ejecución segura de pruebas concurrentes (MWD DEMO)

## Estado verificado
El proyecto Supabase solo muestra la rama `main`. **No ejecutar pruebas que escriban datos contra main.** El simulador offline no prueba bloqueo de filas, aislamiento PostgreSQL ni carreras de RPC.

## Antes de empezar
1. Obtener aprobación explícita del costo de crear y mantener una rama aislada de Supabase. Confirmar tarifa vigente y límite de tiempo antes de crearla.
2. Crear rama de pruebas con datos ficticios separados y sin credenciales de producción.
3. Crear dos usuarios ficticios nuevos A/B, y opcionalmente C; registrar saldos iniciales.
4. Asegurar que el cliente apunta al proyecto de pruebas, nunca a `egrsdrlpavrtbgxoyxvg` (main).
5. Usar únicamente claves públicas de cliente y sesiones de usuarios de prueba; no colocar service-role keys en el repositorio.

## Ejecución (sin dinero real)
- **Caso 1:** dos RPC `mwd_transfer_demo` simultáneas con el mismo `request_id`, mismo monto y destinatario. Debe existir una sola operación y un solo débito.
- **Caso 2:** dos RPC con distintos IDs, cada una mayor que la mitad del saldo disponible. A lo sumo una debe completarse.
- **Caso 3:** dos RPC A→B y B→A a la vez. Comprobar finalización o error recuperable sin saldos negativos.
- **Caso 4:** reintentar el ID anterior con distinto monto o destinatario. Debe rechazarse.
- **Caso 5:** verificar que el usuario B no puede leer la billetera ni las operaciones privadas de A.
- **Caso 6:** repetir al menos 20 rondas y registrar errores, latencia, saldos y operaciones finales.

## Evidencia de aprobación
- 0 saldos negativos; 0 operaciones duplicadas por `actor_id,request_id`.
- Suma de saldos constante para transferencias entre usuarios.
- Ningún movimiento parcial ante fallos.
- Sin lectura cruzada no autorizada.
- Reporte reproducible con fecha, hash de código, número de rondas y resultado.
- Ejecutar las consultas `tests/sql/auditoria-invariantes-solo-lectura.sql` y `tests/sql/auditoria-integridad-operaciones-solo-lectura.sql` **solo en la rama aislada**.

## Cierre
Detener/eliminar el entorno aislado cuando terminen las pruebas para evitar cargos recurrentes. No mezclar resultados del simulador con resultados de concurrencia real.

**Estado: procedimiento documentado; pruebas de concurrencia real pendientes de aprobación del entorno aislado.**
