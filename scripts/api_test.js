const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
(async ()=>{
  try {
    console.log('Registering student...');
    let res = await fetch('http://localhost:3001/api/auth/register', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username:'student1', password:'secret', role:'student' }) });
    console.log('Status', res.status);
    let body = await res.json().catch(()=>null);
    console.log('Body', body);
    const token = body?.token;
    if (!token) return console.log('No token from register, exiting');
    console.log('Creating student profile...');
    res = await fetch('http://localhost:3001/api/students', { method: 'POST', headers: {'Content-Type':'application/json', 'Authorization': 'Bearer '+token}, body: JSON.stringify({ full_name: 'Student One', major: 'CS', gpa: '3.8' }) });
    console.log('Create student status', res.status);
    body = await res.json().catch(()=>null);
    console.log('Create body', body);
    // Login as admin to create company
    console.log('Logging in admin...');
    res = await fetch('http://localhost:3001/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username:'admin@local', password:'adminpass' })});
    const admin = await res.json();
    const adminToken = admin.token;
    console.log('Admin token?', !!adminToken);
    console.log('Creating company...');
    res = await fetch('http://localhost:3001/api/companies', { method:'POST', headers:{'Content-Type':'application/json', 'Authorization':'Bearer '+adminToken}, body: JSON.stringify({ name:'TestCo', industry:'Tech', openings:5 })});
    const comp = await res.json();
    console.log('Created company', comp);
    console.log('Applying as student to company...');
    res = await fetch('http://localhost:3001/api/applications', { method:'POST', headers:{'Content-Type':'application/json', 'Authorization':'Bearer '+token}, body: JSON.stringify({ company_id: comp.company.id }) });
    console.log('Apply status', res.status);
    const appRes = await res.json().catch(()=>null);
    console.log('Apply body', appRes);
    if (appRes?.id) {
      console.log('Adding note to application...');
      res = await fetch('http://localhost:3001/api/applications/'+appRes.id, { method:'PATCH', headers:{'Content-Type':'application/json', 'Authorization':'Bearer '+token}, body: JSON.stringify({ notes: 'My first note' })});
      console.log('Patch status', res.status);
      console.log('Patch body', await res.json().catch(()=>null));
    }
  } catch (e) { console.error('Error in script', e); }
})();