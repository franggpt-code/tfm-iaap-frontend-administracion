import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const angularCli = resolve(projectRoot, "node_modules", "@angular", "cli", "bin", "ng.js");
const distDir = resolve(projectRoot, "dist");
const angularBrowserDir = resolve(distDir, "tfm-iaap-frontend-administracion", "browser");
const clientDir = resolve(distDir, "client");
const serverDir = resolve(distDir, "server");

const build = spawnSync(process.execPath, [angularCli, "build", "--configuration", "sites"], {
  cwd: projectRoot,
  stdio: "inherit",
});

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

if (!existsSync(angularBrowserDir)) {
  throw new Error(`No se ha generado el directorio esperado: ${angularBrowserDir}`);
}

rmSync(clientDir, { recursive: true, force: true });
rmSync(serverDir, { recursive: true, force: true });
cpSync(angularBrowserDir, clientDir, { recursive: true });
rmSync(resolve(distDir, "tfm-iaap-frontend-administracion"), { recursive: true, force: true });
mkdirSync(serverDir, { recursive: true });

writeFileSync(
  resolve(serverDir, "index.js"),
  `const BACKEND_ORIGIN = "https://tfm-iaap-backend.onrender.com";
const SPA_INDEX = "/index.html";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/sicol" || url.pathname.startsWith("/api/sicol/")) {
      const backendUrl = new URL(url.pathname.slice("/api".length) + url.search, BACKEND_ORIGIN);
      const headers = new Headers(request.headers);
      headers.delete("content-length");
      headers.delete("host");
      headers.delete("origin");
      headers.delete("referer");

      return fetch(
        new Request(backendUrl, {
          method: request.method,
          headers,
          body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
          redirect: "manual",
        }),
      );
    }

    const asset = await env.ASSETS.fetch(request);

    if (asset.status !== 404 || request.method !== "GET") {
      return asset;
    }

    const requestedFile = url.pathname.split("/").pop()?.includes(".");
    if (requestedFile || url.pathname.startsWith("/api/")) {
      return asset;
    }

    return env.ASSETS.fetch(new Request(new URL(SPA_INDEX, url), request));
  },
};
`,
);
