const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('App.js','utf8');
const guard=source.match(/\{(authLoading \|\| \(session && userId !== preparedUserId\)) \? <ActivityIndicator/);
assert.ok(guard,'Missing account render guard');
const loading=new Function('authLoading','session','userId','preparedUserId','return Boolean('+guard[1]+');');
test('A to B hides private screens before reset',()=>assert.equal(loading(false,{user:{id:'B'}},'B','A'),true));
test('initial authenticated session waits for reset',()=>assert.equal(loading(false,{user:{id:'A'}},'A',null),true));
test('same prepared account can display private screens',()=>assert.equal(loading(false,{user:{id:'A'}},'A','A'),false));
test('signed out shows login without waiting for old account',()=>assert.equal(loading(false,null,undefined,'A'),false));
test('initial loading always hides private screens',()=>assert.equal(loading(true,{user:{id:'A'}},'A','A'),true));
test('reset clears private data and references before marking account prepared',()=>{
 const start=source.indexOf('// No reutilizar identificadores de operaciones entre cuentas diferentes.');
 const end=source.indexOf('}, [userId]);',start);
 const effect=source.slice(start,end);
 assert.ok(start>=0 && end>start);
 const ready=effect.indexOf('setPreparedUserId(userId || null);');
 assert.ok(ready>=0);
 for(const marker of ['pendingRef.current = null;','pickupPendingRef.current = null;','setWallet(null);','setOperations([]);','setAdminRole(null);','setSwapWallet(null);','swapQuoteRef.current = null;','setSwapQuote(null);','setPickupOrders([]);','setPickupResult(null);','setPendingOperation(null);','setPendingPickup(null);','setRecipientCode(\'\');','setAmount(\'\');','setPickupAmount(\'\');']) {
  const i=effect.indexOf(marker);assert.ok(i>=0 && i<ready,marker);
 }
 assert.ok(effect.indexOf('refreshAccount(userId);')>ready);
 assert.ok(effect.indexOf('recoverPendingOperation(userId);')>ready);
});
test('render does not restore a quote belonging to previous account',()=>assert.ok(source.includes('swapQuoteRef.current = userId === preparedUserId ? swapQuote : null;')));
