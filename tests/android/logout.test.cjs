const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('App.js','utf8');
const a=source.indexOf('async function logout()');
const z=source.indexOf('const microDisplay',a);
assert.ok(a>=0 && z>a);
function harness(signOut){
 let actor='A',busy=false,calls=0,clears=0;const notices=[];
 const logout=new Function('userId','isCurrentUser','beginAuthBusy','endAuthBusy','supabase','setPassword','message',source.slice(a,z)+';return logout;')(
  'A',id=>id===actor,()=>{if(busy)return false;busy=true;return true;},()=>{busy=false;},
  {auth:{signOut:async()=>{calls++;return signOut();}}},()=>{clears++;},(title,body)=>notices.push([title,body]));
 return {logout,changeActor:id=>{actor=id;},state:()=>({busy,calls,clears,notices})};
}
test('double tap sends one sign-out request',async()=>{
 let release;const h=harness(()=>new Promise(resolve=>{release=resolve;}));
 const first=h.logout();await h.logout();
 assert.equal(h.state().calls,1);assert.equal(h.state().busy,true);
 release({error:null});await first;
 assert.equal(h.state().busy,false);assert.equal(h.state().clears,1);
});
for(const rejected of [false,true])test('sign-out failure releases lock without showing SDK detail: '+rejected,async()=>{
 const h=harness(()=>{const error=Error('private-sdk-detail');if(rejected)throw error;return {error};});
 await h.logout();const s=h.state();
 assert.equal(s.busy,false);assert.equal(s.clears,0);
 assert.equal(s.notices[0][0],'Salida no confirmada');
 assert.ok(!JSON.stringify(s.notices).includes('private-sdk-detail'));
});
test('stale account failure does not notify another user',async()=>{
 let release;const h=harness(()=>new Promise(resolve=>{release=resolve;}));
 const first=h.logout();h.changeActor('B');release({error:Error('stale')});await first;
 assert.equal(h.state().notices.length,0);assert.equal(h.state().busy,false);
});
test('no sign out without current account',async()=>{
 const h=harness(()=>({error:null}));h.changeActor(null);await h.logout();
 assert.equal(h.state().calls,0);
});
test('recovery screen offers safe exit and both buttons use auth lock',()=>{
 assert.ok(source.includes('title="Cancelar recuperación y cerrar sesión" secondary onPress={logout} disabled={authBusy}'));
 assert.ok(source.includes("title={authBusy ? 'Espera...' : 'Cerrar sesión'} secondary onPress={logout} disabled={authBusy}"));
 assert.ok(!source.slice(a,z).includes('AsyncStorage.removeItem'));
});
