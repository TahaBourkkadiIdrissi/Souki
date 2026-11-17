import { readdirSync, readFileSync, statSync } from "node:fs"
import { createRequire } from "node:module"
import { join, relative } from "node:path"

/**
 * Contrôle du thème sombre (pnpm --filter @souki/play-store check:theme).
 *
 * Les couleurs du thème (`palette`, `colors`, `m3`, `gradients`, `shadows`, `tokens`, `cardShadow`)
 * changent avec le thème : elles doivent être lues PENDANT le rendu. Une lecture au chargement du
 * module (constante de premier niveau) resterait figée en clair. Ce script liste ces lectures.
 * Les couleurs fixes (`brand`) sont permises partout.
 */
const require = createRequire(import.meta.url)
const ts = require("typescript")

const root = join(import.meta.dirname, "..", "src")
const THEMED = new Set(["palette", "colors", "m3", "gradients", "shadows", "tokens", "cardShadow"])

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return files(path)
    return /\.(ts|tsx)$/.test(name) && name !== "theme.ts" ? [path] : []
  })
}

function insideFunction(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isFunctionLike(current)) return true
  }
  return false
}

const problems = []
for (const file of files(root)) {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const visit = (node) => {
    if (ts.isIdentifier(node) && THEMED.has(node.text) && !insideFunction(node)) {
      const parent = node.parent
      const isImport = ts.isImportSpecifier(parent) || ts.isImportClause(parent)
      const isPropertyName = ts.isPropertyAccessExpression(parent) && parent.name === node
      const isKey = (ts.isPropertyAssignment(parent) || ts.isPropertySignature(parent) || ts.isBindingElement(parent)) && (parent.name === node || parent.propertyName === node)
      if (!isImport && !isPropertyName && !isKey) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart())
        problems.push(`${relative(join(root, ".."), file)}:${line + 1}  ${source.text.split("\n")[line].trim().slice(0, 110)}`)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
}

if (problems.length > 0) {
  console.log(`${problems.length} couleur(s) du thème lue(s) hors du rendu (resteraient en clair dans le thème sombre) :\n`)
  console.log(problems.join("\n"))
  process.exit(1)
}
console.log("Thème : toutes les couleurs sont lues au rendu.")
