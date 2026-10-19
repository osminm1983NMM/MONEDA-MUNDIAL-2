# Moneda Mundial 2.0 — validación en Samsung desde un solo teléfono
**Fecha:** 19 de octubre de 2026 · **Tipo:** laboratorio con créditos ficticios.

## APK verificada de esta etapa (evidencia confirmada en GitHub Actions)

- **Commit exacto del código compilado:** `8a003a7cbc6344766903d7995da642530c3e635f`.
- **Run de compilación y arranque:** https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/39319745682
- **Resultado:** `success` en ambos trabajos: compilación Android y arranque en emulador con aviso de demostración.
- **Artefacto a descargar:** `moneda-mundial-demo-apk-arranque-verificado` (identificador `12219638940`).
- **Enlace directo al artefacto de GitHub:** https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/39319745682/artifacts/12219638940
- **Caducidad aproximada del ZIP:** 26 de octubre de 2026 a las 20:39 UTC; comprobar antes de descargar.
- **Importante:** una revisión posterior del documento o del repositorio NO significa que la APK corresponda a ese commit posterior. Esta APK corresponde exactamente al identificador indicado arriba.

**Sin necesidad de computadora:** desde el Samsung iniciar sesión en GitHub, abrir el enlace del artefacto, descargar el ZIP, abrir **Mis archivos → Descargas → Extraer**, y localizar `app-release.apk`. Si la instalación exige ignorar controles de seguridad, detenerse. Si hay una versión previa con operación DEMO pendiente, no desinstalar para cambiar de firma: primero resolver su estado.

**Alcance:** la prueba automatizada verificó que se instala e inicia **sin iniciar sesión** en un emulador Android. No valida funcionamiento en un Samsung físico ni confirma login, MWD/COIN/Digital autenticados o servicios financieros reales.

## Regla de entrada: no instalar compilaciones sin verificar
1. Comprobar que el flujo «Compilar APK Android de demostración» haya terminado con **success**, incluyendo el segundo trabajo **Instalar APK del mismo commit y verificar aviso DEMO**.
2. Abrir GitHub Actions del flujo **exacto** y descargar de **Artifacts** solamente `moneda-mundial-demo-apk-arranque-verificado` (ZIP con `app-release.apk`). Confirmar commit/run. Los ZIP caducan a los siete días.
3. No usar una compilación intermedia `moneda-mundial-demo-android-apk` como sustituto del artefacto verificado si el trabajo de arranque todavía no pasó.
4. Extraer desde **Mis archivos → Descargas** y ejecutar APK solo si Android lo permite sin saltarse alertas; **no desactivar Play Protect ni controles empresariales**.
5. Firma temporal: actualizar sobre otra firma puede ser imposible. **No desinstalar si hay operaciones DEMO pendientes**; eliminar la app puede borrar los datos locales necesarios para reconciliar.
6. El emulador verifica solo arranque/acceso y rótulo DEMO; NO verifica inicio de sesión en Samsung, MWD, COIN, Digital ni pagos.

## Matriz de prueba manual (dos cuentas propias de ensayo, ningún dato financiero)

| ID | Qué probar desde el Samsung | Criterio para aprobar |
|---|---|---|
| SM-01 | Abrir APK con red | Aparece `SOLO DEMOSTRACIÓN / SIN DINERO REAL` o equivalente en inglés; no pide pagar |
| SM-02 | Idioma: Automático → English → Español; salir y reabrir | Portada e Internacional muestran el mismo idioma; la preferencia elegida permanece |
| SM-03 | Crear/iniciar sesión de cuenta A de prueba | Cuenta, saldo e identificador MWD propios; no confundirlos con fondos reales |
| SM-04 | Abrir planificación internacional | Elegir US→HN o US→NI, cualquier método; dice `NO HABILITADA`; no cotiza ni envía |
| SM-05 | Buscar Nicaragua, México y un código ISO menos frecuente | Presenta sugerencias válidas y permite seleccionar el destino sin eliminar otros países |
| SM-06 | Realizar una transferencia **MWD ficticia** pequeña de A hacia B y comprobar recibo | A pierde exactamente el monto de prueba; B recibe el mismo; un solo registro |
| SM-07 | Cerrar sesión de A; entrar B, consultar historial y regresar a A | Nunca aparece historial de la otra cuenta ni su rol |
| SM-08 | Abrir Coin ↔ Digital, cotizar y confirmar solo créditos ficticios | Resultado/historial y saldos separados; nunca se representa como activo emitido |
| SM-09 | Si una operación aparece `pendiente`, utilizar SOLO «Consultar estado» | No reintenta con otra referencia; si es incierta, no declara éxito ni libera operación nueva |
| SM-10 | Sin datos bancarios: visualizar modos de retiro y beneficiario | Se etiquetan como DEMO o planificación; nunca ofrecen pago real |

**No provocar deliberadamente fallos de conectividad durante un cargo ficticio en proceso si no hay respaldo de la referencia.** Solo simular una caída de red con una cotización nueva sin confirmar, y documentar qué ocurre. Si queda operación pendiente, no empezar otra, no borrar almacenamiento, no cerrar cuentas a ciegas.

## Registro de resultados
Se recomienda anotar por cada ID: `PASS / FAIL / NO PROBADO`, versión APK, commit GitHub, run de Actions, fecha/hora, comportamiento observado y texto de error. Nunca publicar correos, contraseñas, tokens, identificadores de clientes, códigos de retiro, QR ni datos de cuentas.

## Bloqueadores del lanzamiento
- Saldo ajeno visible, cuenta incorrecta o historial cruzado.
- Cargo ficticio duplicado o confirmación falsa de operación incierta.
- Ausencia de aviso de demostración.
- APK no verificada por GitHub/Android, o alerta de seguridad que obligue a desactivar protección.
- Solicitud de dinero real, credenciales bancarias, documentos de identidad o activación de proveedores sin contrato.
- Caída reproducible o pantalla ilegible en dispositivo Samsung.

**No certifica pagos ni criptomonedas:** Coin y Digital son demostraciones; no existen tokens emitidos, proveedores bancarios activos ni transferencias reales. Para operación comercial se requerirán integraciones reguladas, licencias o figuras jurídicas aplicables y pruebas independientes.
