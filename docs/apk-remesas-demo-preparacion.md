# Preparación de APK Android — remesas DEMO

## Estado comprobado
- Rama: `feature/remesas-demo-ui`; PR #120 en borrador; no fusionar a `main`.
- GitHub Actions #94 (13 de noviembre de 2026): instalación de dependencias, pruebas automáticas, configuración Expo y exportación JS Android aprobadas en la rama de desarrollo.
- Exportación JS **no** es APK instalable. No se ha instalado ni probado esta rama en el teléfono.
- El componente de remesas se muestra únicamente en Administración para `adminRole === 'owner'`.
- Operaciones US→HN **ficticias**, sin débito, entrega, transferencia ni pago real.

## Antes de solicitar una APK
1. Revisar que el perfil `preview` de `eas.json` genere APK Android y que el proyecto Expo coincida con el proyecto esperado.
2. Confirmar acceso y credenciales de firma de Expo/EAS; el flujo manual requiere el secreto `EXPO_TOKEN` configurado de forma segura en GitHub Actions. Nunca pegar el token en el chat ni en archivos del repositorio.
3. Revisar cuota, plan y posibles costos de Expo/EAS; obtener autorización explícita antes de iniciar una compilación remota. La validación JS #94 no verifica credenciales EAS ni produce una APK.
4. Confirmar que el flujo manual sea accesible en GitHub Actions (los flujos nuevos pueden requerir estar en la rama predeterminada para poder ejecutarse manualmente). No modificar `main` ni iniciar compilaciones sin aprobación. Compilar exclusivamente la rama de pruebas.
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

## Bloqueo confirmado de lanzamiento manual (13 de noviembre de 2026)
- El archivo `.github/workflows/build-remesas-demo-apk-manual.yml` existe en `feature/remesas-demo-ui`, pero la consulta del mismo archivo en `main` devuelve 404.
- GitHub Actions normalmente exige que un flujo `workflow_dispatch` exista en la rama predeterminada para aparecer y poder iniciarse desde la interfaz. Por tanto, no asumir que el botón «Run workflow» está disponible.
- No fusionar PR #120 ni copiar el flujo a `main` sin autorización expresa del propietario.
- Si se autoriza más adelante, una alternativa controlada es incorporar **solo** el archivo de flujo manual a `main`, manteniendo el `checkout` apuntando a `feature/remesas-demo-ui`; revisar y aprobar el cambio específico antes de aplicarlo.
- Antes de pulsar «Run workflow», confirmar que `EXPO_TOKEN` existe como secreto del repositorio, que Expo/EAS tiene acceso al proyecto y que el usuario aprueba el costo/cuota del build. La existencia del secreto no puede deducirse del YAML.
- Nunca enviar el valor de `EXPO_TOKEN` al chat. El APK anterior debe conservarse hasta verificar la nueva instalación.
