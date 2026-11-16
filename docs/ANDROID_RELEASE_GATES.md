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
