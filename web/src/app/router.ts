import { useSyncExternalStore } from 'react'

// Hash-based routing: GitHub Pages serves static files only, so every route has to resolve
// to index.html, and the part after # never reaches the server.

export type Route =
  | { name: 'today' }
  | { name: 'trades' }
  | { name: 'trade'; id: string }
  | { name: 'analytics' }
  | { name: 'profile' }
  | { name: 'accounts' }
  | { name: 'rules' }
  | { name: 'tags' }
  | { name: 'review'; week?: string }

export function parseRoute(hash: string): Route {
  const [first, second] = hash.replace(/^#\/?/, '').split('/')
  switch (first) {
    case 'trades':
      return second ? { name: 'trade', id: decodeURIComponent(second) } : { name: 'trades' }
    case 'analytics':
      return { name: 'analytics' }
    case 'profile':
      return { name: 'profile' }
    case 'accounts':
      return { name: 'accounts' }
    case 'rules':
      return { name: 'rules' }
    case 'tags':
      return { name: 'tags' }
    case 'review':
      return second && /^\d{4}-\d{2}-\d{2}$/.test(second) ? { name: 'review', week: second } : { name: 'review' }
    default:
      return { name: 'today' }
  }
}

export function routeHref(route: Route): string {
  switch (route.name) {
    case 'trade':
      return `#/trades/${encodeURIComponent(route.id)}`
    case 'review':
      return route.week ? `#/review/${route.week}` : '#/review'
    default:
      return `#/${route.name}`
  }
}

export function navigate(route: Route): void {
  window.location.hash = routeHref(route)
}

function subscribe(listener: () => void): () => void {
  window.addEventListener('hashchange', listener)
  return () => window.removeEventListener('hashchange', listener)
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return parseRoute(hash)
}
