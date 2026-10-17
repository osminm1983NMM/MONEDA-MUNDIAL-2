# Cierre seguro DEMO: verificación posterior a despliegue
**Moneda Mundial 2.0 — 17 octubre de 2026**

## Diagnóstico del proyecto conectado
La base Supabase de pruebas todavía conserva la función de cierre ficticio SIN exigir consumo previo de código y NO tiene el RPC de capacidad `mwd_demo_payout_closure_capability` (consulta de solo lectura). El cliente Android mantiene ese cierre bloqueado hasta recibir la capacidad de forma segura. Ninguna ruta financiera real está activada.

La migración de prueba propuesta está versionada en `database/mwd_payout_closure_requires_code_demo.sql`, y pasó pruebas PostgreSQL aisladas, pero **eso no significa que esté instalada en Supabase**. La ejecución directa de la migración no se completó. No se intentará eludir controles de la plataforma ni aplicar cambios privilegiados mediante rutas alternativas.

## Verificación preparada
El archivo `scripts/VERIFICAR_CIERRE_SEGURO_SUPABASE_SOLO_LECTURA.sql` evalúa de forma **no destructiva**:
- Existencia y permisos de la capacidad de seguridad; invocador sin privilegios elevados.
- Existencia y ausencia de acceso anónimo a la RPC de cierre ficticio.
- Evidencia en la definición del servidor de controles de código consumido e identidad *simulada*.
- Cero rutas/corredores con dinero real y presencia de Honduras y Nicaragua.

Si algún control falla, devuelve `BLOQUEADO_POR_CONTROLES_PENDIENTES`.
Si todos los chequeos básicos pasan, devuelve `PASO_CONTROL_DEMO_PRELIMINAR`: **no** implica certificación ni autorización de pagos, ya que el cotejo textual del código es solo preliminar.

## Para cerrar el bloqueo de seguridad
1. Obtener autorización técnica para instalar la migración DEMO en el proyecto correcto mediante el procedimiento oficial que esté permitido.
2. Revisar dependencia y reversión, mantener todas las rutas reales deshabilitadas y tomar respaldo aprobado.
3. Ejecutar esta verificación en el servidor, con resultados guardados sin datos personales.
4. Probar rechazo de: usuario anónimo, cuenta ajena, código no consumido, identidad no simulada, código vencido/bloqueado, doble cierre y reintentos idempotentes.
5. Evaluar advertencias de Supabase (funciones `SECURITY DEFINER` públicas y protección contra contraseñas filtradas), realizar revisión independiente.
6. Solo después actualizar el estado de la incidencia #8. Nunca habilitar dinero real desde este procedimiento.

## Límites
Esta comprobación no inspecciona documentos, saldos ni secretos. No ejecuta funciones que cierren entregas, ni altera tablas. Los chequeos de definiciones son indicadores de código, no pruebas de autorización. La protección real depende de despliegue confirmado, tests de servidor y revisión experta.
