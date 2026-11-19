# Protocolo de aceptación Android y transferencias ficticias — 2026-11-19

## Alcance y criterios
Aplicación de demostración con créditos MWD ficticios. No ingresar datos bancarios reales, no usar dinero real, no habilitar producción. Mantener rama `main` sin cambios.

### Puerta 1: artefacto
- [ ] Workflow `Build Android LAB APK (demo only)` termina **success** para el SHA que se va a instalar.
- [ ] Artefacto incluye `moneda-mundial-lab-debug.apk` y `SHA256SUMS.txt`.
- [ ] APK contiene `assets/index.android.bundle` o `assets/index.bundle` para iniciar sin Metro.
- [ ] Verificar suma SHA-256 y conservar referencia de SHA del commit.
- [ ] Instalar en Samsung Android, abrir sin Expo Go ni servidor Metro y confirmar aviso «SOLO DEMOSTRACIÓN».
- [ ] Si Android informa bloqueo de instalación, verificar procedencia del archivo; no desactivar protecciones generales del teléfono.

### Puerta 2: autenticación y navegación
- [ ] Cuenta A inicia sesión y muestra su propio código, saldo e historial.
- [ ] «Actualizar saldo e historial» responde; errores de red muestran aviso y no saldo antiguo.
- [ ] Navegar a Historial; renovar token en segundo plano y comprobar que la pantalla no salta a Inicio.
- [ ] Cerrar sesión y entrar como B: nunca ver datos de A.
- [ ] Cuenta sin rol propietario no puede registrar socios.

### Puerta 3: operaciones A/B (anotar saldos antes y después)
- [ ] A transfiere 1.25 MWD ficticios a B. A disminuye 1.25, B aumenta 1.25; historial registra una sola operación.
- [ ] B transfiere 0.01 a A, verificar ambos saldos e historial.
- [ ] Rechazar monto cero, negativo, más de dos decimales, mayor de 1,000,000, saldo insuficiente, destinatario propio y código inválido.
- [ ] Pulsar dos veces «Confirmar» rápidamente: no duplicar la operación.
- [ ] Aportación de prueba de 0.01 MWD: descuento único y registro de historial.
- [ ] Comparar conteo de operaciones y referencias con consultas de auditoría de solo lectura.

### Puerta 4: red, recuperación y cambios de cuenta
- [ ] Desactivar red justo después de enviar solicitud (simular respuesta perdida); no volver a generar ID de operación.
- [ ] Volver a conectar y usar «Verificar operación pendiente»; confirmar resultado sin duplicar descuento.
- [ ] Si Supabase confirma que no se procesó, usar «Reintentar misma solicitud» y verificar que reutiliza ID.
- [ ] Durante recuperación, probar pulsaciones repetidas y confirmar que solo hay una verificación.
- [ ] Cerrar y reabrir la app con referencia pendiente: se conserva para la misma cuenta.
- [ ] Comprobar cambio de sesión A→B sin que se ejecute una operación antigua de A.
- [ ] Si falla almacenamiento local, bloquear nuevas operaciones y evitar presentar éxito incierto.

### Puerta 5: seguridad y cierre
- [ ] Verificar RLS por usuario autenticado y accesos RPC; pruebas con JWT reales de A y B (no solo SQL como administrador).
- [ ] Revisar funciones SECURITY DEFINER y protección de contraseñas filtradas.
- [ ] Validar cero saldos negativos, cero request_id duplicados y conciliación del libro contable.
- [ ] Registrar versión, capturas de las pantallas necesarias, resultado, incidente y corrección por cada prueba.
- [ ] No declarar lista para dinero real: requiere proveedor regulado, AML/KYC, análisis legal, antifraude y pruebas independientes.

## Política de ejecución
Primero completar las puertas automatizables sin intervención del propietario. Solicitar capturas o pulsaciones únicamente cuando el APK esté disponible y la prueba necesite el dispositivo. Evitar nuevos commits que disparen otra compilación mientras una ejecución esté en curso.
