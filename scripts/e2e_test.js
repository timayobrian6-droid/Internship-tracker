const http = require('http');

function req(path, method='GET', body=null, token=null){
  const opts = {
    hostname: 'localhost', port: 5000, path, method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  return new Promise((resolve, reject) => {
    const r = http.request(opts, (res) => {
      let data='';
      res.on('data', c=>data+=c);
      res.on('end', ()=>{
        try { const json = JSON.parse(data || '{}'); resolve({status: res.statusCode, body: json}); }
        catch(e){ resolve({status: res.statusCode, body: data}); }
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

(async ()=>{
  try {
    console.log('Registering user...');
    const reg = await req('/api/auth/register','POST',{ username: 'itest_run', password: 'pass123', role: 'student'});
    console.log('REGISTER:', reg.status, JSON.stringify(reg.body));

    const token = reg.body && reg.body.token;
    if (!token) return console.error('No token returned from register');

    console.log('\nCreating student profile...');
    const prof = await req('/api/students','POST',{ full_name: 'It Test', major: 'Computer Science', gpa: 3.5, age: 22, university: 'State U', phone: '1234567890', email: 'itest@example.com'}, token);
    console.log('PROFILE:', prof.status, JSON.stringify(prof.body));

    console.log('\nLogging in...');
    const login = await req('/api/auth/login','POST',{ username: 'itest_run', password: 'pass123'});
    console.log('LOGIN:', login.status, JSON.stringify(login.body));

  } catch (e){ console.error('E2E ERROR', e); }
})();
