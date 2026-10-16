# Refuerzo de idempotencia de códigos DEMO

Este módulo **no mueve fondos ni permite cobrar**. El SQL adicional
`database/mwd_pickup_code_idempotency_demo.sql` se instala después de los
módulos simulados de remesas, asociaciones y códigos.

- Une cada UUID de intento con el hash SHA-256 de los mismos bytes del código.
- Si se repite UUID y entrada idéntica, se devuelve el resultado original sin
  sumar intentos ni registrar un segundo consumo.
- Si se repite UUID con otro código, se rechaza con SQLSTATE 22023.
- Intentos históricos sin huella quedan bloqueados para reintento.
- Persisten bloqueos FOR UPDATE, cinco intentos fallidos, caducidad y
  prohibición de pagar dinero real.
- La prueba aislada verifica que no se generen eventos duplicados.

NO constituye un control suficiente para operaciones reguladas: faltan
proveedor autorizado, conciliación de fondos, KYC/AML, controles agregados
contra fraude, límites, auditoría independiente y licencia o cobertura legal.
