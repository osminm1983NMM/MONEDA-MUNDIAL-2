# Diseño propuesto: asientos de apertura de billetera (DEMO)

Estado: propuesta, NO desplegada. No usar para dinero real.

## Problema
`public.mwd_wallets.balance_cents` tiene un valor predeterminado de 1,000,000 centavos MWD ficticios. La conciliación actual infiere el saldo inicial restando movimientos históricos; esto no prueba por sí solo la creación del saldo.

## Modelo recomendado
Crear en un entorno aislado una tabla privada `mwd_finance_private.wallet_opening_entries` con:
- `wallet_user_id uuid` PRIMARY KEY y referencia a billetera.
- `opening_amount_cents bigint NOT NULL CHECK (opening_amount_cents >= 0)`.
- `currency_code text NOT NULL DEFAULT 'MWD' CHECK (currency_code='MWD')`.
- `created_at timestamptz NOT NULL DEFAULT now()`.
- `source_kind text NOT NULL` con valores `new_wallet` o `legacy_reconstruction`.
- `source_reference text` para identificar evidencia de provisión o reconciliación histórica.
- `created_by uuid` opcional; para procesos internos registrar identidad del servicio de forma verificable en bitácora separada.

## Invariantes
1. Exactamente un asiento de apertura por billetera, creado en la misma transacción que la billetera nueva.
2. Sin INSERT/UPDATE/DELETE para roles `anon` o `authenticated`; escrituras exclusivamente mediante función de provisión auditada.
3. Prohibir UPDATE y DELETE también a la ruta de aplicación; registrar cambios excepcionales como ajustes compensatorios, no sobrescribir historia.
4. Saldo esperado = apertura + entradas por transferencias - salidas por transferencias - aportaciones + ajustes explícitos autorizados.
5. Idempotencia en provisión: dos intentos con la misma identidad no crean dos billeteras ni dos asientos.
6. `legacy_reconstruction` es inferencia y NO debe etiquetarse como apertura histórica verificada.
7. El origen de los saldos ficticios debe ser una cuenta de emisión/contrapartida o asiento de provisión, no creación silenciosa de valor.

## Plan seguro de implementación futura
1. Preparar migración SQL reversible y pruebas en PostgreSQL aislado.
2. Revisar `SECURITY DEFINER`, RLS, GRANT y propiedad de funciones de provisión.
3. Respaldar y verificar conteos y conciliación antes de cambios.
4. Crear asientos retrospectivos con etiqueta `legacy_reconstruction`, sin inventar fechas ni pruebas de apertura.
5. Desplegar a principal SOLO con aprobación explícita, ventana de mantenimiento y plan de reversión.

## Criterios de aceptación
- 5/5 billeteras demo actuales conciliadas contra el saldo inicial inferido de 1,000,000 centavos.
- 0 duplicados, 0 referencias huérfanas, 0 diferencias inexplicadas.
- Tests de concurrencia y permisos ejecutados contra PostgreSQL real en entorno aislado.
- Documentación clara de límites de auditoría y ausencia de pagos reales.
