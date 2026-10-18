import test from 'node:test';
import assert from 'node:assert/strict';
import {getProviderResearchCopy} from '../src/digital-money/provider-research-copy.mjs';
import {RESEARCH_PAYOUTS,RESEARCH_PROVIDERS} from '../src/digital-money/provider-research-overview.mjs';

test('Spanish and English provider screens preserve the research-only warning',()=>{
 for(const language of ['es','en','pt',null,undefined]){
  const c=getProviderResearchCopy(language);
  assert.ok(c.title.length>4);
  assert.match(c.warning,/investigaci[oó]n|research only/i);
  assert.match(c.real,/\bNO\b/);
  assert.match(c.noSend,/no env[ií]a|does not send/i);
  assert.match(c.footer,/documentos|documents/i);
  assert.deepEqual(Object.keys(c.methods).sort(),Object.keys(RESEARCH_PAYOUTS).sort());
  for(const p of RESEARCH_PROVIDERS)assert.ok(c.studies[p.id]);
 }
 assert.equal(getProviderResearchCopy('pt'),getProviderResearchCopy('es'));
 assert.notEqual(getProviderResearchCopy('en').title,getProviderResearchCopy('es').title);
});

test('all contact copy requires manual review and no real transfer is advertised',()=>{
 for(const language of ['es','en']){
  const c=getProviderResearchCopy(language);
  assert.match(c.mobile,/revisar|review/i);
  assert.match(c.mobile,/no se enviar[aá]|nothing is sent/i);
  assert.match(c.coverage,/sin convenio|no agreement/i);
  const value=JSON.stringify(c);
  assert.doesNotMatch(value,/sb_secret_|service_role|private_key|https:\/\//);
 }
});
