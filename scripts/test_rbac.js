const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
(async ()=>{
  try {
    console.log('Starting RBAC tests');
    const base = 'http://localhost:3001/api';
    // Login admin
    console.log('Logging in admin...');
    let res = await fetch(base + '/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username:'admin@local', password:'adminpass' }) });
    const admin = await res.json();
    if (!admin.token) return console.error('Admin login failed', admin);
    console.log('Admin token OK');

    // Register company user
    res = await fetch(base + '/auth/register', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username:'comp1', password:'secret', role:'company' }) });
    const compReg = await res.json();
    const compToken = compReg.token;
    console.log('Company registered, token?', !!compToken);

    // Create company as company user (should be allowed)
    res = await fetch(base + '/companies', { method:'POST', headers:{'Content-Type':'application/json', 'Authorization':'Bearer '+compToken}, body: JSON.stringify({ name:'CompOne', industry:'Tech' }) });
    const compCreate = await res.json();
    console.log('Company created', compCreate.company ? 'OK' : compCreate);
    const compId = compCreate.company?.id;

    // Register student user
    res = await fetch(base + '/auth/register', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username:'student1', password:'secret', role:'student' }) });
    const studReg = await res.json();
    const studToken = studReg.token;
    console.log('Student registered, token?', !!studToken);

    // Student creates profile
    res = await fetch(base + '/students', { method:'POST', headers:{'Content-Type':'application/json', 'Authorization':'Bearer '+studToken}, body: JSON.stringify({ full_name:'Student One', major:'CS' }) });
    const studCreate = await res.json();
    console.log('Student profile created', studCreate.student ? 'OK' : studCreate);

    // Admin: GET /api/students -> should return list
    res = await fetch(base + '/students', { headers:{'Authorization':'Bearer '+admin.token} });
    const sAdmin = await res.json();
    console.log('Admin /students length', Array.isArray(sAdmin) ? sAdmin.length : JSON.stringify(sAdmin));

    // Company: GET /api/students -> should be 403
    res = await fetch(base + '/students', { headers:{'Authorization':'Bearer '+compToken} });
    const sComp = await res.json(); console.log('Company /students response', sComp);

    // Student: GET /api/students -> should return own profile array
    res = await fetch(base + '/students', { headers:{'Authorization':'Bearer '+studToken} });
    const sStud = await res.json(); console.log('Student /students response', sStud);

    // Company: GET /api/companies (public) -> OK
    res = await fetch(base + '/companies'); const companies = await res.json(); console.log('Public /companies count', companies.length || 0);

    // Company: export CSV for own company -> should work
    res = await fetch(base + `/companies/${compId}/export`, { headers:{'Authorization':'Bearer '+compToken} });
    console.log('Company export status', res.status);

    // Student applies to company
    res = await fetch(base + '/applications', { method:'POST', headers:{'Content-Type':'application/json', 'Authorization':'Bearer '+studToken}, body: JSON.stringify({ company_id: compId }) });
    const app = await res.json(); console.log('Student applied:', app);

    // Student: GET /api/applications -> should only include their app
    res = await fetch(base + '/applications', { headers:{'Authorization':'Bearer '+studToken} }); const studApps = await res.json(); console.log('Student applications length', studApps.length);

    // Company: GET /api/applications -> should include app for that company
    res = await fetch(base + '/applications', { headers:{'Authorization':'Bearer '+compToken} }); const compApps = await res.json(); console.log('Company applications length', compApps.length);

    // Ensure student cannot GET another student by id
    const otherId = (Array.isArray(sAdmin) && sAdmin.find(s=>s.username!== 'student1')?.id) || null;
    if (otherId) {
      res = await fetch(base + `/students/${otherId}`, { headers:{'Authorization':'Bearer '+studToken} }); console.log('/students/:id as student status', res.status);
    }

    console.log('RBAC tests completed');
  } catch (e) { console.error('RBAC test script error', e); }
})();