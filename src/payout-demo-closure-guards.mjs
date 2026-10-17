// Control de presentación, NO autorización. El servidor DEMO tiene la última palabra.
// No debe habilitar pagos bancarios ni usar saldos reales.
export function canCloseMockPayout({orderStatus,assignmentStatus,codeStatus,identityCheckSimulated}={}) {
  return orderStatus==='simulated' &&
    assignmentStatus==='planned' &&
    codeStatus==='consumed' &&
    identityCheckSimulated===true;
}
export function isSafeMockPayoutClosureResponse(value) {
  return value!==null && typeof value==='object' && !Array.isArray(value) &&
    value.status==='sample_completed' &&
    value.real_payments_enabled===false &&
    value.redeemable===false &&
    value.money_paid===false;
}
