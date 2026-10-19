import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/repositories/catalog.mjs';
import { engagementEndpoint,sqliteBinding } from '../server/services/engagement.mjs';
test('statistics accepts only the explicitly allowed Pages origin',async()=>{
 const db=openDatabase(':memory:');
 try {
  const request=origin=>new Request('https://api.test/api/library',{method:'POST',headers:{origin},body:JSON.stringify({id:'test',kind:'like',active:false,visitor:'00000000-0000-4000-8000-000000000000'})});
  const options={allowedOrigins:['https://kada798.github.io']};
  assert.equal((await engagementEndpoint(request('https://kada798.github.io'),sqliteBinding(db),['test'],options)).status,200);
  assert.equal((await engagementEndpoint(request('https://other.github.io'),sqliteBinding(db),['test'],options)).status,403);
 }finally{db.close();}
});
