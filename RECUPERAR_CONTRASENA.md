# Recuperar contraseña — Moneda Mundial 2.0 (demostración)

## Estado real
El flujo que existe en App.js usa un **enlace de recuperación**, NO códigos introducidos manualmente. Esta funcionalidad aún necesita una prueba completa de extremo a extremo en Android.

## Cómo debe funcionar
1. Desde la pantalla de acceso, seleccionar «¿Olvidaste tu contraseña?».
2. Introducir el correo de la cuenta y pulsar «Enviar enlace de recuperación».
3. Supabase ejecuta `auth.resetPasswordForEmail(email, {redirectTo: 'monedamundial://auth/recovery'})`.
4. La persona abre el correo y el enlace seguro en el **mismo teléfono** donde está instalada la APK.
5. Supabase debe redirigir a `monedamundial://auth/recovery` con una sesión de recuperación válida; la aplicación debe reconocer el deep link y abrir «Nueva contraseña».
6. La persona establece una contraseña única de 12 caracteres o más, la confirma, y la app invoca `auth.updateUser({password})` y cierra la sesión.
7. Verificar que puede iniciar sesión otra vez y que saldo e historial ficticios se conservaron.

## Configuración previa y advertencias
- `app.json` contiene `scheme: monedamundial`.
- En Supabase Auth → URL Configuration debe figurar **exactamente** `monedamundial://auth/recovery` en Redirect URLs.
- La Site URL actual apunta a un prototipo de Expo Snack; no se debe asumir que esa dirección sirve para recuperación en producción ni modificarla sin plan de migración.
- La plantilla predeterminada de Supabase envía un enlace; no se requiere personalizarla para usar este flujo, pero sí verificar los enlaces reales y el servicio de envío.
- No pedir ni compartir contraseñas, códigos, fragmentos del enlace de recuperación ni tokens.
- No iniciar la primera prueba en la única cuenta de propietario que funciona. Usar primero una cuenta de ensayo que pueda recuperar su acceso.
- Probar también enlaces caducados, reutilizados, cancelación, errores de correo y apertura del enlace sin la app instalada.
- Revisar la configuración antispam, límites de intentos, MFA, autenticación reciente y registros de seguridad antes de salir del modo demostración.

**Ningún paso de esta guía requiere dinero real.**
