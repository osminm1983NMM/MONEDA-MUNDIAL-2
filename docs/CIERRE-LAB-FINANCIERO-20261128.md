# Punto de cierre técnico del LAB financiero — 28 noviembre 2026

## Alcance y evidencias
- Candidata Android instalada: ec1477daf5e7afc7919a38892180c59322b77ef0. No se recompila por los cambios de servidor local. [APK CI](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/46088465052), [regresiones exactas 137 Android/Auth + 387 financiero](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/46154437285).
- Frontera revisada de Android y artefactos alojados: 2/2 [CI 46154517224](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/46154517224).
- Revisión del laboratorio financiero cc6211383e04f19eb474c779d6be4dd0344b871b: [400/400 pruebas Node, job 141016396083](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/46157211493). Cero fallos, cancelaciones, omisiones o TODO. Las 97 pruebas focalizadas de esa ejecución son subconjunto; no sumarlas.
- [PostgreSQL 46156721924](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/46156721924): job 141014889629 success, checkout exacto 2e569d1cdca42ecee31925a1bb214964694b44e9. Incluye protección de nombre DB, SQL transaccional, conciliación, recuperación de proveedor, roles USD/HNL, restauración en clúster independiente y concurrencia. Los cambios posteriores hasta cc62113 son exclusivamente proveedor/cola SQLite sintéticos, sus tests y workflows; no se atribuye una ejecución PostgreSQL a cc62113.
- Rama main verificada en 3f2fbdb7ffb5d6c75b8c56d41b4d1fa98ef64ffc. Sin fusión ni despliegue. No guardar datos personales o secretos.

## Cambios del servidor local aislado
1. 246565f: rechazo de metadatos contradictorios, longitud efectiva y cancelación de flujos de entrada de remesas.
2. df0bd42: cancelación de entradas y desconexión de cartera, capacidad retenida hasta que termine la operación.
3. 266fe6f: validar respuesta serializada exacta y límites de salida para impedir campos privados inesperados.
4. 2e569d1: fijar campos propios de identidad, rechazar accesores y atributos extra.
5. cac67f4: coherencia de payload persistido y eventos del proveedor sintético antes de firmar replay.
6. cc62113: comprobante persistido debe conservar contenido, huella, firma determinista y metadatos válidos antes de aceptar duplicado.

Los hashes y comprobaciones de coherencia local no constituyen prueba de integridad contra un atacante con control total del almacenamiento o de las claves. No hay contrato ni transporte Thunes real en estos cambios.

## Automatización consolidada
Commit f4fe9b70b582aa0650b5ede09ae3ecad5274993a: todas las modificaciones bajo financial-sandbox/ y tests/financial/ activan la suite completa en la rama de laboratorio. Se elimina la ejecución redundante del subconjunto y se comprueba el lockfile y la ausencia de cambios de archivos rastreados. Resultado pendiente al registrar.

## Puertas restantes
- Mantener congelada la candidata móvil y reservar aceptación física diferencial hasta que el titular la solicite; no repetir instalación, selector e identificación visibles ya observados. Ver acta CIERRE-LAB-UNIFICADO-20261127.md.
- Integración oficial de remesas: respuesta escrita, elegibilidad, credenciales de sandbox, pagador USD/HNL, contrato de estados y conciliación, pruebas externas. No simular disponibilidad oficial.
- Activos Digital/Coin: custodia, reservas, emisión, red, precio y cumplimiento autorizados; activos sintéticos no tienen valor monetario.
- Producción: autorización expresa, revisión jurídica, contable y de seguridad, firma comercial Android, configuración de identidad, monitoreo y recuperación del entorno autorizado.
- No confundir las regresiones del laboratorio con autorización de operaciones reales. Evitar ciclos indefinidos de pruebas marginales; priorizar defectos concretos y puertas de aceptación que puedan cerrarse sin intervención.
