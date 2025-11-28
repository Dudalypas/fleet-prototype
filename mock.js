const STORAGE_KEY = 'fleetPrototypeState';

const seedUsers = [
  { id: 'u1', email: 'user@demo.lt', password: 'demo', role: 'darbuotojas', name: 'Jonas' },
  { id: 'u2', email: 'ukvedys@demo.lt', password: 'demo', role: 'ukvedys', name: 'Asta' }
];

const seedCars = [
  { id: 'c1', title: 'VW Passat', plate: 'ABC123', location: 'Vilnius', blocked: false },
  { id: 'c2', title: 'BMW 320d', plate: 'JDD446', location: 'Kaunas', blocked: false },
  { id: 'c3', title: 'Skoda Octavia', plate: 'KAA777', location: 'Vilnius', blocked: true }
];

export const users = seedUsers;
export const cars = seedCars;
export const reservations = [];
export const defects = [];

const defaultState = {
  users,
  cars,
  reservations,
  defects,
  session: null
};

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        users: parsed.users || seedUsers.slice(),
        cars: parsed.cars || seedCars.slice(),
        reservations: parsed.reservations || [],
        defects: parsed.defects || [],
        session: parsed.session || null
      };
    }
  } catch (err) {
    console.warn('Failed to parse stored state, using defaults', err);
  }
  return JSON.parse(JSON.stringify(defaultState));
}

export function saveState(state) {
  const snapshot = {
    users: state.users,
    cars: state.cars,
    reservations: state.reservations,
    defects: state.defects,
    session: state.session
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}
