// Reads CSV text as exchanges export it: an optional byte-order mark, comma, semicolon or tab
// separators (picked from the header line), quoted cells with "" escapes and CRLF line ends.

export interface CsvTable {
  rows: string[][]
  delimiter: ',' | ';' | '\t'
}

const DELIMITERS = [',', ';', '\t'] as const

/** Separators outside quotes on one line. */
function countDelimiter(line: string, delimiter: string): number {
  let count = 0
  let quoted = false
  for (const char of line) {
    if (char === '"') quoted = !quoted
    else if (char === delimiter && !quoted) count += 1
  }
  return count
}

export function parseCsv(text: string): CsvTable {
  const clean = text.replace(/^﻿/, '')
  const header = clean.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = [...DELIMITERS].sort((a, b) => countDelimiter(header, b) - countDelimiter(header, a))[0]!

  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < clean.length; index++) {
    const char = clean[index]!
    if (quoted) {
      if (char === '"' && clean[index + 1] === '"') {
        cell += '"'
        index += 1
      } else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"') quoted = true
    else if (char === delimiter) {
      row.push(cell)
      cell = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && clean[index + 1] === '\n') index += 1
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += char
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return { rows: rows.map((cells) => cells.map((value) => value.trim())).filter((cells) => cells.some(Boolean)), delimiter }
}
