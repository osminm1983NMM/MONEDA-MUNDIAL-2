# Moneda Mundial 2.0 — Etapa 142 (DEMO)

## Correcciones acotadas tras pruebas manuales en Samsung

**Fecha:** 25 de octubre de 2026  
**Base:** `feature/mwd-history-responsive-stage141`  
**Entorno:** billetera de laboratorio; sin dinero real.

### Evidencia manual recibida

- Tras cerrar y abrir la aplicación, la misma billetera de prueba mostró 10,000.00 MWD ficticios y la vista «Tu actividad» mostró 4 movimientos: 2 entradas (+2.00 MWD) y 2 salidas (−2.00 MWD). Esto verifica visualmente su persistencia en ese teléfono, **no** la durabilidad del servidor ante fallas ni una auditoría contable.
- El movimiento del 14/10/2026 a las 10:57:28, por −1.00 MWD, apareció como «Pago ficticio a comercio» en la actividad reciente y como «Enviado» en la consulta paginada.
- El filtro «Comercios» mostró una operación y el comprobante ficticio correspondiente exhibió referencia, importe, fecha y aviso explícito de ausencia de dinero real. Otro comprobante de +1.00 MWD mostró una referencia diferente.
- El botón «Actualizar saldo e historial» pareció no responder porque la interfaz no mostraba un resultado persistente. No se ha demostrado que la consulta de red haya fallado.
- En una captura, la etiqueta «SOLO DEMOSTRACIÓN» se dividía entre líneas de manera incómoda.

### Correcciones del código

1. `PagedDemoHistoryScreen` usa la clasificación de comercio **solo si** la operación de la página coincide por UUID, tipo, fecha, importe y dirección con una operación reciente de la misma cuenta autenticada cuyo `is_merchant_payment` es `true`. No se deduce un pago comercial de un simple envío.
2. El historial paginado conserva una descripción genérica cuando no existe evidencia de clasificación comercial en los movimientos recientes. Es una limitación deliberada: `mwd_operations` no tiene una columna `is_merchant_payment`, y la RPC `mwd_history_demo` proporciona la clasificación de los registros recientes. No se agregó una RPC privilegiada ni se relajó RLS.
3. La actualización manual del saldo e historial muestra una confirmación de éxito **solo después** de validar y aplicar la respuesta a la misma cuenta/sesión. Si la consulta falla, muestra un aviso de error. La carga automática al iniciar sesión no genera confirmaciones manuales engañosas.
4. La etiqueta corta «SOLO DEMO» evita la división incómoda, manteniendo el aviso principal de «SIN DINERO REAL».

### Verificación automática

- `npm test`: 96 archivos de pruebas aprobados; 0 fallos.
- `git diff --check`: sin errores.
- Pruebas nuevas: coincidencia de pago y cobro comercial en paginación; rechazo de etiquetas de comercio ante cuenta, tipo, importe, fecha o dirección distintos.

### Límites y tareas pendientes

- **No** se generó ni instaló una APK nueva en Samsung. Las correcciones están preparadas en código y requieren un flujo Android de prueba, verificación de firma/procedencia y una nueva validación manual.
- No se modificaron bases de datos, políticas RLS, fondos, transferencias, roles, credenciales ni secretos.
- La fuente corresponde a la rama de interfaz de etapa 141; todavía se debe confirmar la correspondencia exacta con la APK que Osmin tiene instalada antes de recomendar cualquier actualización.
- Para operaciones antiguas fuera del conjunto reciente, la página seguirá mostrando «Enviado»/«Recibido». Un historial comercial completo requeriría una API paginada que devuelva la clasificación verificada por el servidor, diseñada y auditada por separado.
- Sigue bloqueada la distribución oficial de compilaciones firmadas con Android Debug. No desactivar Play Protect.

### Ensayo Android efímero propuesto

Se agregó el flujo `demo-android-ephemeral-smoke-stage142.yml` para compilar la APK de laboratorio en un runner estándar de GitHub Actions, comprobar el paquete, la firma y la versión, e intentar el recorrido de invitado en emulador Android. **No contiene carga de artefactos ni despliegue**: el instalador y las capturas permanecen temporales dentro del runner y desaparecen al terminar el trabajo. La ejecución y su resultado aún deben verificarse por separado; un resultado verde no autorizaría instalación en Samsung ni distribución.

**Criterio de salida:** revisión de la rama, pruebas Android en entorno aislado, firma y huellas verificadas; después prueba segura en Samsung de la misma referencia comercial, mensaje visible de actualización y conservación del historial. El proyecto sigue siendo exclusivamente DEMO.
