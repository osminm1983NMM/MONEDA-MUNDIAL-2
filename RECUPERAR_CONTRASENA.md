# Recuperación de contraseña — Moneda Mundial (modo demostración)

**Estado:** Se añadió al código de la rama de desarrollo; requiere configurar la plantilla de correo y compilar/instalar la APK actualizada. **No está operativo todavía en la APK previamente instalada.**

## Diagnóstico
Captura del 14-10-2026: en Supabase Authentication → URL Configuration, `Site URL` apunta a `https://snack.expo.dev/...` y no existen `Redirect URLs`. En esa página Snack no hay formulario de cambio de contraseña. Los enlaces de recuperación actuales por tanto llevan al entorno Snack y no completan la recuperación.

## Flujo nuevo propuesto y escrito en App.js
1. «¿Olvidaste tu contraseña?» abre formulario de correo.
2. `auth.resetPasswordForEmail(email)` solicita mensaje de recuperación.
3. Se muestra entrada «Código de 6 números».
4. `auth.verifyOtp({ email, token, type: 'recovery' })` valida código de un solo uso.
5. Con la sesión obtenida, `auth.updateUser({password})` establece contraseña nueva y cierra la sesión.

## Configuración manual necesaria EN SUPABASE
- Authentication → Emails → Templates → **Reset Password** (puede aparecer bajo Authentication → Email Templates según la versión del panel).
- Cambiar el cuerpo del mensaje de recuperación para que muestre un **código**, no el enlace:
```html
<h2>Moneda Mundial — Recuperación de contraseña</h2>
<p>Solicitaste restablecer tu contraseña.</p>
<p>Tu código de recuperación es: <strong>{{ .Token }}</strong></p>
<p>Introduce el código únicamente dentro de la aplicación Moneda Mundial.</p>
<p>Si no hiciste esta solicitud, ignora el mensaje.</p>
```
- Guardar la plantilla. No introducir contraseñas, tokens ni secretos en GitHub o soporte.
- Hasta tener una URL de dominio/app estable y un manejo de enlaces probado, **no cambiar Site URL a una dirección inventada ni utilizar Snack como destino definitivo**.
- Si todavía existen versiones antiguas de la aplicación, sus correos de recuperación podrían dejar de ser compatibles; planificar la transición.

## Plan de comprobación
- Compilar APK de la rama de desarrollo; probar en un dispositivo Android real.
- Solicitar OTP de correo de prueba, validarlo en la pantalla, cambiar contraseña y volver a entrar.
- Probar código erróneo, caducado, reutilizado, reenvío limitado por Supabase, email inexistente y ausencia de cuenta autenticada.
- Verificar que el flujo conserva saldo e historial y no expone tokens en logs.
- En producción revisar control de abuso, limitación de solicitudes, notificaciones de cambio y MFA.

**No se ha enviado correo, cambiado contraseñas ni modificado Auth del proyecto desde este documento.**
