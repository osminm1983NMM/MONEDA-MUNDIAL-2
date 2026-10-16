import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateTokenSupplyScenario} from '../src/digital-money/tokenomics-scenarios.mjs';
const allocation={community:50,ecosystem:20,team:15,reserve:15};
test('oferta hipotética fija no crea moneda ni determina precio',()=>{
 const r=evaluateTokenSupplyScenario({maxSupply:'1000000',initialMint:'1000000',mode:'no_future_mint',allocations:allocation});
 assert.equal(r.hypotheticalProjectedSupply,'1000000');
 assert.equal(r.hypotheticalRemainingCapacity,'0');
 assert.equal(r.hypotheticalAllocation.community.units,'500000');
 assert.equal(r.tokenIssued,false);assert.equal(r.activeTokenPriceUsd,null);
 assert.equal(r.canSellToken,false);assert.equal(r.realPaymentsEnabled,false);
});
test('emisión anual hipotética no puede sobrepasar máximo',()=>{
 const r=evaluateTokenSupplyScenario({maxSupply:'1000000',initialMint:'200000',annualMint:'20000',years:5,mode:'capped_scheduled_mint',allocations:allocation});
 assert.equal(r.hypotheticalProjectedSupply,'300000');
 assert.equal(r.hypotheticalRemainingCapacity,'700000');
 assert.equal(evaluateTokenSupplyScenario({maxSupply:'100',initialMint:'50',annualMint:'20',years:3,mode:'capped_scheduled_mint',allocations:allocation}),null);
});
test('no acepta distribución ambigua, inválida ni emisiones negativas',()=>{
 for(const args of [
 {maxSupply:'100',initialMint:'50',allocations:{...allocation,team:14}},
 {maxSupply:'10',initialMint:'11',allocations:allocation},
 {maxSupply:'100',initialMint:'10',annualMint:'-1',allocations:allocation},
 {maxSupply:'100',initialMint:'10',annualMint:'1',mode:'no_future_mint',allocations:allocation},
 {maxSupply:'100',initialMint:'10',annualMint:'0',mode:'capped_scheduled_mint',allocations:allocation},
 {maxSupply:'100',initialMint:'10',allocations:allocation,years:101}
 ])assert.equal(evaluateTokenSupplyScenario(args),null);
});
test('BigInt conserva precisión por encima del entero seguro JS',()=>{
 const r=evaluateTokenSupplyScenario({maxSupply:'9007199254740993',initialMint:'9007199254740993',allocations:allocation});
 assert.equal(r.hypotheticalProjectedSupply,'9007199254740993');
 assert.equal(r.tokenIssued,false);
});
