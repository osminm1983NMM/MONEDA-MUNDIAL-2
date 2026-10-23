// Moneda Mundial 2.0: verificación del saldo MWD de DEMOSTRACIÓN.
// Sólo interpreta respuestas existentes del servidor; no obtiene ni modifica fondos.
// No sustituye la autorización RLS/JWT del servidor ni la conciliación contable.
import {classifyDemoOperation} from './demo-receipts.mjs';
import {canApplySessionResponse} from './session-guards.mjs';

const CODE=/^MWD-[A-F0-9]{16}$/;
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const MAX_SAFE_BALANCE=Number.MAX_SAFE_INTEGER;
const fail=()=>{throw new Error('Respuesta de billetera ficticia inválida: conservar saldo no disponible')};
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);

export function isCurrentDemoWalletRefresh({
 requestedUserId,activeSession,requestedEpoch,currentEpoch,
 requestedSequence,currentSequence,
}={}){
 return canApplySessionResponse(requestedUserId,activeSession)&&
  Number.isSafeInteger(requestedEpoch)&&requestedEpoch>=0&&
  requestedEpoch===currentEpoch&&
  Number.isSafeInteger(requestedSequence)&&requestedSequence>0&&
  requestedSequence===currentSequence;
}

export function validateDemoAccountSnapshot({wallet,operations,adminRow,expectedUserId}={}){
 if(typeof expectedUserId!=='string'||!expectedUserId||!plain(wallet)||
    wallet.user_id!==expectedUserId||
    typeof wallet.account_code!=='string'||!CODE.test(wallet.account_code)||
    !Number.isSafeInteger(wallet.balance_cents)||wallet.balance_cents<0||
    wallet.balance_cents>MAX_SAFE_BALANCE)
  fail();
 if(!Array.isArray(operations)||operations.length>200)fail();
 const seen=new Set(),sanitized=[];
 for(const op of operations){
  if(!plain(op)||typeof op.id!=='string'||!UUID.test(op.id)||
     seen.has(op.id)||!['contribution','transfer'].includes(op.kind)||
     !Number.isSafeInteger(op.amount_cents)||op.amount_cents<1||
     op.amount_cents>100000000||typeof op.created_at!=='string'||
     !Number.isFinite(Date.parse(op.created_at))||
     (op.is_merchant_payment!==undefined&&op.is_merchant_payment!==null&&
      typeof op.is_merchant_payment!=='boolean')||
     (op.source_user_id!==null&&typeof op.source_user_id!=='string')||
     (op.destination_user_id!==null&&typeof op.destination_user_id!=='string')||
     !classifyDemoOperation(op,expectedUserId))
   fail();
  seen.add(op.id);
  sanitized.push(Object.freeze({
   id:op.id,kind:op.kind,source_user_id:op.source_user_id,
   destination_user_id:op.destination_user_id,
   is_merchant_payment:op.is_merchant_payment===true,
   amount_cents:op.amount_cents,created_at:op.created_at,
  }));
 }
 // Nunca autorizar la función "owner" solamente por datos recibidos en el móvil;
 // el servidor DEBE aplicar controles reales de autorización independientemente.
 if(adminRow!==null&&adminRow!==undefined&&!plain(adminRow))fail();
 if(adminRow&&adminRow.role!==undefined&&adminRow.role!==null&&
    typeof adminRow.role!=='string')fail();
 return Object.freeze({
  wallet:Object.freeze({
   user_id:wallet.user_id,account_code:wallet.account_code,
   balance_cents:wallet.balance_cents,
  }),
  operations:Object.freeze(sanitized),
  adminRole:adminRow?.role==='owner'?'owner':null,
  // Esta validación no demuestra que el saldo del servidor esté conciliado.
  serverBalanceReconciled:false,bankFundsVerified:false,
  realMoneyEnabled:false,
 });
}
