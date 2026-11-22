import { loadEnv } from 'vite';
const env=loadEnv('development',process.cwd());
const base=env.VITE_SUPABASE_URL;
const key=env.VITE_SUPABASE_PUBLISHABLE_KEY;
const auth=await fetch(base+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email:'Demo@gmail.com',password:'Demo1234'})});
const session=await auth.json();
if(!auth.ok) throw new Error('Demo sign-in failed: '+(session.msg||session.error_description));
const headers={apikey:key,Authorization:'Bearer '+session.access_token};
async function read(path){const r=await fetch(base+'/rest/v1/'+path,{headers}); const data=await r.json(); return {data:r.ok?data:null,error:r.ok?null:data.message};}
const owner=session.user.id;
console.log(JSON.stringify({account:'Demo@gmail.com',...(await read('pets?select=id,name,breed&owner_id=eq.'+owner))}));
for(const table of ['model_versions','model_version_classes','skin_images','analyses','predictions','prediction_scores']){const result=await read(table+'?select=*&limit=1');console.log(JSON.stringify({table,columns:Object.keys(result.data?.[0]||{}),error:result.error}));}
console.log(JSON.stringify({existingHistory:await read('doo_pet_history?select=id,pet,date,disease,score&owner_id=eq.'+owner)}));
