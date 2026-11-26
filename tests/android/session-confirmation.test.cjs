const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('App.js','utf8');
function section(a,b){const x=source.indexOf(a),y=source.indexOf(b,x+a.length);assert.ok(x>=0&&y>x);return source.slice(x,y);}
const helpers=section('function confirmSessionAction(', 'function beginSwapBusy(');
const observer=section('const { data: { subscription } } = supabase.auth.onAuthStateChange(', 'const linkingSubscription');
function harness(){
 const confirmationRef={current:null},authBusyRef={current:false},authEventUserRef={current:'A'},recoveryActorRef={current:null},currentUserRef={current:'A'};
 let callback,actions=0,dialogs=[];
 const api=new Function('confirmationRef','authBusyRef','authEventUserRef','recoveryActorRef','currentUserRef','confirmAction','setAuthBusy','supabase','setSession','setAuthLoading','setNewPassword','setConfirmNewPassword','setScreen','let userId="A",preparedUserId="A",active=true,authEventReceived=false; const isCurrentUser=id=>!!id&&id===currentUserRef.current;'+helpers+observer+'return {confirmSessionAction,beginAuthBusy,endAuthBusy};')(confirmationRef,authBusyRef,authEventUserRef,recoveryActorRef,currentUserRef,(t,d,fn)=>dialogs.push(fn),()=>{},{auth:{onAuthStateChange:fn=>{callback=fn;return {data:{subscription:{}}};}}},()=>{},()=>{},()=>{},()=>{},()=>{});
 return {...api,open:()=>api.confirmSessionAction('Confirmar','DEMO',()=>actions++),dialogs,actions:()=>actions,emit:(event,id)=>callback(event,id?{user:{id}}:null),currentUserRef,confirmationRef};
}
test('confirmation executes at most once even if callback is repeated',()=>{const h=harness();h.open();h.dialogs[0]();h.dialogs[0]();assert.equal(h.actions(),1);});
test('new confirmation supersedes previous confirmation',()=>{const h=harness();h.open();h.open();h.dialogs[0]();h.dialogs[1]();assert.equal(h.actions(),1);});
test('A-B-A authentication events invalidate old confirmation even before render',()=>{const h=harness();h.open();h.emit('SIGNED_IN','B');h.emit('SIGNED_IN','A');h.dialogs[0]();assert.equal(h.actions(),0);});
test('same-account token refresh retains valid confirmation',()=>{const h=harness();h.open();h.emit('TOKEN_REFRESHED','A');h.dialogs[0]();assert.equal(h.actions(),1);});
test('sign-out invalidates confirmation before render',()=>{const h=harness();h.open();h.emit('SIGNED_OUT',null);h.dialogs[0]();assert.equal(h.actions(),0);});
test('password recovery invalidates old confirmation',()=>{const h=harness();h.open();h.emit('PASSWORD_RECOVERY','A');h.dialogs[0]();assert.equal(h.actions(),0);});
test('starting authentication invalidates dialog even if sign-out fails',()=>{const h=harness();h.open();assert.equal(h.beginAuthBusy(),true);h.open();h.endAuthBusy();h.dialogs[0]();assert.equal(h.actions(),0);assert.equal(h.dialogs.length,1);});
test('all monetary dialogs use the guarded confirmation helper',()=>{assert.ok(source.includes("confirmSessionAction(type === 'transfer'"));assert.ok(source.includes("confirmSessionAction('Cancelar orden ficticia'"));assert.ok(source.includes("confirmSessionAction('Confirmar conversión ficticia'"));assert.ok(source.includes('if (currentUserRef.current !== userId) confirmationRef.current = null;'));});
