// Comprueba el formato local del enlace de recuperación. Sin guardar tokens.
// Supabase Auth valida autorización, caducidad y sesión en el servidor.
const res=(recognized,valid,reason=null,tokens={})=>
 Object.freeze({recognized,valid,reason,...tokens});
export function parseRecoveryDeepLink(raw){
 if(typeof raw!=='string'||!raw.startsWith('monedamundial://'))
  return res(false,false,'not_recovery');
 if(raw.length>8192)return res(true,false,'invalid_link');
 let u;
 try{u=new URL(raw);}catch{return res(true,false,'invalid_link');}
 if(u.protocol!=='monedamundial:'||u.hostname!=='auth'||u.pathname!=='/recovery'||
    u.username||u.password||u.port||u.search||!u.hash.startsWith('#'))
  return res(false,false,'not_recovery');
 const p=new URLSearchParams(u.hash.slice(1));
 if(p.has('error')||p.has('error_code'))return res(true,false,'expired_link');
 const single=k=>p.getAll(k).length===1?p.get(k):null;
 const a=single('access_token'),r=single('refresh_token');
 const token=t=>typeof t==='string'&&t.length>=10&&t.length<=4096&&!/[\s#&=]/.test(t);
 if(single('type')!=='recovery'||!token(a)||!token(r))
  return res(true,false,'invalid_link');
 return res(true,true,null,{accessToken:a,refreshToken:r});
}
export function validateRecoveryPassword({
 recoveryActive=false,recoveryUserId=null,sessionUserId=null,
 password='',confirmation=''
}={}){
 if(!recoveryActive||typeof recoveryUserId!=='string'||!recoveryUserId||
    recoveryUserId!==sessionUserId)
  return Object.freeze({allowed:false,reason:'recovery_not_verified'});
 if(typeof password!=='string'||password.length<12||password.length>256)
  return Object.freeze({allowed:false,reason:'password_length'});
 if(password!==confirmation)
  return Object.freeze({allowed:false,reason:'password_mismatch'});
 return Object.freeze({allowed:true,reason:null});
}
