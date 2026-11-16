const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const app = fs.readFileSync('App.js','utf8');

test('remittance screen remounts when authenticated user changes',()=>{
 assert.match(app,/const userId = session\?\.user\?\.id/);
 assert.match(app,/<RemittanceDemoScreen key=\{userId\} userId=\{userId\} supabase=\{supabase\} adminRole=\{adminRole\} \/>/);
});
test('remittance screen remains inside owner-only administration gate',()=>{
 const owner=app.indexOf("adminRole === 'owner' ? (");
 const remittance=app.indexOf('<RemittanceDemoScreen key={userId}');
 const other=app.indexOf(') : adminRole ? (',owner);
 assert.ok(owner>=0 && remittance>owner && other>remittance);
});
