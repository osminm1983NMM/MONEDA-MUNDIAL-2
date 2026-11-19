# Auditoría integral de preparación — 2026-11-19

**Alcance:** revisión estática del código en `main` de Moneda Mundial 2.0. No se han ejecutado transferencias, consultas SQL, builds Android ni pruebas en dispositivo en esta auditoría. Este documento no certifica seguridad ni cumplimiento regulatorio.

## Evidencia confirmada
- `package.json`: Expo ~54.0.0, React Native 0.81.4, Supabase JS ^2.
- `app.json`: Android package `com.monedamundial.app` y configuración EAS.
- `App.js`: usa clave **publicable** (no service_role) de Supabase; créditos MWD ficticios, no dinero real.
- `App.js`: transferencia y aportación por RPC con `p_request_id` reutilizado para reintentos de parámetros idénticos.
- `App.js`: `refreshAccount` consulta billetera, historial y rol; muestra mensaje de error si falla la lectura.
- `database/mwd_secure_partner_registry_demo.sql`: existe un archivo SQL para registro de socios; su existencia no demuestra que esté desplegado ni que sus políticas estén activas.

## Riesgos y puertas de salida (prioridad)
1. **Crítico — backend como autoridad:** verificar en Supabase, sin mutar producción, definición real de `mwd_transfer_demo`, `mwd_contribute_demo`, permisos EXECUTE, RLS y que los saldos nunca se actualicen directamente desde cliente. La UI no sustituye controles SQL.
2. **Crítico — idempotencia real:** comprobar que dos llamadas simultáneas con el mismo request ID crean exactamente una operación y un solo cargo; un reintento tras timeout debe devolver estado consistente. El identificador de cliente por sí solo no lo garantiza.
3. **Alto — acceso por usuario:** confirmar que `mwd_operations` devuelve exclusivamente movimientos autorizados del usuario actual; la consulta de `App.js` no filtra explícitamente por usuario y depende de RLS.
4. **Alto — cambio de sesión durante refresco:** `refreshAccount` consulta la sesión después de recibir datos; evaluar respuestas tardías, cierre de sesión y carreras entre solicitudes; comprobar que nunca aparezcan datos de la cuenta anterior.
5. **Alto — fallas de red:** probar timeout antes/después del commit, respuesta perdida, reintento, doble toque y recuperación del historial sin duplicaciones.
6. **Alto — conversión y retiro:** revisar atomicidad, cotización vencida, redondeos, límites, reversos y permisos de las RPC de conversión y retiro ficticio.
7. **Alto — Android:** ejecutar instalación limpia, arranque, login, navegación, cierre/reapertura y build en emulador antes de enviar APK a teléfono.
8. **Medio — reproducibilidad:** agregar lockfile, pruebas automatizadas y CI para evitar compilaciones incompatibles. No actualizar SDK sin una matriz de compatibilidad.
9. **Crítico antes de dinero real:** evaluación legal de remesas EE. UU. → Honduras, KYC/AML, sanciones, custodia, socios bancarios, privacidad, disputas y reembolsos.

## Matriz mínima de pruebas
| Caso | Resultado requerido |
|---|---|
| A envía 100 MWD a B | A -100, B +100, registro único y suma conservada |
| Dos solicitudes simultáneas mismo ID | Un solo cargo |
| Timeout después de registrar | Reintento devuelve operación existente |
| Saldo insuficiente | Ningún saldo ni asiento cambia |
| A intenta consultar billetera B | Acceso denegado por backend |
| Cerrar sesión durante refresh | No se muestran datos anteriores |
| Error de conexión al refrescar | Mensaje claro; sin éxito falso |
| Conversión ida y vuelta | Redondeo determinista y sin creación de valor |
| Cancelación de retiro dos veces | No duplica reembolso |
| APK Android en emulador | Instala, abre, autentica y no se bloquea |

## Reglas de ejecución
- No modificar `main` directamente; revisión mediante rama y PR.
- No ejecutar SQL de escritura en bases reales para una auditoría.
- No activar servicios facturables sin necesidad comprobada.
- No afirmar pruebas aprobadas sin logs o resultados reproducibles.
- Mantener todo como demostración ficticia hasta superar las puertas de seguridad y cumplimiento.
