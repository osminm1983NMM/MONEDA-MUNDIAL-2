# Moneda Mundial 2.0 — Etapa 145: preflight EAS de Samsung LAB (DEMO)

Fecha: 26 de octubre de 2026. Base de revisión: `test/mwd-samsung-eas-candidate-stage144` (`a60b6a9`).

## Objetivo y alcance

Preparar una primera compilación Android **interna y ficticia**, separada de la aplicación Samsung existente. No se hizo ninguna compilación EAS, instalación, cambio de credenciales, transferencia, ajuste de RLS o modificación de cuentas. Estos cambios se proponen para revisión en una rama de la etapa 145, sin alterar `main` ni la rama base de la etapa 144.

## Ajustes propuestos

1. Fijar `build.samsung-lab.android.image` en `sdk-54`, en vez de `latest`. El código usa Expo SDK 54 y Expo documenta un alias específico `sdk-54`; usar el alias reduce la variación del entorno de compilación.
2. Incorporar `package-lock.json` para registrar las versiones de dependencias instaladas y facilitar instalaciones reproducibles. Revisar el lockfile antes de integrarlo y preferir `npm ci` en los flujos CI una vez validado.
3. Ajustar la prueba `android-samsung-lab-variant.test.mjs` para exigir la imagen `sdk-54`.

## Verificaciones realizadas

- `EXPO_NO_TELEMETRY=1 npm test`: **476 pruebas aprobadas, 0 fallidas** (99 archivos).
- `npm test` desde el Codespace Samsung conectado a la rama de la etapa 144: **476 aprobadas, 0 fallidas**. Se detuvo el Codespace después de las comprobaciones para limitar el uso de recursos gratuitos.
- Identidades Expo resueltas: principal `com.monedamundial.app` con `versionCode 2`; LAB `com.monedamundial.app.samsunglab` con `versionCode 1`.
- `expo-doctor`: 15 de 18 comprobaciones completadas inicialmente. Detectó ausencia de lockfile, corregida en esta propuesta. Las otras dos comprobaciones dependían de la API de Expo y fallaron por `EAI_AGAIN exp.host` en el entorno de verificación; **no deben interpretarse como defectos confirmados del código**. Deben repetirse cuando la conexión sea estable.
- La cuenta Expo `12051983` mostró el 26 de octubre el plan **Free ($0/mes)**, **0/15 compilaciones Android** y factura estimada **$0.00**. La cuota gratuita no sustituye la verificación posterior de cualquier confirmación de coste.
- Ningún cambio se ha aplicado al servidor de pagos, a Supabase, al teléfono ni a la rama principal del repositorio.

## Requisitos antes de construir o distribuir

1. Volver a verificar el saldo gratuito en la cuenta Expo propietaria `12051983` antes de ejecutar EAS; se observaron 0/15 compilaciones Android el 26 de octubre. El proyecto esperado es `moneda-mundial-20` (ID `93c31768-4d1e-49f3-888b-9b5845c31e53`). No aceptar upgrades ni cargos.
2. Confirmar autenticación del propietario mediante EAS CLI, sin compartir contraseñas, códigos ni tokens por chat.
3. Verificar el origen y referencia exacta de código que se compilará y usar el perfil `samsung-lab` exclusivamente.
4. Crear o gestionar de forma segura el certificado de firma Android del paquete LAB; nunca añadir claves de firma al repositorio público.
5. Comprobar identidad, versión, hash SHA-256, firmante, permisos y resultado de una prueba Android aislada antes de proponer instalación en Samsung.
6. Para pruebas autenticadas, usar solamente una cuenta ficticia de laboratorio; tener un paquete Android separado no aísla la base de datos remota.

**Bloqueo:** no instalar ni publicar una APK todavía. No desinstalar la aplicación existente, no desactivar Play Protect, y no operar con dinero real.

Referencias oficiales:
- https://docs.expo.dev/build-reference/infrastructure/
- https://docs.expo.dev/build/setup/
- https://docs.expo.dev/build/building-from-github/
- https://expo.dev/pricing
