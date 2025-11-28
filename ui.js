\ufefffunction statusPill(status) {
  if (status === 'free') {
    return '<span class="pill green">Laisvas</span>';
  }
  return '<span class="pill red">U\u017eimtas</span>';
}

export function renderLayout(ctx, contentHtml = '') {
  const appEl = document.getElementById('app');
  if (!appEl) return null;
  const session = ctx.state.session;
  const flash = ctx.consumeFlash ? ctx.consumeFlash() : null;
  const navLinks = session
    ? `
        <a href="#/browse">Browse</a>
        <a href="#/my">Mano rezervacijos</a>
        <a href="#/defects/new">Defektas</a>
        ${session.role === 'ukvedys' ? '<a href="#/admin">Admin</a>' : ''}
      `
    : '';
  const accountSection = session
    ? `<div class="account">A\u0161 (${session.email}) <button id="logoutBtn" class="link-btn">Atsijungti</button></div>`
    : '<a href="#/login">Prisijungti</a>';
  appEl.innerHTML = `
    <header class="navbar">
      <div class="brand">Rezervacij\u0173 sistema</div>
      <div class="links">
        <span class="nav-links">${navLinks}</span>
        ${accountSection}
      </div>
    </header>
    ${flash ? `<div class="flash">${flash}</div>` : ''}
    <main id="view">${contentHtml}</main>
  `;
  if (session) {
    const logoutBtn = appEl.querySelector('#logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        ctx.actions.logout();
        ctx.navigate('/login');
      });
    }
  }
  return appEl.querySelector('#view');
}

export function renderLogin(ctx) {
  if (ctx.state.session) {
    ctx.navigate('/browse');
    return;
  }
  const content = `
    <section>
      <h2>Prisijungimas</h2>
      <form id="loginForm">
        <label>El. pa\u0161tas
          <input type="email" name="email" required placeholder="user@demo.lt" />
        </label>
        <label>Slapta\u017eodis
          <input type="password" name="password" required placeholder="demo" />
        </label>
        <button type="submit">Prisijungti</button>
        <p id="loginError" class="error"></p>
      </form>
    </section>
  `;
  const view = renderLayout(ctx, content);
  if (!view) return;
  const form = view.querySelector('#loginForm');
  const errorEl = view.querySelector('#loginError');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const email = data.get('email');
    const password = data.get('password');
    const result = ctx.actions.login(email, password);
    if (result.success) {
      if (ctx.setFlash) ctx.setFlash('S\u0117kmingai prisijungta.');
      ctx.navigate('/browse');
    } else if (errorEl) {
      errorEl.textContent = result.error || 'Nepavyko prisijungti';
    }
  });
}

export function renderBrowse(ctx) {
  if (!ctx.requireAuth()) return;
  const { query = {} } = ctx;
  const now = new Date();
  const defaultFrom = ctx.helpers.toInputValue(now);
  const defaultTo = ctx.helpers.toInputValue(new Date(now.getTime() + 2 * 3600 * 1000));
  const fromValue = query.from || defaultFrom;
  const toValue = query.to || defaultTo;
  const cards = ctx.state.cars
    .map((car) => {
      const availability = ctx.helpers.getAvailability(car.id, fromValue, toValue);
      const busyText = availability === 'free' ? '' : (car.blocked ? '<p>Automobilis \u0161iuo metu blokuotas.</p>' : '');
      const disabled = availability !== 'free' ? 'disabled' : '';
      return `
        <div class="card">
          <h3>${car.title}</h3>
          <p><strong>Valst. nr.:</strong> ${car.plate}</p>
          <p><strong>Vieta:</strong> ${car.location}</p>
          <p>${statusPill(availability)}</p>
          ${busyText}
          <button class="reserve-btn" data-id="${car.id}" ${disabled}>Rezervuoti</button>
        </div>
      `;
    })
    .join('');
  const content = `
    <section>
      <h2>Automobili\u0173 per\u017ei\u016bra</h2>
      <form id="rangeForm" class="range-form">
        <label>Nuo
          <input type="datetime-local" name="from" value="${fromValue}" required />
        </label>
        <label>Iki
          <input type="datetime-local" name="to" value="${toValue}" required />
        </label>
        <button type="submit">Rodyti</button>
      </form>
      <div class="grid">
        ${cards || '<p>N\u0117ra automobili\u0173.</p>'}
      </div>
    </section>
  `;
  const view = renderLayout(ctx, content);
  if (!view) return;
  const form = view.querySelector('#rangeForm');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const from = data.get('from');
    const to = data.get('to');
    ctx.navigate(`/browse?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  });
  view.querySelectorAll('.reserve-btn').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const { id } = event.currentTarget.dataset;
      ctx.navigate(`/reserve/${id}?from=${encodeURIComponent(fromValue)}&to=${encodeURIComponent(toValue)}`);
    });
  });
}

export function renderReserve(ctx) {
  if (!ctx.requireAuth()) return;
  const { params = {}, query = {} } = ctx;
  const { id } = params;
  const car = ctx.state.cars.find((c) => c.id === id);
  if (!car) {
    if (ctx.setFlash) ctx.setFlash('Automobilis nerastas.');
    ctx.navigate('/browse');
    return;
  }
  const fromValue = query.from || ctx.helpers.toInputValue(new Date());
  const toValue = query.to || ctx.helpers.toInputValue(new Date(Date.now() + 2 * 3600 * 1000));
  const content = `
    <section>
      <h2>Rezervacija</h2>
      <div class="card">
        <p><strong>Automobilis:</strong> ${car.title} (${car.plate})</p>
        <p><strong>Laikotarpis:</strong> ${ctx.helpers.formatDate(fromValue)} \u2013 ${ctx.helpers.formatDate(toValue)}</p>
        <button id="confirmReservation">Patvirtinti rezervacij\u0105</button>
        <p id="reserveError" class="error"></p>
      </div>
    </section>
  `;
  const view = renderLayout(ctx, content);
  if (!view) return;
  const btn = view.querySelector('#confirmReservation');
  const errorEl = view.querySelector('#reserveError');
  btn.addEventListener('click', () => {
    const result = ctx.actions.createReservation({ carId: car.id, from: fromValue, to: toValue });
    if (result.success) {
      if (ctx.setFlash) ctx.setFlash('Rezervacija sukurta.');
      ctx.navigate('/my');
    } else if (errorEl) {
      errorEl.textContent = result.error || 'Nepavyko sukurti rezervacijos.';
    }
  });
}

export function renderMy(ctx) {
  if (!ctx.requireAuth()) return;
  const userId = ctx.state.session.userId;
  const reservations = ctx.state.reservations
    .filter((r) => r.userId === userId)
    .sort((a, b) => new Date(a.from) - new Date(b.from));
  const rows = reservations
    .map((r) => {
      const car = ctx.state.cars.find((c) => c.id === r.carId);
      return `
        <tr>
          <td>${car ? car.title : 'Ne\u017einomas'}</td>
          <td>${ctx.helpers.formatDate(r.from)}</td>
          <td>${ctx.helpers.formatDate(r.to)}</td>
          <td>${r.status}</td>
          <td><button class="cancel-btn" data-id="${r.id}">At\u0161aukti</button></td>
        </tr>
      `;
    })
    .join('');
  const table = reservations.length
    ? `<table>
        <thead><tr><th>Automobilis</th><th>Nuo</th><th>Iki</th><th>B\u016bsena</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`
    : '<p>Rezervacij\u0173 n\u0117ra.</p>';
  const content = `
    <section>
      <div class="actions">
        <button id="newDefect">Registruoti defekt\u0105</button>
      </div>
      <h2>Mano rezervacijos</h2>
      ${table}
    </section>
  `;
  const view = renderLayout(ctx, content);
  if (!view) return;
  const defectBtn = view.querySelector('#newDefect');
  defectBtn.addEventListener('click', () => ctx.navigate('/defects/new'));
  view.querySelectorAll('.cancel-btn').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const { id } = event.currentTarget.dataset;
      ctx.actions.cancelReservation(id);
      if (ctx.setFlash) ctx.setFlash('Rezervacija at\u0161aukta.');
      ctx.refresh();
    });
  });
}

export function renderDefectNew(ctx) {
  if (!ctx.requireAuth()) return;
  const options = ctx.state.cars
    .map((car) => `<option value="${car.id}">${car.title} (${car.plate})</option>`)
    .join('');
  const content = `
    <section>
      <h2>Defekto registracija</h2>
      <form id="defectForm">
        <label>Automobilis
          <select name="carId" required>
            ${options}
          </select>
        </label>
        <label>Apra\u0161ymas
          <textarea name="desc" rows="3" required></textarea>
        </label>
        <label>
          <input type="checkbox" name="critical" /> Kritinis defektas
        </label>
        <label>Nuotraukos URL (neb\u016btina)
          <input type="url" name="photoUrl" placeholder="https://" />
        </label>
        <button type="submit">Registruoti</button>
      </form>
    </section>
  `;
  const view = renderLayout(ctx, content);
  if (!view) return;
  const form = view.querySelector('#defectForm');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const payload = {
      carId: data.get('carId'),
      desc: data.get('desc'),
      critical: Boolean(data.get('critical')),
      photoUrl: data.get('photoUrl') || ''
    };
    const result = ctx.actions.createDefect(payload);
    if (result.success) {
      if (ctx.setFlash) ctx.setFlash('Defektas u\u017eregistruotas.');
      ctx.navigate(`/defects/${result.defect.id}`);
    }
  });
}

export function renderDefectDetail(ctx) {
  if (!ctx.requireAuth()) return;
  const { params = {} } = ctx;
  const defect = ctx.state.defects.find((d) => d.id === params.id);
  if (!defect) {
    renderLayout(ctx, '<p>Defektas nerastas.</p>');
    return;
  }
  const car = ctx.state.cars.find((c) => c.id === defect.carId);
  const canManage = ctx.state.session.role === 'ukvedys';
  const content = `
    <section>
      <h2>Defekto informacija</h2>
      <div class="card">
        <p><strong>Automobilis:</strong> <a href="#/cars/${car ? car.id : ''}">${car ? car.title : 'Ne\u017einomas'}</a></p>
        <p><strong>Apra\u0161ymas:</strong> ${defect.desc}</p>
        <p><strong>Kritinis:</strong> ${defect.critical ? 'Taip' : 'Ne'}</p>
        <p><strong>B\u016bsena:</strong> ${defect.status}</p>
        ${defect.photoUrl ? `<p><img src="${defect.photoUrl}" alt="Defekto nuotrauka" class="defect-photo" /></p>` : ''}
        ${canManage ? `
          <div class="actions">
            <button id="closeDefect">Pa\u017eym\u0117ti kaip sutvarkyta</button>
            <button id="toggleBlock">${car && car.blocked ? 'Atblokuoti auto' : 'Blokuoti auto'}</button>
          </div>
        ` : ''}
      </div>
    </section>
  `;
  const view = renderLayout(ctx, content);
  if (!view || !canManage) return;
  const closeBtn = view.querySelector('#closeDefect');
  const toggleBtn = view.querySelector('#toggleBlock');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      ctx.actions.updateDefectStatus(defect.id, 'u\u017edarytas');
      if (ctx.setFlash) ctx.setFlash('Defektas u\u017edarytas.');
      ctx.refresh();
    });
  }
  if (toggleBtn && car) {
    toggleBtn.addEventListener('click', () => {
      ctx.actions.toggleCarBlock(car.id);
      if (ctx.setFlash) ctx.setFlash('Automobilio b\u016bsena atnaujinta.');
      ctx.refresh();
    });
  }
}

export function renderCarDetail(ctx) {
  if (!ctx.requireAuth()) return;
  const { params = {} } = ctx;
  const car = ctx.state.cars.find((c) => c.id === params.id);
  if (!car) {
    renderLayout(ctx, '<p>Automobilis nerastas.</p>');
    return;
  }
  const reservations = ctx.state.reservations
    .filter((r) => r.carId === car.id)
    .sort((a, b) => new Date(b.from) - new Date(a.from))
    .slice(0, 3);
  const defects = ctx.state.defects
    .filter((d) => d.carId === car.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 3);
  const resList = reservations
    .map((r) => `<li>${ctx.helpers.formatDate(r.from)} \u2013 ${ctx.helpers.formatDate(r.to)} (${r.status})</li>`)
    .join('') || '<li>N\u0117ra duomen\u0173</li>';
  const defectList = defects
    .map((d) => `<li><a href="#/defects/${d.id}">${d.desc}</a> \u2013 ${d.status}</li>`)
    .join('') || '<li>N\u0117ra duomen\u0173</li>';
  const content = `
    <section>
      <h2>${car.title}</h2>
      <div class="card">
        <p><strong>Valst. nr.:</strong> ${car.plate}</p>
        <p><strong>Vieta:</strong> ${car.location}</p>
        <p><strong>B\u016bsena:</strong> ${car.blocked ? 'Neprieinamas' : 'Eksploatacijoje'}</p>
        ${ctx.state.session.role === 'ukvedys' ? `<div class="actions"><button id="toggleCarBlock">${car.blocked ? 'Atblokuoti' : 'Blokuoti'}</button> <button id="maintenance">Naujas prie\u017ei\u016bros darbas</button></div>` : ''}
      </div>
      <h3>Paskutin\u0117s rezervacijos</h3>
      <ul>${resList}</ul>
      <h3>Paskutiniai defektai</h3>
      <ul>${defectList}</ul>
    </section>
  `;
  const view = renderLayout(ctx, content);
  if (!view) return;
  if (ctx.state.session.role === 'ukvedys') {
    const toggleBtn = view.querySelector('#toggleCarBlock');
    const maintenanceBtn = view.querySelector('#maintenance');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        ctx.actions.toggleCarBlock(car.id);
        if (ctx.setFlash) ctx.setFlash('Automobilio b\u016bsena pakeista.');
        ctx.refresh();
      });
    }
    if (maintenanceBtn) {
      maintenanceBtn.addEventListener('click', () => {
        alert('Placeholder: prie\u017ei\u016bros registracija.');
      });
    }
  }
}

export function renderAdmin(ctx) {
  if (!ctx.requireRole('ukvedys')) return;
  const carsRows = ctx.state.cars
    .map((car) => `
      <tr>
        <td>${car.title}</td>
        <td>${car.plate}</td>
        <td>${car.location}</td>
        <td>${car.blocked ? 'Neprieinamas' : 'Eksploatacijoje'}</td>
        <td><a href="#/cars/${car.id}">Per\u017ei\u016br\u0117ti</a></td>
      </tr>
    `)
    .join('');
  const blocked = ctx.state.cars.filter((car) => car.blocked);
  const blockedList = blocked
    .map((car) => `<li>${car.title} (${car.plate}) <button class="unblock-btn" data-id="${car.id}">Atblokuoti</button></li>`)
    .join('') || '<li>N\u0117ra blokuot\u0173 automobili\u0173.</li>';
  const openDefects = ctx.state.defects.filter((d) => d.status === 'atidarytas');
  const defectList = openDefects
    .map((d) => {
      const car = ctx.state.cars.find((c) => c.id === d.carId);
      return `<li><a href="#/defects/${d.id}">${d.desc}</a> \u2013 ${car ? car.title : 'Ne\u017einomas'}</li>`;
    })
    .join('') || '<li>N\u0117ra atvir\u0173 defekt\u0173.</li>';
  const content = `
    <section>
      <h2>\u016akved\u017eio panel\u0117</h2>
      <h3>Automobiliai</h3>
      <table>
        <thead><tr><th>Pavadinimas</th><th>Valst. nr.</th><th>Vieta</th><th>B\u016bsena</th><th></th></tr></thead>
        <tbody>${carsRows}</tbody>
      </table>
      <h3>Aktyv\u016bs blokai</h3>
      <ul>${blockedList}</ul>
      <h3>Atviri defektai</h3>
      <ul>${defectList}</ul>
    </section>
  `;
  const view = renderLayout(ctx, content);
  if (!view) return;
  view.querySelectorAll('.unblock-btn').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const { id } = event.currentTarget.dataset;
      ctx.actions.toggleCarBlock(id);
      if (ctx.setFlash) ctx.setFlash('Automobilis atblokuotas.');
      ctx.refresh();
    });
  });
}
