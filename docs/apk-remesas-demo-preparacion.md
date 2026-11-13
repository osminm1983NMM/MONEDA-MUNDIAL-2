# Preparación de APK Android — remesas DEMO

## Estado comprobado
- Rama: `feature/remesas-demo-ui`; PR #120 en borrador; no fusionar a `main`.
- GitHub Actions #18: dependencias, pruebas de montos, configuración Expo y exportación JS Android aprobadas.
- Exportación JS **no** es APK instalable. No se ha instalado ni probado esta rama en el teléfono.
- El componente de remesas se muestra únicamente en Administración para `adminRole === 'owner'`.
- Operaciones US→HN **ficticias**, sin débito, entrega, transferencia ni pago real.

## Antes de solicitar una APK
1. Revisar que el perfil `preview` de `eas.json` genere APK Android y que el proyecto Expo coincida con el proyecto esperado.
2. Confirmar acceso y credenciales de firma de Expo/EAS, sin compartir secretos en GitHub ni en el chat.
3. Confirmar explícitamente posibles costos antes de iniciar una compilación remota.
4. Compilar exclusivamente la rama de pruebas, sin publicar en tiendas ni cambiar `main`.
5. Conservar la APK actualmente instalada hasta verificar que la nueva se descargue y abra.

## Pruebas en Samsung después de instalar
1. Iniciar sesión como propietario; entrar a Administración → Remesa internacional DEMO.
2. Crear borrador de $100.00 ficticios hacia Honduras; anotar referencia.
3. Pasar a revisión y completar simulación; comprobar que no se altera ningún saldo.
4. Crear otro borrador y cancelarlo; verificar estados y eventos.
5. Iniciar sesión con usuario sin rol de propietario; comprobar que no pueda operar remesas.
6. Cerrar y reabrir la app; registrar si el estado de la orden se conserva. **Limitación conocida:** el componente actual mantiene la orden en memoria, no recupera automáticamente una orden tras reiniciar.
7. Ante error de red, no repetir con monto distinto hasta confirmar si el servidor creó la orden. La idempotencia de la solicitud en memoria no sobrevive a reinicios.

## Criterios para avanzar
- APK descargada, firma e instalación verificadas.
- Navegación y botones probados en dispositivo real.
- Ningún movimiento de dinero real; ningún cambio inesperado en saldos.
- Revisión de recuperación e idempotencia antes de considerar operaciones reales.
