// MONEDA MUNDIAL 2.0 | Verificación guiada de 2 sesiones auténticas (SOLO DEMO).
// Nunca conserva credenciales, tokens, correos, cuentas ni importes en disco.
// El estado de prueba vive SOLO en memoria: al cerrar/reiniciar la app, reiniciar.
// No hace transferencias ni conversiones por sí solo: cada conversión requiere
// confirmación manual en CoinStableDemoScreen del usuario autenticado.
// Esto no demuestra permisos de otras RPC ni habilita dinero/activos reales.
import {runDemoAccountSelfcheck} from './demo-account-selfcheck.mjs';
import {parseDemoAssetBalances} from './demo-asset-summary.mjs';
import {validateDemoHistory} from './demo-conversion-contract.mjs';

const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const stages=['start','a_before','a_after','b_before','b_after','pass'];
const assert=(ok,message)=>{if(!ok)throw new Error(message);};

export async function inspectTwoAccountDemoSession({supabase,userId,isCurrent=()=>true}){
  assert(supabase&&typeof supabase.rpc==='function'&&typeof isCurrent==='function'&&
    typeof userId==='string'&&UUID.test(userId),'Sesión inválida');
  const check=()=>assert(isCurrent(),'La sesión cambió. Reinicia la revisión.');
  check();
  const result=await runDemoAccountSelfcheck({supabase,userId,isCurrent});
  check();
  assert(result?.status==='pass'&&result.checkedTables===6,'No pasó la verificación de acceso');
  const {data,error}=await supabase.rpc('mwd_conversion_wallet_demo');
  check();
  assert(!error,'No fue posible leer la billetera Coin/Digital');
  const balances=parseDemoAssetBalances(data);
  const history=validateDemoHistory(data?.history);
  assert(balances&&history,'El saldo o historial Coin/Digital no es verificable');
  return {userId:userId.toLowerCase(),...balances,history};
}

// Mantener el comprobante en RAM no significa que B pueda consultarlo.
// La app solo compara IDs de conversión, sin mostrar los datos de A a B.
export function createTwoAccountDemoVerification({inspect=inspectTwoAccountDemoSession}={}){
  let stage='start';
  let a=null,b=null,busy=false;
  const getStage=()=>stage;
  const reset=()=>{assert(!busy,'Verificación en curso');stage='start';a=null;b=null;};
  const without=items=>new Set(items.map(o=>o.id.toLowerCase()));
  const noLeak=(snapshot,foreignId)=>assert(
    !snapshot.history.some(x=>x.id.toLowerCase()===foreignId),
    'El historial contiene una conversión de otra cuenta. Detén las pruebas.');
  const changed=(before,after,direction)=>{
    const added=after.history.filter(x=>!before.ids.has(x.id.toLowerCase()));
    assert(added.length===1&&added[0].fromAsset===direction,
      'Se requiere exactamente una conversión NUEVA en la dirección indicada');
    const op=added[0];
    const first=direction==='COIN'?'coinMicro':'stableMicro';
    const second=direction==='COIN'?'stableMicro':'coinMicro';
    assert(after[first]===before[first]-op.amountInMicro &&
           after[second]===before[second]+op.amountOutMicro,
      'Los cambios de saldos no coinciden con la conversión ficticia');
    return op.id.toLowerCase();
  };
  async function step(kind,args){
    const table={
      prepareA:'start',finishA:'a_before',
      prepareB:'a_after',finishB:'b_before',verifyA:'b_after'
    };
    assert(table[kind]===stage,'Paso fuera de orden; revisa la guía');
    assert(!busy,'Hay una comprobación en progreso');
    assert(args&&typeof args.isCurrent==='function','Falta control de sesión');
    busy=true;
    try{
      const snap=await inspect(args);
      assert(args.isCurrent(),'La sesión cambió: no se guarda este paso');
      assert(snap&&typeof snap.userId==='string'&&
        Number.isSafeInteger(snap.coinMicro)&&Number.isSafeInteger(snap.stableMicro)&&
        Array.isArray(snap.history),'Respuesta incompleta');
      const uid=snap.userId.toLowerCase();
      if(kind==='prepareA'){
        a={uid,initial:{coinMicro:snap.coinMicro,stableMicro:snap.stableMicro,
          ids:without(snap.history)}};
        stage='a_before';
      }else if(kind==='finishA'){
        assert(uid===a.uid,'Se esperaba la misma cuenta A');
        a.conversionId=changed(a.initial,snap,'COIN');
        a.after={coinMicro:snap.coinMicro,stableMicro:snap.stableMicro};
        stage='a_after';
      }else if(kind==='prepareB'){
        assert(uid!==a.uid,'B debe ser una cuenta DISTINTA de A');
        noLeak(snap,a.conversionId);
        b={uid,initial:{coinMicro:snap.coinMicro,stableMicro:snap.stableMicro,
          ids:without(snap.history)}};
        stage='b_before';
      }else if(kind==='finishB'){
        assert(uid===b.uid,'Se esperaba la misma cuenta B');
        noLeak(snap,a.conversionId);
        b.conversionId=changed(b.initial,snap,'STABLE');
        stage='b_after';
      }else{
        assert(uid===a.uid,'Debes volver a entrar en la cuenta A');
        noLeak(snap,b.conversionId);
        assert(snap.history.some(x=>x.id.toLowerCase()===a.conversionId),
          'No se encontró la conversión de A en su propio historial');
        assert(snap.coinMicro===a.after.coinMicro&&snap.stableMicro===a.after.stableMicro,
          'El saldo de A cambió después de la operación de B');
        stage='pass';
      }
      return Object.freeze({stage,scope:'two_sessions_guided_demo',realPaymentsEnabled:false});
    }finally{busy=false;}
  }
  return Object.freeze({getStage,reset,
    prepareA:args=>step('prepareA',args),finishA:args=>step('finishA',args),
    prepareB:args=>step('prepareB',args),finishB:args=>step('finishB',args),
    verifyA:args=>step('verifyA',args)});
}

export const twoAccountDemoVerification=createTwoAccountDemoVerification();
