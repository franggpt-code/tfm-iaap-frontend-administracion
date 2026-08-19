import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const releaseVersion = readFileSync(resolve(projectRoot, "VERSION"), "utf8").trim();

if (!/^\d+\.\d+\.\d+$/.test(releaseVersion)) {
  throw new Error("VERSION debe contener una versión base X.Y.Z, sin sufijo.");
}

const snapshotVersion = `${releaseVersion}-SNAPSHOT`;
const packageJson = JSON.parse(readFileSync(resolve(projectRoot, "package.json"), "utf8"));
const packageLock = JSON.parse(readFileSync(resolve(projectRoot, "package-lock.json"), "utf8"));
const versionSource = readFileSync(resolve(projectRoot, "src/app/version.ts"), "utf8");
const versionMatch = versionSource.match(/export const APP_VERSION = "([^"]+)";/);

const versions = [
  ["package.json", packageJson.version],
  ["package-lock.json", packageLock.version],
  ["package-lock.json packages[\"\"]", packageLock.packages?.[""]?.version],
  ["src/app/version.ts", versionMatch?.[1]],
];

const inconsistent = versions.filter(([, version]) => version !== snapshotVersion);

if (inconsistent.length > 0) {
  const details = inconsistent.map(([file, version]) => `${file}=${version ?? "sin valor"}`).join(", ");
  throw new Error(`Versión incoherente. Se esperaba ${snapshotVersion}: ${details}`);
}

console.log(`Versión frontend validada: ${snapshotVersion}; próximo tag de prueba: ${releaseVersion}-test`);
