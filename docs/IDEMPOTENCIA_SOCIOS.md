# Diseño propuesto: idempotencia de registros de socios (NO desplegado)

## Problema
Si una RPC guarda en Supabase pero el teléfono pierde la respuesta, el usuario no sabe si la escritura ocurrió. Los avisos del cliente no impiden duplicados en el servidor.

## Contrato propuesto
1. El cliente crea un UUID de solicitud **antes** del primer envío y lo conserva para reintentos de esa misma operación; un nuevo intento de negocio usa un UUID distinto.
2. Las RPC de creación reciben `p_request_id uuid` adicional. El servidor verifica la sesión y el propietario antes de consultar la clave de idempotencia.
3. Una tabla privada registra `(owner_user_id, operation_type, request_id)` con restricción UNIQUE y almacena una huella canónica de parámetros y el identificador del resultado. No almacenar documentos ni secretos.
4. La comprobación y la escritura de negocio ocurren en **una misma transacción**. La inserción única serializa solicitudes concurrentes con la misma clave. Nunca registrar «completada» antes de confirmar la escritura.
5. Mismo identificador + mismos parámetros: devolver el resultado original, sin crear otra fila ni otro evento de auditoría. Mismo identificador + parámetros distintos: error explícito de conflicto, sin escritura.
6. Las políticas y permisos deben impedir acceso directo a la tabla privada; sólo RPC autenticada del propietario, con `search_path` explícito, puede consultar o escribir.
7. Registrar también errores y transiciones de estado según reglas de negocio. Para operaciones irreversibles o financieras reales, se requerirá una revisión separada y controles adicionales.

## Pruebas requeridas antes de desplegar
- Primer envío crea exactamente un socio/sucursal.
- Repetir misma solicitud devuelve el mismo ID y no aumenta registros ni auditoría.
- Dos solicitudes concurrentes con la misma clave producen un único registro.
- Misma clave con datos diferentes devuelve conflicto.
- Clave de otro usuario no permite consultar datos ajenos.
- Caída antes del COMMIT deja la solicitud sin resultado confirmado y permite reintento seguro.
- Caída después del COMMIT devuelve el resultado original al reintentar.
- Intentos sin sesión o sin rol propietario son rechazados.

## Estado y riesgos
Este documento es **diseño**, no implementación ni autorización de migración. No modificar funciones actuales, tablas, políticas, saldos o datos reales sin revisar el SQL exacto, copias de seguridad y pruebas en un entorno aislado. La idempotencia no se obtiene sólo mostrando advertencias en el teléfono.
