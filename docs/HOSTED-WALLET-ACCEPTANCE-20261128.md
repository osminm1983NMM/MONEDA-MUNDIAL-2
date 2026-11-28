# Aceptación HTTPS de billetera LAB — 28 noviembre 2026

## Alcance
El punto congelado 1ff2ee651bb480f594991d1b220f49ce21e8b9c6 no se modifica. La rama dev/hosted-wallet-acceptance-20261128 agrega una herramienta manual de comprobación. No crea cuentas, no siembra datos, no escribe en el diario ni utiliza fondos reales. La prueba offline [46164043535](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/46164043535) verificó 413/413 pruebas para 3d98ce852457a184276891c5325d1044606e7e5f, incluido rechazo de ejecución sin autorización. No demuestra aceptación HTTPS real.

## Condiciones previas
- Operador autoriza expresamente el proyecto LAB independiente y las dos cuentas sintéticas A/B ya enroladas; nunca las cuentas DEMO compartidas ni producción.
- Los dos snapshots deben provenir de wallet-acceptance-fixture.cjs, con el mismo exportedAt UTC exacto. A: DIGITAL_TEST 700, COIN_TEST 300 y una conversión confirmada; B: DIGITAL_TEST 100, COIN_TEST 0 y ninguna conversión. Valores en unidades menores ficticias, no dólares.
- Verificar por separado procedencia del snapshot, manifiesto, asociación privada A/B y barreras de entorno antes de ejecutar; el cliente no recibe el manifiesto y por tanto no lo certifica.
- Estación privada Node 22 con dependencias del lockfile. Inyectar desde almacenamiento privado las variables MWD_LAB_PUBLISHABLE_KEY, MWD_LAB_A_EMAIL, MWD_LAB_A_PASSWORD, MWD_LAB_B_EMAIL, MWD_LAB_B_PASSWORD, MWD_LAB_WALLET_EXPORTED_AT. No guardar secretos en Git, chat, capturas o logs. No usar claves privilegiadas.
- Solo cuando se autorice la comprobación, establecer MWD_CONFIRM_HOSTED_WALLET_PROOF=YES_AUTHORIZED_SYNTHETIC_ONLY y ejecutar node scripts/verify-hosted-wallet-proof.cjs. No ejecutar en CI con credenciales.

## Resultado exigido
1. Petición anónima denegada.
2. Dos sesiones con identidades distintas; coincidencia íntegra de ambos snapshots con fixture y fecha aprobados.
3. Cerrar A; A pierde acceso y B conserva su snapshot exacto.
4. Cerrar B; ambos tokens quedan sin acceso.
5. Cerrar todas las sesiones adquiridas incluso ante fallo. Registrar únicamente resultado, revisión, fecha y código genérico. Un fallo de red no acredita revocación.
6. Aceptación física posterior en la APK congelada: cuenta propia, aviso de saldo no vivo, fecha de snapshot, cierre de sesión y ausencia de datos residuales. No repetir pruebas previas sin necesidad.

No habilitar, reemplazar ni corregir snapshots alojados por inferencia. Si faltan datos o el resultado es negativo, detener aceptación y revisar con el titular. Esta prueba no valida reservas, emisión, precio comercial ni liquidación de dinero real.

## Evidencia y transporte del ejecutor
- [CI 46164176658](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/46164176658): 416/416, sin fallos, cancelaciones, omisiones ni TODO, revisión 03934aafb1049b3c2c4f46ce9f1d94a6af59c8c5. La revocación independiente se comprobó con dependencias simuladas.
- Se prepara una comprobación integral offline del ejecutor con cliente de cartera real y transporte/Auth inyectados; se limita el transporte al origen LAB fijo, con rechazo de redirecciones. [CI 46164538860](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/46164538860): 417/417 aprobadas, revisión 092778eaeb9df4d73bde38e0472f281dd95310b7, sin fallos, cancelaciones, omisiones ni TODO. El paso de negativa sin autorización y la comprobación de archivos rastreados también pasaron. No valida SDK Auth real, credenciales, TLS de la red ni autorización remota. No se conectó al proyecto alojado.

## Cierre de preparación offline
Comparación contra 1ff2ee651bb480f594991d1b220f49ce21e8b9c6: solo cuatro archivos nuevos de herramienta, pruebas, workflow y documentación. Sin cambios de código móvil, SQL alojado ni servidor financiero. Conservar el punto congelado. Presentar revisión en borrador para el complemento de aceptación; no fusionar automáticamente. El próximo hito de esta herramienta es la ejecución autorizada de HTTPS con las identidades sintéticas y el snapshot ya verificado, no más simulaciones equivalentes.