# Moneda Mundial 2.0 — validación desde un teléfono Android

> Proyecto de demostración: créditos ficticios MWD. No envía ni recibe dinero real.

## Antes de ejecutar

- Trabajar únicamente en la rama `pruebas-contabilidad-mwd`, sin modificar `main`.
- Consultar en GitHub **Settings → Billing and licensing** el uso y límites de **Actions** de la cuenta. No ejecutar un workflow si el costo o los minutos disponibles no están claros.
- No introducir contraseñas, claves secretas de Supabase ni datos bancarios en GitHub Actions.

## Ejecutar las pruebas desde Samsung (solo después de confirmar costos)

1. Abrir [el repositorio](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2) en Chrome e iniciar sesión.
2. Ir a **Actions**. Si no aparece, activar **Sitio para computadora** en el menú de Chrome.
3. Seleccionar **Validar Moneda Mundial DEMO**.
4. Elegir **Run workflow**, seleccionar la rama `pruebas-contabilidad-mwd` y confirmar.
5. Abrir la ejecución y comprobar cada etapa. Guardar o compartir el texto de cualquier error.

El workflow ejecuta `npm run check:all`, `npm run check:dependencies` y `npm run check:android-bundle`.

**Importante:** el último comando exporta el bundle JavaScript para Android, **no genera una APK instalable**. Una APK requiere una compilación posterior y una revisión separada de sus posibles costos.

## Prueba funcional posterior (solo con cuentas ficticias)

1. Iniciar sesión en la cuenta A y revisar saldo e historial.
2. Crear una orden ficticia hacia Honduras; verificar su referencia y consultarla en **Mis retiros**.
3. Cambiar a la cuenta B y confirmar que no aparecen datos de A.
4. Probar COIN → DIGITAL y DIGITAL → COIN; revisar saldos e historial.
5. Si falla la red al crear una orden, consultar **Mis retiros** antes de reintentar para evitar duplicados.

No publicar la APK ni habilitar pagos reales hasta completar pruebas funcionales, controles de seguridad y requisitos regulatorios.
