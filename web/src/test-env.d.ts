// Node APIs used by tests that read source files. The app itself never imports Node modules,
// so this narrow declaration stands in for @types/node.
declare module 'node:fs' {
  export function readFileSync(path: URL | string, encoding: 'utf8'): string
}
