'use strict';
// Supabase auth storage only. No tokens in AsyncStorage, logs, or operation reference storage.
// Two encrypted slots: write inactive slot, publish pointer last, then retire old slot.
// Each chunk stays below 2 KB even for four-byte Unicode. The previous committed value
// remains usable after an interrupted write; a deleted pointer never restores old data.
const CHUNK=400, MAX_CHUNKS=128;
function createAuthStorage(secure, legacy) {
  const tails=new Map(), purged=new Set();
  const valid=key=>{if(typeof key!=='string'||!/^sb-[a-zA-Z0-9._-]+$/.test(key)||key.length>180)throw Error('Invalid auth storage key');return 'mwd.auth.v1.'+key;};
  function serial(key,work){
    const base=valid(key);
    const pending=(tails.get(key)||Promise.resolve()).then(async()=>{
      // Deliberate one-time re-login, not migration of old plaintext refresh tokens.
      if(!purged.has(key)){await legacy.removeItem(key);purged.add(key);}
      return work(base);
    });
    const tail=pending.then(()=>undefined,()=>undefined);
    tails.set(key,tail);tail.then(()=>{if(tails.get(key)===tail)tails.delete(key);});
    return pending;
  }
  const ptr=base=>base+'.active';
  const meta=(base,slot)=>base+'.'+slot+'.count';
  const chunk=(base,slot,i)=>base+'.'+slot+'.'+i;
  async function readPointer(base){
    const value=await secure.getItemAsync(ptr(base));
    if(value===null)return null;
    if(value!=='0'&&value!=='1')throw Error('Invalid secure auth pointer');
    return value;
  }
  async function readCount(base,slot){
    const raw=await secure.getItemAsync(meta(base,slot));
    if(raw===null)return 0;
    if(!/^\d{1,3}$/.test(raw)||Number(raw)<1||Number(raw)>MAX_CHUNKS)throw Error('Invalid secure auth count');
    return Number(raw);
  }
  async function eraseSlot(base,slot){
    const n=await readCount(base,slot);
    for(let i=0;i<n;i++)await secure.deleteItemAsync(chunk(base,slot,i));
    await secure.deleteItemAsync(meta(base,slot));
  }
  function partition(value){
    if(typeof value!=='string')throw Error('Invalid auth value');
    const parts=[];let part='',n=0;
    for(const character of value){part+=character;if(++n===CHUNK){parts.push(part);part='';n=0;if(parts.length>MAX_CHUNKS)throw Error('Auth value too large');}}
    if(part||!parts.length)parts.push(part);
    if(parts.length>MAX_CHUNKS)throw Error('Auth value too large');
    return parts;
  }
  return {
    getItem:key=>serial(key,async base=>{
      const slot=await readPointer(base);if(slot===null)return null;
      const n=await readCount(base,slot);if(!n)throw Error('Missing secure auth manifest');
      const parts=[];
      for(let i=0;i<n;i++){const value=await secure.getItemAsync(chunk(base,slot,i));if(value===null)throw Error('Missing secure auth chunk');parts.push(value);}
      return parts.join('');
    }),
    setItem:(key,value)=>serial(key,async base=>{
      const parts=partition(value), previous=await readPointer(base), next=previous==='0'?'1':'0';
      await eraseSlot(base,next);
      // Count first permits cleanup after an interrupted write.
      await secure.setItemAsync(meta(base,next),String(parts.length));
      for(let i=0;i<parts.length;i++)await secure.setItemAsync(chunk(base,next,i),parts[i]);
      await secure.setItemAsync(ptr(base),next);
      // The new pointer is already authoritative; a cleanup failure must not
      // misreport the successful write. The next write/removal retries cleanup.
      if(previous!==null)try{await eraseSlot(base,previous);}catch{}
    }),
    removeItem:key=>serial(key,async base=>{
      // Remove pointer first: no stale value can be read even if cleanup fails.
      await secure.deleteItemAsync(ptr(base));
      await eraseSlot(base,'0');await eraseSlot(base,'1');
    })
  };
}
function createMemoryAuthStorage(){
 const entries=new Map();
 return {async getItem(key){return entries.get(key)??null;},async setItem(key,value){entries.set(key,value);},async removeItem(key){entries.delete(key);}};
}
module.exports={createAuthStorage,createMemoryAuthStorage};
