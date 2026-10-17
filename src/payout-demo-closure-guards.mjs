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

export function isVerifiedMockPayoutCapability(value) {
  return value!==null && typeof value==='object' && !Array.isArray(value) &&
    value.version===1 && value.demo_only===true &&
    value.closure_requires_consumed_code===true &&
    value.real_payments_enabled===false;
}
