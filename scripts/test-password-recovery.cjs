'use strict';
const fs=require('node:fs');
const path=require('node:path');
async function run(app, URLImpl) {
  const eq=(actual,expected,label)=>{if(actual!==expected)throw Error(label+': expected '+expected+', got '+actual)};
  function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);if(a<0||b<a)throw Error('Source section missing');return app.slice(a,b);}
  const source=section('    const handleAuthUrl = async url => {','\n\n    supabase.auth.getSession()')+'\n'+section('    const { data: { subscription } } = supabase.auth.onAuthStateChange(','\n    const linkingSubscription')+'\n'+section('  async function saveNewPassword() {','\n  async function recoverPendingOperation')+'\nreturn {handleAuthUrl,saveNewPassword};';
  function harness(){
    const recoveryActorRef={current:null},authEventUserRef={current:null},recoveryCodeStateRef={current:{inFlight:new Set(),processed:new Set()}};
    let current=null,screen='Inicio',busy=false,callback,exchanges=0,updates=0,alerts=[],fields=['',''];
    let control={};
    const supabase={auth:{
      onAuthStateChange(cb){callback=cb;return {data:{subscription:{}}};},
      async exchangeCodeForSession(code){exchanges++;if(control.exchange)return control.exchange(code);const session={user:{id:'A'}};callback('PASSWORD_RECOVERY',session);return {data:{session},error:null};},
      async updateUser(){updates++;return {error:null};}
    }};
    const build=Function('supabase','URL','recoveryActorRef','authEventUserRef','recoveryCodeStateRef','beginAuthBusy','endAuthBusy','setNewPassword','setConfirmNewPassword','setScreen','message','setSession','setAuthLoading','getCurrent', 'getPasswords', 'let active=true,authEventReceived=false; const isCurrentUser=id=>!!id&&id===getCurrent(); let userId,newPassword,confirmNewPassword; const setValues=()=>{userId=getCurrent();[newPassword,confirmNewPassword]=getPasswords()};'+source.replace('async function saveNewPassword() {','async function saveNewPassword() { setValues();'));
    const handlers=build(supabase,URLImpl,recoveryActorRef,authEventUserRef,recoveryCodeStateRef,()=>{if(busy)return false;busy=true;return true},()=>{busy=false},x=>{fields[0]=x},x=>{fields[1]=x},x=>{screen=x},(a,b)=>alerts.push(a+': '+b),s=>{current=s?.user?.id||null},()=>{},()=>current,()=>fields);
    return {...handlers,control,emit:(event,id)=>callback(event,id?{user:{id}}:null),setFields:(a,b)=>fields=[a,b],state:()=>({screen,busy,exchanges,updates,alerts,fields,owner:recoveryActorRef.current})};
  }
  const link=code=>'com.monedamundial.app://auth/reset-password?code='+code;
  let n=0;
  {const h=harness();await h.handleAuthUrl('https://auth/reset-password?code=x');eq(h.state().exchanges,0,'foreign scheme');n++;}
  {const h=harness();await h.handleAuthUrl('com.monedamundial.app://auth/reset-password');eq(h.state().exchanges,0,'missing code');eq(h.state().alerts.length,1,'missing code alert');n++;}
  {const h=harness();await h.handleAuthUrl('com.monedamundial.app://auth/reset-password?error=expired');eq(h.state().exchanges,0,'expired link');n++;}
  {const h=harness();await h.handleAuthUrl(link('a'));await h.handleAuthUrl(link('a'));eq(h.state().exchanges,1,'processed replay');eq(h.state().owner,'A','recovery owner');n++;}
  {const h=harness();let release;h.control.exchange=()=>new Promise(resolve=>{release=resolve});const first=h.handleAuthUrl(link('a'));await h.handleAuthUrl(link('a'));await h.handleAuthUrl(link('b'));eq(h.state().exchanges,1,'parallel links');h.emit('PASSWORD_RECOVERY','A');release({data:{session:{user:{id:'A'}}}});await first;eq(h.state().busy,false,'release lock');n++;}
  {const h=harness();await h.handleAuthUrl(link('a'));h.setFields('password1','password1');h.emit('SIGNED_IN','A');eq(h.state().screen,'CambiarContraseña','same-user event');h.emit('SIGNED_IN','B');eq(h.state().screen,'Inicio','changed user screen');eq(h.state().fields[0],'','changed user clears input');h.setFields('password1','password1');await h.saveNewPassword();eq(h.state().updates,0,'wrong account save');n++;}
  {const h=harness();await h.handleAuthUrl(link('a'));h.setFields('password1','different');await h.saveNewPassword();eq(h.state().updates,0,'mismatched passwords');h.setFields('password1','password1');await h.saveNewPassword();eq(h.state().updates,1,'valid save');eq(h.state().owner,null,'clear owner after save');eq(h.state().screen,'Inicio','finished recovery');n++;}
  {const h=harness();let release;h.control.exchange=()=>new Promise(resolve=>{release=resolve});const first=h.handleAuthUrl(link('a'));h.emit('SIGNED_IN','B');release({data:{session:{user:{id:'A'}}}});await first;eq(h.state().owner,null,'stale recovery cannot claim new account');eq(h.state().busy,false,'release stale exchange');n++;}
  {const h=harness();await h.handleAuthUrl(link('a'));h.emit('SIGNED_OUT',null);eq(h.state().owner,null,'logout clears recovery');n++;}
  return n;
}
run(fs.readFileSync(path.join(__dirname,'../App.js'),'utf8'),URL).then(n=>console.log('PASS '+n+' recovery scenarios')).catch(e=>{console.error(e);process.exitCode=1;});
