-- Moneda Mundial 2.0 · Etapa 129 · auditoría de metadatos de seguridad (SOLO LECTURA)
-- Ejecutar en el SQL Editor del laboratorio; NO modifica tablas, políticas, roles ni saldos.
-- IMPORTANTE: los resultados describen el catálogo. No sustituyen una prueba A/B
-- con dos JWT reales ni una revisión línea por línea de cada función SECURITY DEFINER.

-- 1. Ninguna tabla de la API pública debe carecer de RLS.
select c.relname as tabla,
       c.relrowsecurity as rls_habilitada,
       c.relforcerowsecurity as rls_forzada,
       case when c.relrowsecurity then 'OK_CATALOGO'
            else 'REVISAR_RLS_DESHABILITADA' end as resultado
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','p')
order by c.relname;

-- 2. Revisar políticas, comandos y usuarios habilitados.
-- La presencia de una política tampoco prueba que sea correcta.
select schemaname,tablename,policyname,cmd,roles,qual,with_check
from pg_catalog.pg_policies
where schemaname='public'
order by tablename,policyname;

-- 3. Superficie privilegiada: revocar acceso público anónimo y fijar search_path.
-- No revocar las 54 funciones en bloque: el cliente de DEMO depende de algunas.
select p.proname as funcion,
       pg_catalog.pg_get_function_identity_arguments(p.oid) as argumentos,
       has_function_privilege('anon',p.oid,'EXECUTE') as rol_anon_puede_ejecutar,
       has_function_privilege('authenticated',p.oid,'EXECUTE') as rol_autenticado_puede_ejecutar,
       exists (
         select 1
         from unnest(coalesce(p.proconfig,array[]::text[])) as config(valor)
         where config.valor like 'search_path=%'
       ) as search_path_explicito,
       case
         when has_function_privilege('anon',p.oid,'EXECUTE')
           then 'REVISAR_PERMISO_ANONIMO'
         when not exists (
           select 1
           from unnest(coalesce(p.proconfig,array[]::text[])) as config(valor)
           where config.valor like 'search_path=%'
         ) then 'REVISAR_SEARCH_PATH'
         else 'REQUIERE_REVISION_LOGICA'
       end as resultado
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prosecdef
order by p.proname,argumentos;

-- 4. Clasificación orientativa del control de identidad.
-- ATENCION: buscar una cadena no verifica que todos los accesos estén protegidos.
select p.proname as funcion,
       (p.prosrc ~* 'auth[.]uid[[:space:]]*[(]') as menciona_auth_uid,
       (p.prosrc ~* 'assert_owner[[:space:]]*[(]') as menciona_assert_owner,
       case
         when not (p.prosrc ~* 'auth[.]uid[[:space:]]*[(]'
                   or p.prosrc ~* 'assert_owner[[:space:]]*[(]')
           then 'PRIORIZAR_REVISION_MANUAL'
         else 'REVISION_MANUAL_AUN_PENDIENTE'
       end as resultado
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prosecdef
  and has_function_privilege('authenticated',p.oid,'EXECUTE')
order by p.proname;

-- 5. Puertas de rol owner usadas por RPC. Examinar su DEFINICION íntegra.
select n.nspname as esquema,pg_catalog.pg_get_functiondef(p.oid) as definicion
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('mwd_partners_private','mwd_remittance_demo_private')
  and p.proname='assert_owner'
order by n.nspname;

-- 6. Resumen informativo, NO certificación.
select count(*) as funciones_privilegiadas_publicas,
       count(*) filter (where has_function_privilege('anon',p.oid,'EXECUTE')) as ejecutables_por_anon,
       count(*) filter (where has_function_privilege('authenticated',p.oid,'EXECUTE')) as ejecutables_por_autenticado,
       count(*) filter (where not exists (
         select 1 from unnest(coalesce(p.proconfig,array[]::text[])) as cfg(valor)
         where cfg.valor like 'search_path=%'
       )) as sin_search_path_explicito
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prosecdef;
