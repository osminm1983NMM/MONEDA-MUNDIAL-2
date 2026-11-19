# Auditoría integrada de seguridad y recuperación — 2026-11-19 (segunda pasada)

## Cambios efectivos en código
- `e246005`: recuperación de operaciones protegida con `recoveringRef` para bloquear pulsaciones repetidas antes de que React actualice el estado; se bloquea también el reintento y el cierre de sesión mientras se verifica.
- `bb70a29`: pruebas estáticas adaptadas al bloqueo sincrónico y dos nuevas verificaciones.
- Se mantiene filtrado de historial por participante, persistencia de solicitud antes de RPC, UUID de reintento constante, bloqueo por cuenta y mensajes que distinguen confirmación de lectura.
- El código no se ha compilado ni instalado en Android durante esta pasada.

## Supabase: inspección directa de permisos y políticas
- **6 tablas `public.mwd_*`** con RLS habilitado: `mwd_admin_roles`, `mwd_merchants`, `mwd_operations`, `mwd_payment_requests`, `mwd_profiles`, `mwd_wallets`.
- Ninguna de esas seis concede SELECT al rol `anon`; las seis permiten SELECT a `authenticated` condicionado por RLS.
- Las políticas SELECT de roles, perfiles y billeteras comprueban propietario `auth.uid() = user_id`; operaciones permiten origen o destino; comercios y solicitudes de pago permiten acceso al comercio propietario.
- Políticas de INSERT para comercios y solicitudes de pago incluyen predicados de propiedad; solicitud de pago nueva exige estado `pending`. UPDATE de comercios incluye `USING` y `WITH CHECK`.
- Privilegios de tabla observados: `authenticated` puede INSERT/SELECT en comercios y solicitudes de pago; perfiles SELECT (sin UPDATE directo en los grants consultados).
- Inventario anterior: 57 funciones públicas `mwd_*` `SECURITY DEFINER`, 56 ejecutables por `authenticated`, ninguna por `anon`, 57 con `search_path` configurado. La presencia de `auth.uid()` o `assert_owner()` no sustituye revisión funcional por RPC.

## Estado contable leído en esta revisión
- 5 billeteras, 25 operaciones (19 transferencias, 6 aportaciones).
- 0 referencias duplicadas, 0 referencias nulas, 0 billeteras negativas.
- Vistas de conciliación: 0 alertas para 5 billeteras y 19 transferencias.

## Pendientes bloqueantes para liberar
1. **Ejecución real de tests** `npm test`, pruebas A/B con identidades autenticadas y escenarios de concurrencia, caída de red y reinicio.
2. Compilar e instalar APK Android; verificar pantallas y flujos.
3. Inspección de autorización semántica de todas las RPC privilegiadas; evaluar avisos del asesor de seguridad.
4. Habilitar o revisar protección de contraseñas comprometidas de Auth.
5. Cualquier operación con dinero real requiere licencias/proveedor regulado, cumplimiento y auditoría externa.

## Precisión de los resultados
La revisión estática y las consultas SQL fueron reales, pero **no se han ejecutado transferencias nuevas ni se ha demostrado el comportamiento con interrupciones de red**. No declarar aprobación de pruebas dinámicas.
