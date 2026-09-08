import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
const root = path.resolve(import.meta.dirname, "..");
const roles = ["client", "livreur", "admin"];
function files(dir) {
  return fs.readdirSync(dir, {withFileTypes:true}).flatMap(entry => {
    if (["node_modules", ".next", "public"].includes(entry.name)) return [];
    const name = path.join(dir, entry.name);
    return entry.isDirectory() ? files(name) : /\.[cm]?[jt]sx?$/.test(name) ? [name] : [];
  });
}
for (const role of roles) {
  const app = path.join(root, "apps", role);
  for (const file of files(app)) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(/(?:from\s*|import\s*\(?\s*|require\s*\(\s*)["']([^"']+)["']/g)) {
      const spec = match[1];
      const resolved = spec.startsWith("@/") ? path.resolve(app, spec.slice(2)) : spec.startsWith(".") ? path.resolve(path.dirname(file), spec) : null;
      if (resolved) assert.ok(resolved.startsWith(app + path.sep), `Import hors interface : ${file} -> ${spec}`);
    }
    if (role === "client") {
      assert.ok(!/["']\/(?:devenir-fournisseur|fournisseur|supplier|admin|livreur|parent)(?:\/|["'])/.test(source), `Route étrangère dans ${file}`);
    }
    if (role === "admin") {
      assert.ok(!/["']\/admin\/fournisseurs(?:\/|["'])/.test(source), `Route fournisseur dans ${file}`);
    }
  }
  for (const forbidden of ["fournisseur", "devenir-fournisseur", "parent", ...roles.filter(other => other !== role && other !== "client")]) {
    assert.ok(!fs.existsSync(path.join(app, "app", forbidden)), `${role} contient la route ${forbidden}`);
  }
  if (role !== "admin") assert.ok(!fs.readFileSync(path.join(app, "contexts/auth-context.tsx"), "utf8").includes("/auth/admin/login"), `${role} contient une connexion admin`);
  if (role === "admin") {
    assert.ok(!fs.existsSync(path.join(app, "app/manifest.ts")), "Admin ne doit pas proposer une PWA");
    assert.ok(!fs.existsSync(path.join(app, "public/sw.js")), "Admin ne doit pas avoir de service worker");
  }
  console.log(`${role}: frontieres verifiees`);
}
