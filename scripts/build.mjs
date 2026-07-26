// Gera dist/ (bundle) + release/hostgator-amarelinho/ para jhonatanribeiro.com/amarelinho
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

process.chdir(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const DIST = "dist";
const HOST = path.join("release", "hostgator-amarelinho");
const CACHE = "v28";

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, "styles"), { recursive: true });
fs.mkdirSync(path.join(DIST, "assets"), { recursive: true });

fs.copyFileSync("src/styles/styles.css", path.join(DIST, "styles", "styles.css"));
if (fs.existsSync("manifest.webmanifest")) {
  fs.copyFileSync("manifest.webmanifest", path.join(DIST, "manifest.webmanifest"));
}
if (fs.existsSync("sw.js")) {
  let sw = fs.readFileSync("sw.js", "utf8");
  sw = sw.replace(/amarelinho-v\d+/g, `amarelinho-${CACHE}`);
  fs.writeFileSync(path.join(DIST, "sw.js"), sw);
}
if (fs.existsSync("assets")) {
  for (const name of fs.readdirSync("assets")) {
    const from = path.join("assets", name);
    if (fs.statSync(from).isFile()) {
      fs.copyFileSync(from, path.join(DIST, "assets", name));
    }
  }
}

execSync(
  "npx esbuild src/js/main.js --bundle --format=esm --outfile=dist/game.js --minify --legal-comments=none",
  { stdio: "inherit" }
);

let html = fs.readFileSync("index.html", "utf8");
html = html
  .replace(/src\/styles\/styles\.css\?v=[^"]+/g, `styles/styles.css?v=${CACHE}`)
  .replace(/src\/js\/main\.js\?v=[^"]+/g, `game.js?v=${CACHE}`)
  .replace(/window\.AMA_BUILD\s*=\s*"[^"]*"/, `window.AMA_BUILD = "${CACHE}"`)
  .replace(/<script type="importmap">[\s\S]*?<\/script>\s*/m, "");

fs.writeFileSync(path.join(DIST, "index.html"), html);

// Caixa de pitacos (PHP na HostGator). Pasta data/ NÃO sobe no FTP —
// o PHP cria data/ + .htaccess no primeiro envio (evita 553 no deploy).
for (const folder of ["pitacos", "sugestoes"]) {
  if (!fs.existsSync(folder)) continue;
  const out = path.join(DIST, folder);
  fs.cpSync(folder, out, {
    recursive: true,
    filter: (src) => !src.includes(`${path.sep}data${path.sep}`) && !src.endsWith(`${path.sep}data`),
  });
}

fs.rmSync(HOST, { recursive: true, force: true });
fs.cpSync(DIST, HOST, { recursive: true });
console.log(`OK dist/ + ${HOST} (cache ${CACHE})`);
