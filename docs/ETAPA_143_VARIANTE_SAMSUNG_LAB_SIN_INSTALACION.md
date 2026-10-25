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
- **No se generó, subió, publicó ni instaló ninguna APK**.
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
