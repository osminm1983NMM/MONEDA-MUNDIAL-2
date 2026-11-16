# Plan de pruebas aisladas: concurrencia de remesas ficticias

Fecha: 2026-11-16. **Plan solamente; ninguna prueba activa se ha ejecutado aquí.**

## Condiciones antes de ejecutar

1. Usar un proyecto Supabase de laboratorio **aislado** del proyecto actual, sin cuentas ni saldos de usuarios existentes. Confirmar previamente cualquier costo adicional.
2. Instalar en laboratorio el esquema y RPC de remesas demo mediante migraciones revisadas; no copiar credenciales de producción ni datos personales.
3. Crear identidades de prueba separadas: propietario A, usuario autenticado sin rol B. Todas las operaciones son ficticias, US→HN.
4. Registrar identificadores de solicitudes, tiempos, respuestas y eventos sin publicar secretos.

## Matriz de pruebas

| Caso | Acción | Resultado esperado |
| --- | --- | --- |
| C1 | Enviar dos creaciones concurrentes de A con igual request_id y mismo importe | Una orden; respuestas compatibles con idempotencia |
| C2 | Reutilizar request_id con importe diferente | Error; no segunda orden |
| C3 | Ejecutar dos transiciones concurrentes de la misma orden al mismo estado y request_id | Un evento para esa referencia; segundo intento reconocido |
| C4 | Reutilizar request_id de transición para otro estado | Error; sin nuevo evento |
| C5 | Intentar transiciones incompatibles simultáneas | Solo estados permitidos; ningún cierre duplicado |
| C6 | Usuario B intenta crear/transicionar remesa de propietario | Denegación por rol; ningún cambio |
| C7 | Repetir finalización simulated con request_id distinto | Un único evento simulated; sin doble cierre |
| C8 | Simular pérdida de respuesta y reintentar con request_id original | Se recupera orden/estado real, sin duplicación |

## Criterios de aprobación

- Consultar órdenes y eventos antes y después de cada caso; verificar contadores e índices únicos.
- Cualquier discrepancia bloquea el avance a APK y requiere corrección en la rama de desarrollo.
- No habilitar pagos reales, retiros reales ni conversiones con valor monetario.
- Documentar resultados y limpiar únicamente datos de laboratorio autorizados.

## Estado

Las 41 pruebas de GitHub Actions son pruebas automatizadas del código y configuración, **no** ejecutan esta matriz de integración. La matriz permanece pendiente.
