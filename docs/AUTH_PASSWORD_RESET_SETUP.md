# Recuperación de contraseña — configuración y prueba

## Implementado en la app

- Botón “Olvidé mi contraseña” en el acceso.
- Solicitud por email mediante Supabase Auth, con respuesta genérica para no confirmar si un correo está registrado.
- Enlace profundo `com.monedamundial.app://auth/reset-password`.
- Intercambio PKCE del código por una sesión y formulario con confirmación de la nueva contraseña.
- PKCE requiere abrir el enlace en el mismo dispositivo donde se solicitó el restablecimiento, porque el verificador temporal se guarda localmente.
- Validación de enlace de recuperación, sesión, longitud mínima y coincidencia de contraseñas.

## Configuración pendiente en Supabase

En Supabase Dashboard → Authentication → URL Configuration, agrega esta dirección exacta en **Redirect URLs**:

```text
com.monedamundial.app://auth/reset-password
```

El enlace ya está registrado como esquema en `app.json`. No uses un comodín para producción. Si el proyecto usa una plantilla de email personalizada, confirma que su enlace respete la variable de redirección de Supabase.

## Prueba integrada requerida

Después de permitir la URL y generar una compilación Android con el esquema nuevo:

1. En el mismo teléfono Android donde se usará el enlace, solicita recuperación desde la pantalla de acceso.
2. Abre el correo y toca el enlace con la app cerrada; repite con la app abierta.
3. Verifica que la app muestre el formulario de nueva contraseña, no la billetera.
4. Envía una contraseña corta, contraseñas distintas y un enlace vencido; cada caso debe rechazarse con un mensaje claro.
5. Cambia la contraseña, cierra sesión e inicia sesión con la nueva.
6. Confirma que el enlace de recuperación no permite volver a cambiarla después de consumido.

La compilación CI confirma el bundle JavaScript, pero no comprueba la lista de redirecciones del proyecto ni el comportamiento del enlace en un teléfono. No se modificaron los ajustes de Supabase desde este cambio.

## Variante Android LAB Samsung — 2026-11-25

La compilación LAB usa un esquema distinto al de producción. Agregar también la URL exacta `com.monedamundial.lab.samsung://auth/reset-password` en Redirect URLs del proyecto de demostración. No sustituir la URL de producción ni usar comodines. La APK del run [45736122605](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45736122605) pasó instalación y apertura en emulador, pero no recuperación por correo. No se requiere recompilar únicamente por agregar la URL permitida del esquema LAB ya incorporado. Verificar primero que la APK instalada corresponde al artefacto auditado. Ejecutar los casos anteriores con una cuenta de prueba cuyo correo sea accesible; no registrar contraseñas, enlaces de recuperación ni tokens en capturas o documentos. La configuración del dashboard y la prueba física permanecen pendientes.
