import {
  renderLogin,
  renderBrowse,
  renderReserve,
  renderMy,
  renderDefectNew,
  renderDefectDetail,
  renderCarDetail,
  renderAdmin
} from './ui.js';

const routes = {
  '/login': renderLogin,
  '/browse': renderBrowse,
  '/reserve/:id': renderReserve,
  '/my': renderMy,
  '/defects/new': renderDefectNew,
  '/defects/:id': renderDefectDetail,
  '/cars/:id': renderCarDetail,
  '/admin': renderAdmin
};

let contextProvider = null;
export function initRouter(provider) {
  contextProvider = provider;
  window.addEventListener('hashchange', handleRoute);
  document.addEventListener('DOMContentLoaded', handleRoute);
  if (!window.location.hash) {
    navigate('/login');
  } else {
    handleRoute();
  }
}

export function navigate(target) {
  if (target.startsWith('#')) {
    window.location.hash = target;
  } else {
    window.location.hash = `#${target}`;
  }
}

export function refreshRoute() {
  handleRoute(true);
}

function handleRoute(isRefresh = false) {
  const hash = window.location.hash || '#/login';
  const normalized = hash.startsWith('#') ? hash.slice(1) : hash;
  const [pathPart, queryString = ''] = normalized.split('?');
  const match = matchRoute(pathPart || '/login');
  if (!match) {
    navigate('/login');
    return;
  }
  const query = Object.fromEntries(new URLSearchParams(queryString));
  const ctx = contextProvider ? contextProvider() : {};
  match.handler({ ...ctx, params: match.params, query });
}

function matchRoute(path) {
  const cleanedPath = path || '/login';
  const pathParts = cleanedPath.split('/').filter(Boolean);
  for (const [pattern, handler] of Object.entries(routes)) {
    const patternParts = pattern.split('/').filter(Boolean);
    if (patternParts.length !== pathParts.length) continue;
    const params = {};
    let matched = true;
    for (let i = 0; i < patternParts.length; i += 1) {
      const patternSegment = patternParts[i];
      const pathSegment = pathParts[i];
      if (patternSegment.startsWith(':')) {
        params[patternSegment.slice(1)] = decodeURIComponent(pathSegment);
      } else if (patternSegment !== pathSegment) {
        matched = false;
        break;
      }
    }
    if (matched) {
      return { handler, params };
    }
  }
  return null;
}
