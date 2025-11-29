    /**********************
     * MOCK & STORAGE
     **********************/
    const seed = {
      users: [
        { id: 'u1', role: 'darbuotojas', email: 'user@demo.lt', password: 'demo', name: 'Jonas' },
        { id: 'u2', role: 'ukvedys', email: 'ukvedys@demo.lt', password: 'demo', name: 'Aistė' },
      ],
      cars: [
        { id: 'c1', plate:'MAK 001', title:'VW Passat Variant', image:'images/passat.png' },
        { id: 'c2', plate:'DDL 320', title:'BMW 330i', image:'images/bmw.png' },
        { id: 'c3', plate:'CAP 300', title:'Mercedes-Benz C300', image:'images/mercedes.png' },
      ],
      reservations: [],
      defects: [],
      docs: [
        { carId:'c1', taValidUntil: addDaysISO(20), insuranceUntil: addDaysISO(120) },
        { carId:'c2', taValidUntil: addDaysISO(-5), insuranceUntil: addDaysISO(40) }, // pasibaigusi TA -> blokas
        { carId:'c3', taValidUntil: addDaysISO(60), insuranceUntil: addDaysISO(200) },
      ],
      blocks: [
        { carId:'c2', reason:'TA negalioja', from:addDaysISO(-5), to:addDaysISO(30) }
      ]
    };

    function addDaysISO(d){
      const x = new Date(); x.setDate(x.getDate()+d);
      return x.toISOString();
    }

    const DB_KEY = 'fleet_proto_v1';
    function loadDB(){
      const raw = localStorage.getItem(DB_KEY);
      if(!raw){ localStorage.setItem(DB_KEY, JSON.stringify(seed)); return structuredClone(seed); }
      try{ return JSON.parse(raw); }catch(e){ localStorage.setItem(DB_KEY, JSON.stringify(seed)); return structuredClone(seed); }
    }
    function saveDB(db){ localStorage.setItem(DB_KEY, JSON.stringify(db)); }
    function resetDB(){ localStorage.removeItem(DB_KEY); location.reload(); }

    let db = loadDB();

    /**********************
     * AUTH
     **********************/
    function currentUser(){
      const id = localStorage.getItem('auth_id');
      if(!id) return null;
      return db.users.find(u=>u.id===id)||null;
    }
    function login(email, password){
      const u = db.users.find(u=>u.email===email && u.password===password);
      if(!u) return { ok:false, message:'Neteisingi duomenys' };
      localStorage.setItem('auth_id', u.id);
      return { ok:true };
    }
    function logout(){
      localStorage.removeItem('auth_id');
      location.hash = '#/login';
      render();
    }

    /**********************
     * HELPERS
     **********************/
    const fmt = (iso)=> new Date(iso).toLocaleString('lt-LT', {hour12:false});
    const fmtDate = (iso)=> new Date(iso).toLocaleDateString('lt-LT');
    function overlaps(aFrom,aTo,bFrom,bTo){
      return (new Date(aFrom) < new Date(bTo)) && (new Date(bFrom) < new Date(aTo));
    }
    function carBlocked(carId, from, to){
      const blocks = db.blocks.filter(b=>b.carId===carId);
      return blocks.some(b=> overlaps(from,to,b.from,b.to));
    }
    function carReserved(carId, from, to){
      const res = db.reservations.filter(r=>r.carId===carId);
      return res.some(r=> overlaps(from,to,r.from,r.to));
    }
    function ensureDocsBlock(){
      // Auto-blokas, kai TA pasibaigus
      const now = new Date();
      db.docs.forEach(d=>{
        const ta = new Date(d.taValidUntil);
        const has = db.blocks.some(b=>b.carId===d.carId && b.reason==='TA negalioja');
        if(ta < now && !has){
          db.blocks.push({ carId:d.carId, reason:'TA negalioja', from:new Date(now.getTime()-86400000).toISOString(), to:addDaysISO(365) });
        }
      });
      saveDB(db);
    }
    ensureDocsBlock();

    function setUserArea(){
      const area = document.getElementById('userArea');
      const u = currentUser();
      if(!u){
        area.innerHTML = `<button class="btn" onclick="location.hash='#/login'">Prisijungti</button>`;
      }else{
        area.innerHTML = `
          <span class="pill">Vartotojas: <b>${u.name}</b> (${u.role})</span>
          <button class="btn" onclick="location.hash='#/';render()">Pagrindinis</button>
          ${u.role === 'darbuotojas'
            ? `<button class="btn" onclick="location.hash='#/my'">Mano rezervacijos</button>`
            : ''}
          ${u.role === 'ukvedys'
            ? `<button class="btn" onclick="location.hash='#/admin'">Administravimas</button>`
            : ''}
          <button class="btn danger" onclick="logout()">Atsijungti</button>
        `;
      }
    }
    function createDefectForCar(carId){
      const descEl = document.getElementById('def_desc_car');
      const prioEl = document.getElementById('def_priority_car');
      if (!descEl || !prioEl) return;

      const desc = descEl.value.trim();
      const priority = prioEl.value || 'nekritinis';
      if (!desc) {
        alert('Įrašykite aprašą');
        return;
      }

      db.defects.push({
        id: 'd'+cryptoRandom(),
        carId,
        desc,
        priority,
        status: 'atidarytas',
        createdAt: new Date().toISOString(),
        closedAt: null,
        serviceNote: '',
        serviceDocName: ''
      });

      if (priority === 'kritinis') {
        const from = new Date().toISOString();
        const to   = addDaysISO(3);
        db.blocks.push({ carId, reason:'Defektas (kritinis)', from, to });
      }

      saveDB(db);
      alert('Defektas užregistruotas.');
      render();
    }


    /**********************
     * VIEWS
     **********************/
    function viewLogin(){
      const u = currentUser();
      if(u){ location.hash='#/'; return viewHome(); }

      return `
        <div class="grid cols-2">
          <div class="card">
            <h2>Prisijungimas</h2>
            <div class="grid">
              <div>
                <label>El. paštas</label>
                <input id="login_email" value="user@demo.lt" />
              </div>
              <div>
                <label>Slaptažodis</label>
                <input id="login_pass" type="password" value="demo" />
              </div>
              <div>
                <button class="btn acc" onclick="doLogin()">Prisijungti</button>
                <button class="btn" onclick="fillManager()">Naudoti ūkvedį</button>
              </div>
              <div class="muted mini">Demo: <b>user@demo.lt/demo</b> arba <b>ukvedys@demo.lt/demo</b></div>
            </div>
          </div>
          <div class="card">
            <h3>Apie prototipą</h3>
            <p class="muted">Statinis, mock duomenys: rezervacijos, defektai, automobilių blokai (TA/draudimas), ūkvedžio skydelis.</p>
            <div class="kpi">
              <span class="pill">LocalStorage</span>
              <span class="pill">Demo TA blokai</span>
              <span class="pill">Greiti filtrai</span>
            </div>
          </div>
        </div>
      `;
    }

    function doLogin(){
      const email = document.getElementById('login_email').value.trim();
      const pass  = document.getElementById('login_pass').value;
      const res = login(email, pass);
      if(!res.ok){ alert(res.message); return; }
      setUserArea();
      location.hash = '#/';
      render();
    }
    function fillManager(){
      document.getElementById('login_email').value = 'ukvedys@demo.lt';
      document.getElementById('login_pass').value = 'demo';
    }

    function viewHome(){
      const u = currentUser();
      if(!u){ location.hash='#/login'; return viewLogin(); }

      // URL parametrai (hash query)
      const params = new URLSearchParams(location.hash.split('?')[1]||'');
      const from = params.get('from') || '';
      const to   = params.get('to')   || '';

      // Laisvi automobiliai pagal intervalą (jei parinktas)
      let list = db.cars.map(c=>{
        let status = 'Laisvas';
        if(from && to){
          if(carBlocked(c.id, from, to)) status = 'UŽBLOKUOTAS';
          else if(carReserved(c.id, from, to)) status = 'Užimtas';
        }
        return { ...c, status };
      });

      const card = (c)=> `
        <div class="card car">
          <img src="${c.image}" alt="">
          <div style="flex:1">
            <h3 style="margin:0 0 6px 0">${c.title} <span class="muted">(${c.plate})</span></h3>
            <div class="kpi" style="margin-top:8px">
              ${
                c.status==='Laisvas' ? `<span class="pill status-free">Laisvas</span>` :
                c.status==='Užimtas' ? `<span class="pill status-busy">Užimtas</span>` :
                `<span class="pill status-busy">Užblokuotas</span>`
              }
            </div>
          </div>
          <div class="right">
            <button class="btn" onclick="location.hash='#/car?id=${c.id}'">Peržiūrėti</button>
            ${
              (from && to && c.status==='Laisvas' && u.role === 'darbuotojas')
                ? `<button class="btn ok" onclick="reserve('${c.id}','${from}','${to}')">Rezervuoti</button>`
                : ''
            }
          </div>
        </div>
      `;

      return `
        <div class="grid">
          <div class="card">
            <h2>Rask laiką</h2>
            <div class="row">
              <div>
                <label>Nuo</label>
                <input type="datetime-local" id="from" value="${from ? toLocalInput(from):''}">
              </div>
              <div>
                <label>Iki</label>
                <input type="datetime-local" id="to" value="${to ? toLocalInput(to):''}">
              </div>
            </div>
            <div style="margin-top:10px;display:flex;gap:8px">
              <button class="btn acc" onclick="applyRange()">Taikyti</button>
              <button class="btn" onclick="clearRange()">Išvalyti</button>
              <button class="btn warn" onclick="quick('2')">+2h</button>
              <button class="btn warn" onclick="quick('24')">+24h</button>
            </div>
          </div>

          <div class="card">
            <h2>Automobiliai</h2>
            <div class="list">
              ${list.map(card).join('')}
            </div>
          </div>
        </div>
      `;
    }

    function toLocalInput(iso){
      const d = new Date(iso);
      const pad = (n)=> String(n).padStart(2,'0');
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    function fromLocalInput(v){ return new Date(v).toISOString(); }

    function applyRange(){
      const f = document.getElementById('from').value;
      const t = document.getElementById('to').value;
      if(!f || !t){ alert('Pasirinkite laikotarpį'); return; }
      location.hash = `#/?from=${encodeURIComponent(fromLocalInput(f))}&to=${encodeURIComponent(fromLocalInput(t))}`;
      render();
    }
    function clearRange(){
      location.hash = `#/`;
      render();
    }
    function quick(h){
      const now = new Date();
      const to  = new Date(now.getTime()+Number(h)*3600000);
      location.hash = `#/?from=${encodeURIComponent(now.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
      render();
    }
    function reserve(carId, from, to){
      const u = currentUser();
      if(!u) return alert('Prisijunkite');

      if (u.role !== 'darbuotojas') {
        alert('Tik darbuotojai gali rezervuoti automobilius.');
        return;
      }

      if(carBlocked(carId,from,to)) return alert('Automobilis užblokuotas šiame intervale.');
      if(carReserved(carId,from,to)) return alert('Automobilis jau užimtas šiame intervale.');

      db.reservations.push({
        id: 'r'+cryptoRandom(),
        userId: u.id,
        carId,
        from,
        to,
        status:'patvirtinta',
        createdAt:new Date().toISOString()
      });

      saveDB(db);
      alert('Rezervacija sukurta.');
      render();
    }
    function cryptoRandom(){
      return Math.random().toString(36).slice(2,9);
    }

    function viewMy(){
      const u = currentUser();
      if(!u){ location.hash='#/login'; return viewLogin(); }

      if (u.role !== 'darbuotojas') {
        location.hash = '#/admin';
        return viewAdmin();
      }
      const mine = db.reservations
        .filter(r=>r.userId===u.id)
        .sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt));

      return `
        <div class="card">
          <h2>Mano rezervacijos</h2>
          <table class="table mini">
            <thead>
              <tr><th>Auto</th><th>Nuo</th><th>Iki</th><th>Būsena</th><th></th></tr>
            </thead>
            <tbody>
              ${mine.map(r=>{
                const car = db.cars.find(c=>c.id===r.carId);
                return `<tr>
                  <td>${car?.title||'?' } <span class="muted">(${car?.plate||'?'})</span></td>
                  <td>${fmt(r.from)}</td>
                  <td>${fmt(r.to)}</td>
                  <td>${r.status}</td>
                  <td><button class="btn danger mini" onclick="cancelRes('${r.id}')">Atšaukti</button></td>
                </tr>`;
              }).join('') || `<tr><td colspan="5" class="muted">Rezervacijų nėra.</td></tr>`}
            </tbody>
          </table>
        </div>

            <div class="card" style="margin-top:12px">
        <h3>Pranešti apie problemą</h3>
        <p class="muted mini">
          Jei važiuojant su rezervuotu automobiliu pastebėjote problemą,
          spauskite „Pranešti apie problemą“ ir pasirinkite automobilį iš sąrašo.
        </p>
        <button class="btn warn" onclick="location.hash='#/problem'">
          Pranešti apie problemą
        </button>
      </div>
      `;
    }
    function cancelRes(id){
      db.reservations = db.reservations.filter(r=>r.id!==id);
      saveDB(db);
      render();
    }
    function taStatus(iso){
      const now = new Date();
      const d = new Date(iso);
      const diffDays = (d - now) / 86400000;
      if (diffDays < 0) return { label:'PASIBAIGĘ', class:'bad' };
      if (diffDays < 30) return { label:'ARTĖJA PABAIGA', class:'warn' };
      return { label:'OK', class:'good' };
    }
    function createDefectForCar(carId){
      const descEl = document.getElementById('def_desc_car');
      if (!descEl) return;
      const desc = descEl.value.trim();
      if (!desc) return alert('Įrašykite aprašą');

      const prioEl = document.getElementById('def_priority_car');
      const priority = prioEl ? prioEl.value : 'nekritinis';

      db.defects.push({
        id: 'd' + cryptoRandom(),
        carId,
        desc,
        priority,
        status: 'atidarytas',
        createdAt: new Date().toISOString(),
        closedAt: null
      });

      // kritinis defektas → blokas
      if (priority === 'kritinis') {
        const from = new Date().toISOString();
        const to   = addDaysISO(999999); // ilgam
        db.blocks.push({ carId, reason:'Defektas (kritinis)', from, to });
      }

      saveDB(db);
      alert('Defektas užregistruotas.');
      render(); // perpiešia tą patį car view su atnaujinta istorija
    }
    function createDefect(){
      const carId = document.getElementById('def_car').value;
      const desc  = document.getElementById('def_desc').value.trim();
      const priority = document.getElementById('def_priority').value || 'nekritinis';
      if(!desc) return alert('Įrašykite aprašą');

      db.defects.push({
        id: 'd'+cryptoRandom(),
        carId,
        desc,
        priority,          
        status:'atidarytas',
        createdAt:new Date().toISOString(),
        closedAt:null
      });

      // Blokuojam tik jei kritinis
      if (priority === 'kritinis') {
        const from = new Date().toISOString();
        const to   = addDaysISO(3);
        db.blocks.push({ carId, reason:'Defektas (kritinis)', from, to });
      }

      saveDB(db);
      alert('Defektas užregistruotas' + (priority === 'kritinis' ? ' ir automobilis užblokuotas.' : '.'));
      render();
    }
        function viewProblem(){
      const u = currentUser();
      if (!u){ 
        location.hash = '#/login'; 
        return viewLogin(); 
      }
      if (u.role !== 'darbuotojas') {
        // ūkvedį ir kitus gražiai nuspiriam
        location.hash = '#/admin';
        return viewAdmin();
      }

      // automobiliai, kuriuos šitas useris yra rezervavęs
      const myCarIds = [...new Set(
        db.reservations
          .filter(r => r.userId === u.id)
          .map(r => r.carId)
      )];

      const myCars = db.cars.filter(c => myCarIds.includes(c.id));

      if (myCars.length === 0) {
        return `
          <div class="card">
            <h2>Pranešti apie problemą</h2>
            <p class="muted">
              Neturite aktyvių ar buvusių rezervacijų, todėl negalite pranešti apie problemą.
            </p>
            <button class="btn" onclick="location.hash='#/'">Atgal</button>
          </div>
        `;
      }

      return `
        <div class="card">
          <h2>Pranešti apie problemą</h2>
          <div class="row">
            <div>
              <label>Automobilis</label>
              <select id="problem_car">
                ${myCars.map(c => `
                  <option value="${c.id}">${c.title} (${c.plate})</option>
                `).join('')}
              </select>
            </div>
            <div>
              <label>Problemos aprašymas</label>
              <input id="problem_desc" placeholder="Lemputė, garsas, gedimas..." />
            </div>
          </div>
          <div style="margin-top:10px; display:flex; gap:8px">
            <button class="btn warn" onclick="submitProblem()">Pateikti</button>
            <button class="btn" onclick="location.hash='#/my'">Atgal</button>
          </div>
        </div>
      `;
    }
        function submitProblem(){
      const u = currentUser();
      if (!u || u.role !== 'darbuotojas'){
        alert('Tik darbuotojai gali pranešti apie problemą.');
        return;
      }

      const carIdEl = document.getElementById('problem_car');
      const descEl  = document.getElementById('problem_desc');
      if (!carIdEl || !descEl) return;

      const carId = carIdEl.value;
      const desc  = descEl.value.trim();

      if (!desc) {
        alert('Įveskite problemos aprašymą.');
        return;
      }

      db.defects.push({
        id: 'd'+cryptoRandom(),
        carId,
        desc,
        priority: 'nekritinis', // darbuotojas neskirsto
        status: 'atidarytas',
        createdAt: new Date().toISOString(),
        closedAt: null
      });

      saveDB(db);
      alert('Problema užregistruota ir perduota ūkvedžiui.');
      location.hash = '#/my';
      render();
    }
    function viewAdmin(){
      const u = currentUser();
      if(!u || u.role!=='ukvedys'){ location.hash='#/login'; return viewLogin(); }

      const blocks = db.blocks.map(b=>{
        const car = db.cars.find(c=>c.id===b.carId);
        return `<tr>
          <td>${car?.title||'?'} <span class="muted">(${car?.plate||'?'})</span></td>
          <td>${b.reason}</td>
          <td>${fmt(b.from)}</td>
          <td>${fmt(b.to)}</td>
          <td><button class="btn mini" onclick="endBlock('${b.carId}','${b.from}','${b.to}')">Nuimti</button></td>
        </tr>`;
      }).join('');

      const defects = db.defects.slice().reverse().map(d=>{
        const car = db.cars.find(c=>c.id===d.carId);
        return `<tr>
          <td>${car?.title||'?'} <span class="muted">(${car?.plate||'?'})</span></td>
          <td>${d.desc}</td>
          <td>${d.priority || '-'}</td>
          <td>${d.status}</td>
          <td>${fmt(d.createdAt)}</td>
          <td>${d.closedAt?fmt(d.closedAt):'-'}</td>
          <td>${d.serviceNote || '<span class="muted mini">Nenurodyta</span>'}</td>
          <td>${
            d.serviceDocName
              ? `<span class="mini">${d.serviceDocName}</span>`
              : `<input type="file" class="mini" onchange="uploadServiceDoc('${d.id}', this)">`
          }</td>
          <td>
            ${d.status==='atidarytas'
              ? `<button class="btn ok mini" onclick="closeDefect('${d.id}')">Uždaryti</button>`
              : `<span class="muted">Uždarytas</span>`}
          </td>
        </tr>`;
      }).join('');

      const docs = db.docs.map(doc=>{
        const car = db.cars.find(c=>c.id===doc.carId);
        const taS  = validityStatus(doc.taValidUntil);
        const insS = validityStatus(doc.insuranceUntil);
        return `<tr>
          <td>${car?.title} <span class="muted">(${car?.plate})</span></td>
          <td>
            ${fmtDate(doc.taValidUntil)}
            <span class="mini ${taS.class}">${taS.label}</span>
          </td>
          <td>
            ${fmtDate(doc.insuranceUntil)}
            <span class="mini ${insS.class}">${insS.label}</span>
          </td>
          <td>
            <button class="btn mini" onclick="extendTA('${doc.carId}')">Nustatyti naują TA</button>
            <button class="btn mini" onclick="extendINS('${doc.carId}')">Nustatyti naują draudimą</button>
          </td>
        </tr>`;
      }).join('');

      return `
        <div class="grid">
          <div class="card">
            <h2>Ūkvedžio skydelis</h2>
            <div class="kpi">
              <span class="pill">Automobilių: ${db.cars.length}</span>
              <span class="pill">Rezervacijų: ${db.reservations.length}</span>
              <span class="pill">Defektų: ${db.defects.length}</span>
              <span class="pill">Blokų: ${db.blocks.length}</span>
            </div>
            <div style="margin-top:10px;display:flex;gap:8px">
              <button class="btn" onclick="resetDB()">🔁 Reset duomenų</button>
            </div>
          </div>

          <div class="card">
            <h3>Blokai</h3>
            <table class="table mini">
              <thead><tr><th>Auto</th><th>Priežastis</th><th>Nuo</th><th>Iki</th><th></th></tr></thead>
              <tbody>${blocks || '<tr><td colspan="5" class="muted">Nėra</td></tr>'}</tbody>
            </table>
          </div>

          <div class="card">
            <h3>Defektai ir techninės priežiūros darbai</h3>
            <table class="table mini">
              <thead>
                <tr>
                  <th>Auto</th>
                  <th>Aprašas</th>
                  <th>Prioritetas</th>
                  <th>Statusas</th>
                  <th>Sukurta</th>
                  <th>Uždaryta</th>
                  <th>Serviso darbai</th>
                  <th>Serviso dokumentas</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>${defects || '<tr><td colspan="9" class="muted">Nėra</td></tr>'}</tbody>
            </table>
          </div>

          <div class="card">
            <h3>Dokumentai (TA / draudimas)</h3>
            <table class="table mini">
              <thead><tr><th>Auto</th><th>TA iki</th><th>Draudimas iki</th><th>Veiksmai</th></tr></thead>
              <tbody>${docs}</tbody>
            </table>
          </div>
        </div>
      `;
    }
    function validityStatus(iso){
      const now = new Date();
      const d = new Date(iso);
      const diffDays = (d - now) / 86400000;

      if (isNaN(diffDays)) {
        return { label:'-', class:'muted' };
      }

      if (diffDays < 0) {
        return { label:'PASIBAIGUSI', class:'bad' };     
      }
      if (diffDays < 30) {
        return { label:'ARTĖJA PABAIGA', class:'warn' };  
      }
      return { label:'OK', class:'success' };             
    }
    function uploadServiceDoc(defectId, inputEl){
      const file = inputEl.files[0];
      if (!file) return;
      const d = db.defects.find(x=>x.id===defectId);
      if (!d) return;
      d.serviceDocName = file.name;
      d.serviceDocUploadedAt = new Date().toISOString();
      saveDB(db);
      render();
    }
    function createManualBlock(){
      const carId = document.getElementById('blk_car').value;
      const fromVal = document.getElementById('blk_from').value;
      const toVal   = document.getElementById('blk_to').value;
      const reason  = document.getElementById('blk_reason').value.trim() || 'Planinis darbas';

      if (!fromVal || !toVal) return alert('Nurodykite laikotarpį');

      const from = fromLocalInput(fromVal);
      const to   = fromLocalInput(toVal);

      if (new Date(from) >= new Date(to)) return alert('Nuo turi būti ankstesnė data nei Iki');

      db.blocks.push({ carId, reason, from, to });
      saveDB(db);
      render();
    }
    function endBlock(carId, from, to){
      db.blocks = db.blocks.filter(b=> !(b.carId===carId && b.from===from && b.to===to));
      saveDB(db); render();
    }
    function closeDefect(id){
      const d = db.defects.find(x=>x.id===id);
      if(!d) return;
      d.status = 'uzdarytas';
      d.closedAt = new Date().toISOString();
      // nuimti bloką, jei buvo dėl defekto (pagal laiką ~ dabar)
      db.blocks = db.blocks.filter(b=> !(b.carId===d.carId && b.reason==='Defektas'));
      saveDB(db); render();
    }
    function extendTA(carId){
      const doc = db.docs.find(d=>d.carId===carId); if(!doc) return;
      const input = prompt("Įveskite naują TA galiojimo datą (YYYY-MM-DD):", doc.taValidUntil.slice(0,10));
      if (!input) return;
      const d = new Date(input);
      if (isNaN(d.getTime())) { alert("Neteisinga data"); return; }
      doc.taValidUntil = d.toISOString();
      db.blocks = db.blocks.filter(b=> !(b.carId===carId && b.reason==='TA negalioja'));
      saveDB(db); render();
    }
    function extendINS(carId){
      const doc = db.docs.find(d=>d.carId===carId); if(!doc) return;
      const input = prompt("Įveskite naują draudimo galiojimo datą (YYYY-MM-DD):", doc.insuranceUntil.slice(0,10));
      if (!input) return;
      const d = new Date(input);
      if (isNaN(d.getTime())) { alert("Neteisinga data"); return; }
      doc.insuranceUntil = d.toISOString();
      saveDB(db); render();
    }
    function viewCar(){
      const u = currentUser();
      if(!u){ location.hash='#/login'; return viewLogin(); }

      const params = new URLSearchParams(location.hash.split('?')[1]||'');
      const id = params.get('id');
      const car = db.cars.find(c=>c.id===id);
      if(!car) return `<div class="card">Nerastas automobilis.</div>`;

      const doc  = db.docs.find(d=>d.carId===id);
      const resv = db.reservations.filter(r=>r.carId===id).sort((a,b)=>new Date(b.from)-new Date(a.from));
      const dfc  = db.defects.filter(d=>d.carId===id).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));

      return `
        <div class="grid">
          <div class="card">
            <div class="car">
              <img src="${car.image}" alt="">
              <div style="flex:1">
                <h2 style="margin:0">${car.title} <span class="muted">(${car.plate})</span></h2>
                <div class="mini muted">Vieta: ${car.location}</div>
                <div class="kpi" style="margin-top:8px">
                  <span class="pill">TA iki: ${doc?fmtDate(doc.taValidUntil):'-'}</span>
                  <span class="pill">Draudimas iki: ${doc?fmtDate(doc.insuranceUntil):'-'}</span>
                </div>
                <div style="margin-top:8px">
                  <button class="btn" onclick="history.back()">Atgal</button>
                </div>
              </div>
            </div>
          </div>

          <div class="card">
            <h3>Rezervacijų istorija</h3>
            <table class="table mini">
              <thead><tr><th>Nuo</th><th>Iki</th><th>Vartotojas</th></tr></thead>
              <tbody>
                ${
                  resv.length
                  ? resv.map(r=>{
                      const usr = db.users.find(u=>u.id===r.userId);
                      return `<tr>
                        <td>${fmt(r.from)}</td>
                        <td>${fmt(r.to)}</td>
                        <td>${usr?.name||usr?.email||'?'}</td>
                      </tr>`;
                    }).join('')
                  : `<tr><td colspan="3" class="muted">Nėra</td></tr>`
                }
              </tbody>
            </table>
          </div>

          <div class="card">
            <h3>Defektai ir techninės priežiūros darbai</h3>
            <table class="table mini">
              <thead><tr><th>Aprašas</th><th>Prioritetas</th><th>Statusas</th><th>Sukurta</th></tr></thead>
              <tbody>
                ${
                  dfc.length
                  ? dfc.map(d=>`
                    <tr>
                      <td>${d.desc}</td>
                      <td>${d.priority || '-'}</td>
                      <td>${d.status}</td>
                      <td>${fmt(d.createdAt)}</td>
                    </tr>
                  `).join('')
                  : `<tr><td colspan="4" class="muted">Nėra</td></tr>`
                }
              </tbody>
            </table>
          </div>

          ${u.role === 'ukvedys' ? `
          <div class="card">
            <h3>Naujas defektas (ūkvedys)</h3>
            <div class="row">
              <div>
                <label>Aprašas</label>
                <input id="def_desc_car" placeholder="Triukšmas, įlenkimas, padanga..." />
              </div>
              <div>
                <label>Prioritetas</label>
                <select id="def_priority_car">
                  <option value="nekritinis">Nekritinis</option>
                  <option value="kritinis">Kritinis</option>
                </select>
              </div>
            </div>
            <div style="margin-top:8px">
              <button class="btn warn" onclick="createDefectForCar('${car.id}')">Sukurti defektą</button>
            </div>
          </div>
          ` : ''}
        </div>
      `;
    }

    /**********************
     * ROUTER
     **********************/
    function render(){
      setUserArea();
      const root = document.getElementById('view');
      const hash = location.hash.split('?')[0] || '#/login';
      let html = '';
      if(hash==='#/login') html = viewLogin();
      else if(hash==='#/' || hash==='#') html = viewHome();
      else if(hash==='#/my') html = viewMy();
      else if(hash==='#/admin') html = viewAdmin();
      else if(hash==='#/car') html = viewCar();
      else if(hash==='#/problem') html = viewProblem(); // <--- ČIA
      else html = `<div class="card">Nerasta.</div>`;
      root.innerHTML = html;
    }
    window.addEventListener('hashchange', render);
    render();