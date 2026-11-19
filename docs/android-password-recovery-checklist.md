# Recuperación de contraseña en Android — Moneda Mundial DEMO

Este procedimiento utiliza **solo cuentas de prueba**. No habilita pagos reales.

## Configuración requerida en Supabase

1. Abrir el proyecto de Supabase asociado a esta aplicación.
2. Entrar a **Authentication → URL Configuration**.
3. Añadir exactamente `monedamundial://auth/recovery` a **Redirect URLs** (sin reemplazar otras direcciones existentes).
4. Verificar que el proveedor de correo esté habilitado y que la plantilla de recuperación conserve el enlace de confirmación de Supabase.
5. Guardar los cambios. **No introducir la service_role key en el teléfono ni en GitHub.**

## Verificación en APK

1. Compilar e instalar una APK de la rama de desarrollo con el esquema de Expo actualizado.
2. En la pantalla de acceso, escribir el correo de una cuenta DEMO y tocar **Olvidé mi contraseña**.
3. Abrir el correo de recuperación **en el mismo Android**. El enlace debe abrir Moneda Mundial y mostrar **Mi cuenta** con el aviso de recuperación.
4. Establecer una contraseña nueva de al menos 12 caracteres y comprobar que se muestra el mensaje de éxito.
5. Cerrar sesión e iniciar sesión con la contraseña nueva. Verificar que la contraseña anterior ya no funciona.
6. Probar también un enlace vencido y un enlace de otra aplicación: ninguno debe conceder acceso.

## Limitaciones y seguridad

- La configuración de URL permitida en Supabase **no se cambia automáticamente** al modificar `app.json`.
- Los enlaces con tokens deben tratarse como secretos; no compartir capturas ni registros que los incluyan.
- El código reconoce tanto enlaces con tokens de sesión como enlaces PKCE con `code`; este último requiere que el verificador PKCE esté disponible en el mismo dispositivo y sesión donde se solicitó la recuperación. Ambas variantes necesitan pruebas en APK real.
- Las pruebas automáticas del repositorio son controles de código; **no reemplazan una prueba en APK real**.
