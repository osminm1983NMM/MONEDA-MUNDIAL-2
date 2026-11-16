# Puertas de salida — Android Moneda Mundial 2.0 (DEMO)

Estado: **NO APROBADO PARA LANZAMIENTO**. El proyecto solo usa créditos ficticios.

## Diagnóstico confirmado (2026-11-16)
- El workflow `.github/workflows/build-remesas-demo-apk-manual.yml` fija `ref: feature/remesas-demo-ui`.
- Las pruebas nuevas `tests/android-config-safety.test.cjs` y `tests/remesas-concurrencia.test.js` están en `pruebas-concurrencia-remesas`.
- Por tanto, el workflow de APK **no compila esta rama de pruebas**. No confundir una validación de una rama con una compilación de otra.
- La ejecución de GitHub Actions y la instalación en un dispositivo aún no están verificadas.

## Requisitos antes de generar el siguiente APK
1. Elegir una rama de integración de demostración y comparar los cambios con `feature/remesas-demo-ui`; conservar cualquier funcionalidad que solo exista allí.
2. Ejecutar `npm run test:demo` y las pruebas específicas de remesas de la rama que realmente se vaya a compilar.
3. Verificar `npx expo config --type public` y dependencias de Expo sin errores.
4. Hacer que el workflow de APK compile **la misma revisión** que pasó las pruebas, no una rama fija distinta.
5. Verificar disponibilidad de credenciales Expo/EAS y costo/cuota antes de lanzar el build.
6. Instalar el APK en Android y probar: acceso, billetera, actualizar saldo e historial, enviar/recibir MWD ficticios, reintentos, conversión Coin/Digital y remesas ficticias.
7. Revisar errores de pantalla, registros de prueba, recuperación de cuenta y desconexión.
8. Mantener fondos reales, emisión de criptoactivos y pagos comerciales deshabilitados.

## Criterio de cierre
No declarar Android terminado sin: pruebas automatizadas ejecutadas, APK construido e instalado, recorrido funcional documentado y ausencia de fallos críticos. No modificar saldos ni operaciones existentes para cumplir estos pasos.

## Comprobación de integración (2026-11-16)
- Comparación GitHub `main...pruebas-concurrencia-remesas`: `ahead_by=16`, `behind_by=0`; 12 archivos afectados.
- `App.js` y `RemittanceDemoScreen.js` de la rama de remesas fueron incorporados a la rama de validación; también sus pruebas originales.
- El workflow APK de la rama de validación ya apunta a `pruebas-concurrencia-remesas` y llama a `npm run test:demo`.
- **Limitación operativa:** los workflows `workflow_dispatch` normalmente deben estar presentes en la rama predeterminada para iniciarse desde la interfaz/API de GitHub Actions. No asumir que modificar solo la rama de desarrollo habilita el botón de ejecución; antes de intentar una ejecución manual, verificar su disponibilidad o preparar una integración revisada en `main`.
- No se pudo ejecutar `npm run test:demo` localmente en esta sesión: el entorno de ejecución no pudo resolver `github.com` para clonar el repositorio. Por tanto, no hay resultado de pruebas que reportar.
- No ejecutar EAS ni cambiar `main` hasta completar la revisión y los controles correspondientes.

## Revisión de solicitud de integración #122
- PR borrador: https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/pull/122
- GitHub reportó `mergeable=true`, `mergeable_state=clean` al consultar la API. Eso solo confirma ausencia de conflictos de fusión; **no aprueba pruebas ni seguridad**.
- Consulta de ejecuciones de Actions para `pruebas-concurrencia-remesas`: `total_count=0` en el momento de la consulta.
- Mantener PR como borrador hasta tener evidencias de pruebas y build. No fusionar solo por estar libre de conflictos.

## Evidencia CI aprobada (2026-11-16)
- GitHub Actions run: https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/43909734612
- Job `Configuracion y controles de demostracion`: `completed / success`.
- Pasaron JSON, suite `npm run test:demo`, instalación npm y `npx expo config --type public`.
- Esta validación NO es una compilación APK ni una prueba en dispositivo; no habilita dinero real.
- Siguiente puerta: evaluar credenciales EAS, cuota y costos antes de autorizar una compilación Android; después instalar y probar en Samsung.

## Intento APK y recuperación (2026-11-16)
- Ejecución APK https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/43910152291 falló en test estático (29/30): el workflow incluía `push` y violaba la regla de compilación manual.
- No se llegó a validar EXPO_TOKEN ni a ejecutar EAS; no se generó APK.
- Se restauró `workflow_dispatch` exclusivamente, commit `43be5bed16f27261389ce51d8191253c4655a74f`.
- Revalidación: https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/43910310504
- Próxima compilación requiere lanzamiento manual desde GitHub Actions y credencial EXPO_TOKEN; no insertar tokens en código, commits ni mensajes.

## Estado comprobado después de la primera instalación (2026-11-16)
- La ejecución de APK `43916794737` aprobó las pruebas, la configuración Expo y la autenticación del usuario robot con `EXPO_TOKEN`; GitHub canceló la espera tras aproximadamente 44 minutos, pero Expo recibió la compilación `6f7368c0-bcbf-4e5f-b497-851955c10676`.
- El usuario mostró el estado `Succeeded` de esa compilación en Expo y capturas de la aplicación ejecutándose en Samsung.
- En el dispositivo se observaron inicio de sesión, saldo ficticio, historial, creación de retiro ficticio por 1.00 MWD hacia Honduras y posterior consulta de la orden `pending`. No equivalen a una auditoría de contabilidad ni a pruebas de concurrencia reales.
- En la rama de desarrollo se adelantó el botón de cancelación de órdenes `pending` para mostrarlo antes de fechas y referencia. Este cambio NO está en el APK instalado.
- Se añadió un reintento visible de transición incierta para remesas administrativas de demostración, conservando el identificador de solicitud original. Tampoco está en el APK instalado.
- La ejecución CI `43931650319` terminó `success`: 32 pruebas aprobadas, 0 fallidas, y validación pública Expo satisfactoria. Evidencia: https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/43931650319
- Próxima puerta: autorizar una única nueva compilación EAS, instalarla y comprobar manualmente ambas mejoras. Mantener `main` y la base de datos sin cambios hasta nueva autorización.

## Precaución sobre la espera del APK
- El workflow actual ejecuta `eas build --wait` y tiene `timeout-minutes: 45`. Una compilación EAS en cola puede seguir ejecutándose aunque GitHub cancele la espera.
- Antes de reintentar una compilación, comprobar su estado en Expo para evitar consumos duplicados.
- No considerar `cancelled` en GitHub como prueba de que EAS canceló la compilación ni `Succeeded` en EAS como prueba de que todas las funciones de la aplicación están validadas.
