import { spawn } from "node:child_process"
import { createRequire } from "node:module"

/**
 * Lance la CLI Expo du projet depuis un dossier dont la lettre de lecteur est en majuscule.
 * Sous Windows, le terminal de VS Code ouvre souvent le dépôt en `c:\...` : Metro construit alors
 * des chemins `c:\C:\...` et le bundle échoue (« Unable to resolve ...\src\app\(auth)\_layout.tsx »).
 * Sans effet sur macOS et Linux.
 */
const cwd = process.cwd().replace(/^[a-z]:/, (drive) => drive.toUpperCase())
const expoCli = createRequire(`${cwd}/package.json`).resolve("expo/bin/cli")

const child = spawn(process.execPath, [expoCli, ...process.argv.slice(2)], { cwd, stdio: "inherit" })
child.on("exit", (code) => process.exit(code ?? 0))
