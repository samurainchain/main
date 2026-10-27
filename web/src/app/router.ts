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
    default:
      return { name: 'today' }
  }
}

export function routeHref(route: Route): string {
  switch (route.name) {
    case 'trade':
      return `#/trades/${encodeURIComponent(route.id)}`
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
