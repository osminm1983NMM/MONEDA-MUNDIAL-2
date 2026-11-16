// Prueba local aislada: no accede a Supabase ni a fondos reales.
// Ejecutar: node --test tests/remesas-concurrencia.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

class RemesaDemo {
  constructor() {
    this.estado = 'pendiente';
    this.movimientos = [];
    this.bloqueada = false;
  }
  async pagar(clave) {
    if (this.bloqueada || this.estado !== 'pendiente') return { ok: false, motivo: 'ya_procesada' };
    // Bloqueo síncrono antes de cualquier espera asíncrona.
    this.bloqueada = true;
    try {
      await Promise.resolve();
      this.estado = 'pagada';
      this.movimientos.push({ tipo: 'pago', monto: 100, clave });
      return { ok: true };
    } finally {
      this.bloqueada = false;
    }
  }
}

test('dos solicitudes simultáneas pagan una sola vez', async () => {
  const remesa = new RemesaDemo();
  const resultados = await Promise.all([remesa.pagar('A'), remesa.pagar('B')]);
  assert.equal(resultados.filter(r => r.ok).length, 1);
  assert.equal(remesa.movimientos.length, 1);
  assert.equal(remesa.movimientos[0].monto, 100);
  assert.equal(remesa.estado, 'pagada');
});

test('reintento posterior no crea otro movimiento', async () => {
  const remesa = new RemesaDemo();
  assert.equal((await remesa.pagar('A')).ok, true);
  assert.equal((await remesa.pagar('A')).ok, false);
  assert.equal(remesa.movimientos.length, 1);
});

// Importante: esta simulación en memoria NO demuestra seguridad entre
// servidores o transacciones reales. En producción se requiere una operación
// atómica en PostgreSQL, idempotencia persistente y pruebas de integración.
