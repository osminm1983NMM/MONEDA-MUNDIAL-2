// Laboratorio LOCAL y educativo. No usa Supabase, blockchain, redes, monedas
// emitidas ni saldos MWD. Los datos sólo existen en este dispositivo.
import {previewCoinToDigitalScenario,previewDigitalToCoinScenario} from './coin-to-digital-design.mjs';

export const LAB_STARTING_UNITS='100';
const SCALE=1000000n;
const MAX_UNITS=999999999999n*SCALE;
const MICRO=/^(0|[1-9][0-9]{0,17})$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUEST=/^[a-zA-Z0-9_-]{12,100}$/;
const KEY_PREFIX='mwd:coin-digital-local-lab:v1:';

function must(condition,message){if(!condition)throw Error(message);}
function readMicro(value){
 must(typeof value==='string'&&MICRO.test(value),'Saldo local inválido');
 const n=BigInt(value);
 must(n<=MAX_UNITS,'Saldo local fuera del límite');
 return n;
}
function parseUnits(value){
 must(typeof value==='string'&&/^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$/.test(value.trim()),'Cantidad de prueba inválida');
 const [whole,decimals='']=value.trim().split('.');
 return BigInt(whole)*SCALE+BigInt(decimals.padEnd(6,'0')||'0');
}
function formatUnits(value){
 const fraction=(value%SCALE).toString().padStart(6,'0').replace(/0+$/,'');
 return (value/SCALE).toString()+(fraction?'.'+fraction:'');
}
function validateUserId(userId){
 must(typeof userId==='string'&&UUID.test(userId),'Cuenta de prueba inválida');
 return userId.toLowerCase();
}
export function localLabStorageKey(userId){return KEY_PREFIX+validateUserId(userId);}
export function initialLocalLab(userId){
 return {version:1,ownerUserId:validateUserId(userId),
  balances:{coinMicro:(100n*SCALE).toString(),digitalMicro:(100n*SCALE).toString()},
  history:[]};
}
export function validateLocalLab(raw,userId){
 must(raw&&typeof raw==='object'&&!Array.isArray(raw),'Registro local ilegible');
 must(raw.version===1&&raw.ownerUserId===validateUserId(userId),'Registro de otra cuenta o versión');
 must(raw.balances&&typeof raw.balances==='object','Saldos locales ausentes');
 readMicro(raw.balances.coinMicro);readMicro(raw.balances.digitalMicro);
 must(Array.isArray(raw.history)&&raw.history.length<=50,'Historial local inválido');
 const seen=new Set();
 for(const entry of raw.history){
  must(entry&&typeof entry==='object'&&typeof entry.id==='string'&&REQUEST.test(entry.id)
    &&!seen.has(entry.id)&&['coin','digital'].includes(entry.fromAsset)
    &&entry.toAsset===(entry.fromAsset==='coin'?'digital':'coin')
    &&typeof entry.at==='string'&&!Number.isNaN(Date.parse(entry.at)),
    'Movimiento local inválido');
  seen.add(entry.id);
  must(parseUnits(entry.fromAmount)>0n&&parseUnits(entry.toAmount)>0n,'Movimiento sin cantidad');
 }
 return raw;
}

export function quoteLocalLab({direction,amount,coinUsd='0.25',digitalUsd='1'}={}){
 must(['coin_to_digital','digital_to_coin'].includes(direction),'Dirección de prueba inválida');
 const preview=direction==='coin_to_digital'
  ?previewCoinToDigitalScenario({coinUnits:amount,coinUsdScenario:coinUsd,digitalUsdScenario:digitalUsd})
  :previewDigitalToCoinScenario({digitalUnits:amount,coinUsdScenario:coinUsd,digitalUsdScenario:digitalUsd});
 if(!preview)return null;
 return Object.freeze({direction,fromAsset:direction==='coin_to_digital'?'coin':'digital',
  toAsset:direction==='coin_to_digital'?'digital':'coin',
  fromAmount:direction==='coin_to_digital'?preview.inputCoinUnits:preview.inputDigitalUnits,
  toAmount:direction==='coin_to_digital'?preview.hypotheticalNetDigitalUnits:preview.hypotheticalNetCoinUnits,
  coinUsd:preview.coinUsdScenario,digitalUsd:preview.digitalUsdScenario,
  priceSource:'manual_illustration_only',realAsset:false,executedOnNetwork:false});
}

export function applyLocalLabConversion(raw,userId,scenario,requestId,at=new Date().toISOString()){
 const current=validateLocalLab(raw,userId);
 must(typeof requestId==='string'&&REQUEST.test(requestId),'Identificador de prueba inválido');
 if(current.history.some(entry=>entry.id===requestId))return {state:current,duplicate:true};
 must(typeof at==='string'&&!Number.isNaN(Date.parse(at)),'Fecha local inválida');
 const quote=quoteLocalLab(scenario);
 must(quote!==null,'Precios o cantidad ficticios inválidos');
 const fromKey=quote.fromAsset+'Micro',toKey=quote.toAsset+'Micro';
 const amountFrom=parseUnits(quote.fromAmount),amountTo=parseUnits(quote.toAmount);
 const fromBalance=readMicro(current.balances[fromKey]);
 const toBalance=readMicro(current.balances[toKey]);
 must(amountFrom>0n&&amountTo>0n,'Conversión ficticia sin resultado');
 must(fromBalance>=amountFrom,'Saldo Coin/Digital de prueba insuficiente');
 must(toBalance+amountTo<=MAX_UNITS,'Límite de saldo ficticio');
 const balances={...current.balances,
  [fromKey]:(fromBalance-amountFrom).toString(),
  [toKey]:(toBalance+amountTo).toString()};
 const entry={id:requestId,at,fromAsset:quote.fromAsset,toAsset:quote.toAsset,
  fromAmount:quote.fromAmount,toAmount:quote.toAmount,
  coinUsd:quote.coinUsd,digitalUsd:quote.digitalUsd};
 return {state:{...current,balances,history:[entry,...current.history].slice(0,50)},duplicate:false};
}

export function viewLocalLab(raw,userId){
 const state=validateLocalLab(raw,userId);
 return {...state,balances:{coin:formatUnits(readMicro(state.balances.coinMicro)),
  digital:formatUnits(readMicro(state.balances.digitalMicro))}};
}

export async function readLocalLab(storage,userId){
 const key=localLabStorageKey(userId);
 const saved=await storage.getItem(key);
 if(saved===null)return initialLocalLab(userId);
 let raw;
 try{raw=JSON.parse(saved);}catch{throw Error('Registro local ilegible. No se reinició.');}
 return validateLocalLab(raw,userId);
}

export async function saveLocalLabConversion(storage,userId,scenario,requestId,at){
 // Un único registro JSON por cuenta. El llamador bloquea pulsaciones paralelas.
 const before=await readLocalLab(storage,userId);
 const result=applyLocalLabConversion(before,userId,scenario,requestId,at);
 if(!result.duplicate)await storage.setItem(localLabStorageKey(userId),JSON.stringify(result.state));
 return result;
}
