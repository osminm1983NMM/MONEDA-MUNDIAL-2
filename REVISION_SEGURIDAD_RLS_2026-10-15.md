# Moneda Mundial 2.0 — revisión de seguridad del esquema financiero base
**Fecha:** 2026-10-15
**Entorno:** Supabase de demostración `egrsdrlpavrtbgxoyxvg`
**Estatus:** requiere decisión expresa del propietario antes de aplicar cambios de RLS. No habilita dinero real.

## Hallazgo priorizado: 4 tablas internas sin RLS

La inspección de esquema de Supabase marcó **RLS desactivado** en:
- `mwd_core.currencies`
- `mwd_core.countries`
- `mwd_core.country_currencies`
- `mwd_core.payment_corridors`

Se comprobó adicionalmente (2026-10-15) que los roles `anon` y `authenticated` **no tienen USAGE sobre el esquema `mwd_core`**, ni privilegios directos de tabla en ese esquema. Esto reduce la exposición actual por acceso directo, pero no justifica dejar RLS sin estudiar como defensa adicional. Es necesario revisar los grants y las funciones `SECURITY DEFINER` que podrían consultar o modificar el esquema con privilegios elevados.

**No se aplicó ninguna modificación de RLS.** Activar RLS sin políticas puede interrumpir funcionalidades existentes; el propietario debe aprobar la estrategia y SQL tras una revisión de dependencias.

### Propuesta de diseño de permisos (pendiente)
1. Clasificar `mwd_core` como esquema **solo de backend**; mantener revocados USAGE y acceso directo para `anon` y `authenticated`.
2. Comprobar las funciones y tareas internas que consultan tablas; limitar privilegios `SECURITY DEFINER`.
3. Evaluar habilitar RLS en cada tabla, dejando **sin políticas para clientes** si nunca deben entrar directamente (uso exclusivamente de rol de servidor autorizado), sujeto a ensayo en un entorno de pruebas.
4. Confirmar que las API de lectura al usuario final obtengan información exclusivamente por RPC filtradas, con permisos mínimos.
5. Verificar pruebas de regresión y revisión del propietario antes de promover a la versión principal.

SQL **propuesto, NO ejecutado**:
```sql
ALTER TABLE mwd_core.currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE mwd_core.countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE mwd_core.country_currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE mwd_core.payment_corridors ENABLE ROW LEVEL SECURITY;
```

No ejecutar estos comandos hasta decidir las políticas y probar las rutas.

### Otros avisos de Supabase
- `public`: 11 funciones `SECURITY DEFINER` accesibles a usuarios autenticados, creadas como RPC de demostración. **Revisar autorización interna `auth.uid()`, validación y permisos de roles caso por caso.** La advertencia no demuestra por sí sola un fallo.
- Protección contra contraseñas filtradas desactivada; requiere configuración de Auth en el panel de Supabase.
  Referencia: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Seis tablas de `mwd_finance_private` mantienen RLS habilitado sin políticas; en un esquema privado, sin acceso de cliente, puede ser intencional.
- `mwd_core` y `mwd_finance_private` no tenían permisos `USAGE` asignados a roles de API `anon`/`authenticated` en la inspección.

## Optimización realizada por separado
Migración `index_mwd_core_fk_and_private_ledger`: añadidos 6 índices no destructivos a claves foráneas de `mwd_core` y `mwd_finance_private.ledger_entries`.
Los avisos de claves foráneas sin índices desaparecieron; nuevos índices pueden aparecer como temporalmente «unused» hasta recibir consultas. No se tocaron saldos, usuarios o permisos.

## Estado de pagos reales
El catálogo registra 249 países y 19 corredores **solo de simulación**, con 0 corredores de pagos reales habilitados. **No** se deben modificar estos flags hasta contar con autorizaciones y socios regulados.

## Referencia
https://supabase.com/docs/guides/database/postgres/row-level-security

**Acción pendiente:** propietario confirma si las cuatro tablas se mantendrán 100 % privadas del cliente y autoriza una migración posterior de RLS con pruebas previas. No se debe ofrecer SQL como algo ya ejecutado.

## Revisión complementaria de dependencias — 2026-10-15

- Inspeccionadas funciones públicas y funciones internas: ninguna función definida bajo `public`, `mwd_finance_private` o `mwd_core` contiene una referencia directa explícita a `mwd_core.` en el cuerpo de su definición. **La búsqueda textual no descarta SQL dinámico ni dependencias indirectas; por ello no sustituye una prueba en staging.**
- Las cuatro tablas son propiedad de `postgres`; los roles `anon`, `authenticated` y `service_role` no tienen permisos directos de tabla comprobados, y los dos primeros tampoco tienen USAGE en ese esquema.
- Catálogo técnico observado: 3 monedas, 2 países, 2 combinaciones país-moneda y un corredor técnico; ninguno tiene estatus `authorized`. Hay 4 billeteras, 9 operaciones y 2 solicitudes de prueba. Cero rutas de dinero real habilitadas.
- Guardadas dos herramientas de revisión en GitHub:
  - `scripts/PROPUESTA_ACTIVAR_RLS_MWD_CORE_NO_EJECUTAR.sql`, con comprobaciones de permisos y cuatro sentencias `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` en transacción.
  - `scripts/VALIDAR_RLS_MWD_CORE_READONLY.sql`, consultas no destructivas para antes/después de la migración.
- La migración RLS **no se ejecutó**, porque requiere revisión de dependencias en staging y confirmación específica del cambio de control de acceso. La evidencia recopilada es revisión estática y consultas directas, no una prueba E2E autenticada.
