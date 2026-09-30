# Modelo de datos propuesto para producción

La demo usa almacenamiento local. Para producción se recomienda PostgreSQL (por ejemplo, Supabase, Neon o un servidor propio) con las siguientes entidades.

## Entidades principales

- `branches`: las seis sucursales municipales.
- `users`: identidad, estado y sucursal asignada.
- `roles` y `permissions`: permisos configurables por administración.
- `medicines`: catálogo general de medicamentos.
- `inventory_lots`: existencias por sucursal, lote, costo, precio y vencimiento.
- `movements`: cabecera de venta normal, entrega SUS, ingreso, ajuste o transferencia.
- `movement_items`: medicamentos y cantidades de cada movimiento.
- `audit_log`: usuario, acción, fecha y valores modificados.

## Reglas clave

1. Toda salida descuenta un lote específico y nunca permite existencias negativas.
2. Las entregas SUS tienen total monetario igual a cero, pero conservan costo y cantidad para reportes.
3. El porcentaje de margen, los costos y la ganancia son datos restringidos a administradores.
4. El técnico puede crear lotes; el vendedor solo consulta inventario y registra salidas.
5. Los lotes vencidos no pueden venderse ni entregarse.
6. Se recomienda FEFO: sugerir primero el lote que vence antes.
7. Toda modificación sensible debe quedar en `audit_log`.

## Migración sugerida

La interfaz está separada de los datos en `src/js/store.js`. Para migrar, se reemplazan `loadState` y `saveState` por llamadas HTTP a una API o funciones serverless de Vercel, sin rehacer la presentación.
