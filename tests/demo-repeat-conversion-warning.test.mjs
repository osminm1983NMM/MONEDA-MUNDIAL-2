import test from 'node:test';
import assert from 'node:assert/strict';
import {isRecentSameConversionDemo} from '../src/digital-money/demo-repeat-conversion-warning.mjs';
const now=Date.parse('2026-10-22T18:00:00Z');
const quote={fromAsset:'COIN',toAsset:'STABLE',amountInMicro:1000000};
const history=[{...quote,settledAt:'2026-10-22T17:59:00Z'}];
test('advierte una intención idéntica ya confirmada hace un minuto',()=>{
 assert.equal(isRecentSameConversionDemo(quote,history,now),true);
});
test('no advierte importes, activos o períodos diferentes',()=>{
 for(const q of [{...quote,amountInMicro:2000000},{fromAsset:'STABLE',toAsset:'COIN',amountInMicro:1000000}])
 assert.equal(isRecentSameConversionDemo(q,history,now),false);
 assert.equal(isRecentSameConversionDemo(quote,[{...quote,settledAt:'2026-10-22T17:40:00Z'}],now),false);
});
test('no permite marcas temporales inválidas como evidencia de repetición',()=>{
 assert.equal(isRecentSameConversionDemo(quote,[{...quote,settledAt:'incorrecta'}],now),false);
});
