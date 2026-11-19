# Preparación de APK de prueba — Moneda Mundial 2.0

**Estado:** exportación JavaScript Android comprobada en GitHub Actions. **APK nativa aún no generada ni instalada.** Los saldos MWD son ficticios.

## Compilación de instalación (cuando se autorice el uso de EAS)

- Rama: `fix/pickup-retry-idempotency-20261119` (no usar `main`).
- Configuración Expo: `app.json` con paquete `com.monedamundial.app`, esquema `monedamundial` y EAS projectId.
- Perfil: `preview` en `eas.json`, con `distribution: internal` y `android.buildType: apk`.
- Comando desde el repositorio con Expo/EAS autenticado: `npx eas-cli build --platform android --profile preview`.
- No compartir credenciales de Expo, claves privadas de firma ni tokens en chats o registros.

## Pruebas obligatorias en Android

1. Instalar APK, abrirla, cerrar y volver a abrir. Confirmar que no se bloquea.
2. Registrar dos cuentas DEMO con correos de prueba; confirmar correo si Supabase lo exige.
3. Verificar 10,000 MWD ficticios iniciales en cada cuenta.
4. Enviar una transferencia A → B. Comprobar débito, crédito e historial en ambas.
5. Repetir una solicitud con el mismo identificador de operación. No debe duplicarse el movimiento.
6. Interrumpir la red durante una transferencia. No crear una segunda operación si el resultado es incierto; recuperar y consultar el estado original.
7. Probar cotización, vencimiento y conversión COIN ↔ DIGITAL sin dinero real.
8. Crear, consultar y cancelar una orden de retiro ficticio; verificar reintentos.
9. Solicitar recuperación de contraseña. Confirmar que el correo abre `monedamundial://auth/recovery` y permite cambiarla.
10. Cerrar sesión e iniciar sesión con la nueva contraseña. Verificar que el acceso anterior no funcione.
11. Comprobar que un usuario sin rol propietario no puede ejecutar acciones administrativas.
12. Comprobar botones de actualizar saldo/historial y volver al inicio.

## Dependencias externas pendientes

- Confirmar en Supabase Authentication → URL Configuration que `monedamundial://auth/recovery` está autorizado.
- Para construir la APK se requiere una sesión Expo/EAS con permisos del proyecto; el export JS por sí solo no genera el instalador.
- Las pruebas de dos cuentas y red interrumpida requieren una APK y acceso controlado a las cuentas DEMO.

**No habilitar pagos reales ni publicar como producto financiero hasta completar cumplimiento, proveedores regulados y auditoría.**
