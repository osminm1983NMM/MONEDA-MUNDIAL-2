# Moneda Mundial 2.0 — Etapa 146: corrección del vínculo EAS Samsung LAB

Fecha: 28 de octubre de 2026. Base: etapa 145 (`f10aa231`). Alcance: **solo DEMO**.

## Hallazgo verificado

Durante la preparación de la primera compilación interna Android, el propietario inició sesión en EAS CLI como `12051983`. El comando `npx eas-cli project:info` falló con `Experience with id ... does not exist`.

En la pantalla **Details** del proyecto existente **Moneda Mundial 2.0** de Expo, el propietario comprobó:

- Owner: `12051983`
- Slug: `moneda-mundial-20`
- ID mostrado por Expo: `93c31760-4d1e-49f3-888b-9b5845c31e53`

En cambio, `app.json` y la prueba de contrato apuntaban a `93c31768-4d1e-49f3-888b-9b5845c31e53`. La diferencia está en un único carácter del primer grupo (último carácter: `8` en el código anterior, `0` en Expo).

## Corrección propuesta

1. Actualizar únicamente `expo.extra.eas.projectId` de `app.json` para que coincida con el proyecto existente de Expo.
2. Actualizar la prueba `tests/android-samsung-lab-variant.test.mjs` para conservar el nuevo ID como contrato de identidad.
3. Mantener sin cambios el propietario, slug, paquetes Android principal/LAB, perfiles de EAS, versión, saldos y lógica financiera.

## Puertas de salida

- Aprobar pruebas de contrato y CI del commit exacto de esta rama.
- En el Codespace, usar la rama de esta etapa y ejecutar `git status -sb` antes de compilar.
- Ejecutar `npx eas-cli whoami` y `npx eas-cli project:info`: debe resolverse el mismo propietario, slug e ID de Expo.
- Comprobar de nuevo cuota gratuita y factura; no aceptar upgrades ni cargos.
- Solo después, considerar `npx eas-cli build --platform android --profile samsung-lab`, con firma Android controlada por el propietario.
- Tras la compilación, revisar ID de paquete, versionCode, certificado/firma, SHA-256, permisos, procedencia y prueba aislada antes de proponer instalación en Samsung.

**Estado:** esta etapa corrige un vínculo de configuración. No se creó un proyecto EAS nuevo, no se inició ninguna compilación, no se generó ni distribuyó APK, no se instalaron aplicaciones, no se modificó Supabase y no se hicieron operaciones financieras. El dinero real y la emisión de Coin/Digital permanecen deshabilitados.
