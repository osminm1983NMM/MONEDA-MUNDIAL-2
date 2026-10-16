import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import solc from 'solc';

export const contractFile = 'contracts/MonedaMundialCoinResearch.sol';
const soliditySource = readFileSync(resolve(contractFile), 'utf8');

function loadImport(path) {
  if (!path.startsWith('@openzeppelin/contracts/') ||
      path.includes('..') || path.includes('\\')) {
    return { error: 'Untrusted Solidity dependency path rejected' };
  }
  try {
    return { contents: readFileSync(resolve('node_modules', path), 'utf8') };
  } catch {
    return { error: 'Pinned OpenZeppelin dependency not installed: ' + path };
  }
}

export function compileDesign() {
  const input = {
    language: 'Solidity',
    sources: { [contractFile]: { content: soliditySource } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
    },
  };
  const data = JSON.parse(solc.compile(JSON.stringify(input), { import: loadImport }));
  const errors = (data.errors || []).filter(issue => issue.severity === 'error');
  assert.equal(errors.length, 0, errors.map(x => x.formattedMessage).join('\n'));
  const design = data.contracts?.[contractFile]?.MonedaMundialCoinResearch;
  assert.ok(design, 'Solidity reference contract missing after compilation');
  const functions = design.abi.filter(item => item.type === 'function').map(item => item.name);
  for (const method of ['transfer', 'balanceOf', 'totalSupply', 'approve', 'allowance', 'transferFrom']) {
    assert.ok(functions.includes(method), 'ERC-20 basic method missing: ' + method);
  }
  for (const method of ['mint', 'setCap', 'setPrice', 'sell', 'buy', 'redeem',
    'pause', 'upgradeTo', 'grantRole', 'setOwner', 'transferOwnership']) {
    assert.ok(!functions.includes(method), 'Unauthorized research capability: ' + method);
  }
  // Las clases abstractas no generan bytecode de despliegue.
  assert.ok(!design.evm?.bytecode?.object,
    'UNSAFE: a research-only design became deployable!');
  return { design, warnings: (data.errors || []).filter(x=>x.severity==='warning').length };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve('scripts/check-contract.mjs')) {
  const result = compileDesign();
  console.log('Contrato ERC-20 de investigación compilado y ABSTRACTO; bytecode no desplegable. Advertencias:', result.warnings);
}
