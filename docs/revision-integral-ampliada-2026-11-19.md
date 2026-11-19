# Revisión técnica integral ampliada — 2026-11-19

**Alcance:** inspección directa de código React Native, funciones PostgreSQL, permisos SQL, conciliación contable y pruebas estáticas independientes. **Sin transferencias nuevas, sin escrituras SQL, sin recursos de pago y sin cambios en main.**

## Cliente Android / Expo
- Historial restringido explícitamente a operaciones del usuario además de RLS.
- Se conserva solicitud pendiente antes de enviar RPC, reintentos con el mismo UUID, recuperación por estado.
- Corregidos mensajes cuando RPC confirma pero no se puede refrescar saldo/historial; las lecturas fallidas limpian datos obsoletos.
- Corregido el tratamiento de respuestas obsoletas y retiro de rol administrativo en errores de sincronización.
- Cierre de sesión bloqueado durante operación/recuperación y error de almacenamiento local.
- Tests estáticos del repositorio ampliados en `tests/security-static.test.cjs`. **No se ejecutó `npm test` ni APK.** Se realizaron **16 comprobaciones estáticas independientes de contenido**, 16 conformes; esto no sustituye pruebas funcionales.

## Supabase: comprobación global de funciones privilegiadas
- **57** funciones `public.mwd_*` con `SECURITY DEFINER`; **56** ejecutables por `authenticated`, **0** ejecutables por `anon`.
- **57/57** tienen configuración explícita de `search_path`.
- Inspección textual: **35** incluyen llamada a `assert_owner()`, **21** incluyen `auth.uid()` y **1** restante es un trigger de alta de usuario, no ejecutable por `authenticated`. **Esta clasificación es solo un filtro textual; no demuestra que todas las funciones validen autorización de forma suficiente.**
- Verificadas directamente varias RPC de operaciones y propietario; las tablas privadas inspeccionadas no conceden permisos de lectura o escritura directa a usuarios autenticados.
- Los asesores Supabase aún advierten sobre `SECURITY DEFINER` y protección de contraseñas filtradas; estos avisos **no se han cerrado**.

## Conciliación SQL (solo lectura)
- 5 billeteras; 25 operaciones: 19 transferencias y 6 aportaciones.
- 0 solicitudes duplicadas por `actor_id,request_id`; 0 solicitudes sin identificador; 0 saldos negativos.
- Vistas de auditoría: 0 alertas de billeteras entre 5 revisadas; 0 alertas de libro mayor entre 19 transferencias.
- Son verificaciones de **estado actual**, no simulación de concurrencia ni certificación histórica completa.

## Bloqueos para declarar todo terminado
1. Ejecutar batería `npm test` en Node y compilar APK Android, instalar y revisar interfaces.
2. Ejecutar pruebas autenticadas A/B: doble envío simultáneo, corte de red, reintento y recuperación después de reiniciar.
3. Revisar manualmente autorización de las 56 funciones expuestas a `authenticated` y las rutas de pago/roles.
4. Resolver aviso de protección de contraseñas filtradas.
5. Para producción con dinero real, contratar proveedores autorizados y realizar cumplimiento regulatorio y auditoría independiente.

**Conclusión:** las verificaciones SQL de estado y la revisión estática consolidada están hechas; **no** se ha certificado funcionamiento integral en Android ni seguridad completa para dinero real.
