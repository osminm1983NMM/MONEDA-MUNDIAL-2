import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileDesign, contractFile } from '../scripts/check-contract.mjs';

test('compila ERC-20 sin bytecode desplegable', () => {
  const { design } = compileDesign();
  assert.ok(Array.isArray(design.abi));
  assert.equal(design.evm?.bytecode?.object || '', '');
});

test('solamente ilustra una emisión fija inicial, sin precio ni venta', () => {
  const source = readFileSync(contractFile,'utf8');
  assert.match(source,/abstract contract MonedaMundialCoinResearch/);
  assert.match(source,/constructor\(address hypotheticalDistributionVault, uint256 hypotheticalBaseUnitSupply\)/);
  assert.equal((source.match(/_mint\s*\(/g)||[]).length,1);
  assert.doesNotMatch(source,/function\s+(?:mint|setPrice|sell|swap|redeem)\s*\(/);
  assert.match(source,/MWD-RESEARCH/);
});
