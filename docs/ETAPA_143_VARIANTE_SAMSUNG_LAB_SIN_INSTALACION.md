# Moneda Mundial 2.0 — Etapa 143: variante Samsung LAB (solo DEMO)

## Objetivo

Preparar una futura compilación de prueba que pueda coexistir con la aplicación
actual de Osmin sin reemplazarla ni pedir desinstalarla. La etapa 142 pasó sus
pruebas de emulador, pero su APK temporal tenía certificado **Android Debug**;
la firma de la APK instalada aún no se ha cotejado.

## Separación explícita

| Identidad | Aplicación existente | Variante de laboratorio |
| --- | --- | --- |
| Nombre | Moneda Mundial 2.0 | Moneda Mundial LAB DEMO |
| Paquete | `com.monedamundial.app` | `com.monedamundial.app.samsunglab` |
| `versionCode` de partida | `2` | `1` (serie independiente) |
| Esquema de enlace | `monedamundial` | `monedamundiallab` |

`app.config.js` mantiene `app.json` intacto cuando no se elige variante.
El perfil EAS `samsung-lab` define la variable de construcción y el formato APK.
Un valor de variante inesperado causa error, no una compilación ambigua.

**Importante:** un paquete distinto permite instalación en paralelo, pero **no
verifica que una actualización sobre la aplicación antigua preserve sus datos**.
Tampoco significa que las dos instalaciones tengan los mismos datos locales,
ni aísla por sí solo las cuentas del servidor: para las pruebas autenticadas
se deberá utilizar una cuenta exclusivamente ficticia de laboratorio.

## Estado y puertas de seguridad

- Se añadió configuración y pruebas estáticas. **No se ha ejecutado EAS Build**.
- CI generó una **APK LAB temporal firmada con Android Debug** para probarla en emulador; se descartó sin subirla como artefacto ni ofrecerla para instalar. **No se ejecutó EAS Build ni se distribuyó una APK firmada para Osmin.**
- Antes de construir una APK interna: comprobar propietario del proyecto EAS,
  gestionar firma de laboratorio mediante credenciales seguras (nunca en Git),
  verificar paquete/versión/huella, ejecutar pruebas Android y revisar permisos.
- La entrega a Samsung requiere permiso explícito. No desactivar Play Protect.
- No desinstalar la aplicación existente; no tocar cuentas, fondos, base de datos,
  RLS, transferencias reales ni emisión de Coin/Digital.
- El PR de etapa 142 sigue en borrador y no se debe fusionar con `main` por esta etapa.

## Resultado que buscamos después

Probar «Actualizar saldo e historial» en la variante LAB, con mensaje visible
de éxito/error, 4 movimientos ficticios y ningún duplicado; después se estudiará
por separado una actualización firmada **sobre** la aplicación existente,
solo cuando se conozca el certificado original y la compatibilidad de versiones.

## Etapa 144 — vínculo EAS verificado, aún sin distribución

Osmin confirmó en el panel de Expo, desde su Samsung:

- Cuenta propietaria: `12051983`.
- Slug de proyecto: `moneda-mundial-20`.
- ID de proyecto: `93c31768-4d1e-49f3-888b-9b5845c31e53`.
- Enlace visible al repositorio GitHub `osminm1983NMM/MONEDA-MUNDIAL-2`.
- Sin compilaciones EAS de desarrollo ni de producción en ese momento.

`app.json` ya asocia esos datos de Expo con el código. El perfil
`samsung-lab` fija `android.image: latest`, `distribution: internal`,
`android.buildType: apk` y `MWD_APP_VARIANT=samsung-lab`.
**Nada de esto ejecuta EAS Build, genera credenciales ni instala una APK.**

Para una eventual compilación desde GitHub se preparó la rama
`test/mwd-samsung-eas-candidate-stage144`, que incorpora **ambas** propuestas:
etapa 142 (refresco del historial) y etapa 143 (paquete LAB). No construir
directamente desde la cabeza de la PR 108 porque no incluye por sí sola
el parche de la PR 107.

**Bloqueo de arranque de EAS:** según la [guía oficial de Expo para builds
desde GitHub](https://docs.expo.dev/build/building-from-github/), antes del primer
build remoto por esa vía se requiere una compilación inicial correcta con
EAS CLI para Android, además de la configuración del proyecto y las
credenciales autorizadas. Dado que Osmin trabaja desde un Samsung, ese
arranque necesita un procedimiento seguro adicional que él pueda
autorizar sin compartir contraseñas ni tokens por chat.

No pulsar `Build from GitHub` todavía. No habilitar envío automático a
tiendas, no crear rama de pago, no publicar APK ni usar cuentas reales
para pruebas. Se debe confirmar el aislamiento de cuentas de laboratorio
antes de pruebas autenticadas, ya que distintos paquetes Android no
separan por sí mismos la base de datos remota.
