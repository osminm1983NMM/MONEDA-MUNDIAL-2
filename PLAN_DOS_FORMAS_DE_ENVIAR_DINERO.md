# Moneda Mundial 2.0 — Dos modalidades de transferencia (decisión de producto)

Fecha: 2026-10-14. Estado: **diseño futuro; no hay operaciones reales habilitadas**.

El propietario aprobó integrar **ambas** formas de uso:

1. **Billetera con saldo real futuro:** el usuario puede recargar fondos con una cuenta bancaria o tarjeta admitida por un proveedor autorizado, una vez verificadas identidad, titularidad, fondos disponibles y cumplimiento normativo. El dinero debe quedar bajo custodia o salvaguarda de una entidad autorizada, con conciliación y registros de partida doble. La billetera solo puede reflejar saldo disponible cuando el proveedor confirme fondos firmes y no existan retenciones.
2. **Remesa financiada directamente, sin saldo previo:** el usuario elige origen, destinatario, importe y banco o tarjeta elegible; recibe cotización real con comisión, FX, total, moneda de destino y tiempo estimado; autoriza pago y el proveedor regulado financia y ejecuta el envío. La billetera del cliente puede permanecer en cero durante toda la operación.

## Condiciones imprescindibles para operaciones reales
- Licencias o acuerdos regulados en país de origen y destino, permisos correspondientes según producto y canal; KYC/KYB, AML/CFT, sanciones, antifraude y límites.
- Confirmación de disponibilidad de cada país, ruta, moneda, método y beneficiario desde **servidor**, no botones o datos locales.
- Proveedores con tokenización PCI para tarjetas: jamás almacenar CVV, PAN completo ni credenciales bancarias en la app ni la base de datos propia.
- Estados de financiamiento y liquidación separados: initiated, pending, funded, processing, settled, failed, reversed; los webhooks autenticados son fuente de confirmación, junto con conciliación y registro contable.
- Abonos hacia tarjeta **solo en tarjetas de débito y redes/corredores elegibles**, nunca suponer que toda tarjeta permite recibir fondos.
- Operaciones y saldos reales deben mantenerse en libros, tablas y controles distintos de `mwd_wallets` y demás saldos **ficticios**. Los 10,000 MWD iniciales nunca son convertibles a USD.

## Implementación actual
Se han agregado dos pantallas **informativas no transaccionales** para mostrar al usuario los futuros servicios. No solicitan números de tarjetas ni cuentas, no permiten cargos, no generan saldos reales y muestran los botones transaccionales desactivados. Los permisos, custodios, integraciones y controles reales están pendientes, por lo que no existe fecha garantizada de activación.

Estos principios aplican sin distinción entre idioma español e inglés.
