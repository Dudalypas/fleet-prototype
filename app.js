import { loadState, saveState } from './mock.js';
import { initRouter, navigate, refreshRoute } from './router.js';

const state = loadState();
let flashMessage = null;

function persist() {
  saveState(state);
}

function setFlash(message) {
  flashMessage = message;
}

function consumeFlash() {
  const msg = flashMessage;
  flashMessage = null;
  return msg;
}

function nowIsoPlus(hours = 0) {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

function toInputValue(date) {
  const pad = (num) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function overlaps(aFrom, aTo, bFrom, bTo) {
  const startA = new Date(aFrom).getTime();
  const endA = new Date(aTo).getTime();
  const startB = new Date(bFrom).getTime();
  const endB = new Date(bTo).getTime();
  return startA < endB && startB < endA;
}

function getAvailability(carId, from, to) {
  const car = state.cars.find((c) => c.id === carId);
  if (!car) return 'unknown';
  if (car.blocked) return 'blocked';
  const busy = state.reservations.some((r) => r.carId === carId && overlaps(r.from, r.to, from, to));
  return busy ? 'busy' : 'free';
}

function formatDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleString();
}

function requireAuth() {
  if (!state.session) {
    navigate('/login');
    return false;
  }
  return true;
}

function requireRole(role) {
  if (!requireAuth()) return false;
  if (state.session.role !== role) {
    navigate('/browse');
    return false;
  }
  return true;
}

function login(email, password) {
  const user = state.users.find((u) => u.email === email && u.password === password);
  if (!user) {
    return { success: false, error: 'Neteisingi prisijungimo duomenys' };
  }
  state.session = { userId: user.id, role: user.role, email: user.email, name: user.name };
  persist();
  return { success: true };
}

function logout() {
  state.session = null;
  persist();
}

function createReservation({ carId, from, to }) {
  if (!requireAuth()) return { success: false };
  const availability = getAvailability(carId, from, to);
  if (availability !== 'free') {
    return { success: false, error: 'Laikas jau užimtas arba automobilis neprieinamas.' };
  }
  const reservation = {
    id: `r_${Date.now()}`,
    carId,
    userId: state.session.userId,
    from,
    to,
    status: 'patvirtinta'
  };
  state.reservations.push(reservation);
  persist();
  return { success: true, reservation };
}

function cancelReservation(reservationId) {
  const index = state.reservations.findIndex((r) => r.id === reservationId);
  if (index > -1) {
    state.reservations.splice(index, 1);
    persist();
    return true;
  }
  return false;
}

function createDefect({ carId, desc, critical, photoUrl }) {
  if (!requireAuth()) return { success: false };
  const defect = {
    id: `d_${Date.now()}`,
    carId,
    userId: state.session.userId,
    desc,
    critical,
    photoUrl,
    status: 'atidarytas',
    createdAt: new Date().toISOString()
  };
  state.defects.push(defect);
  persist();
  return { success: true, defect };
}

function updateDefectStatus(id, status) {
  const defect = state.defects.find((d) => d.id === id);
  if (!defect) return false;
  defect.status = status;
  persist();
  return true;
}

function toggleCarBlock(carId) {
  const car = state.cars.find((c) => c.id === carId);
  if (!car) return false;
  car.blocked = !car.blocked;
  persist();
  return car.blocked;
}

function getContext() {
  return {
    state,
    actions: {
      login,
      logout,
      createReservation,
      cancelReservation,
      createDefect,
      updateDefectStatus,
      toggleCarBlock
    },
    helpers: {
      nowIsoPlus,
      overlaps,
      getAvailability,
      formatDate,
      toInputValue
    },
    requireAuth,
    requireRole,
    navigate,
    refresh: refreshRoute,
    setFlash,
    consumeFlash
  };
}

initRouter(getContext);


