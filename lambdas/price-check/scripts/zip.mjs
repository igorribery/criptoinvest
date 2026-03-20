import { execSync } from "node:child_process";
import { copyFileSync, existsSync, rmSync, writeFileSync } from "node:fs";

// Empacota index.js na RAIZ + node_modules (Lambda procura handler "index.handler" em index.js)
const zipName = "lambda.zip";
if (existsSync(zipName)) rmSync(zipName);

if (!existsSync("dist/index.cjs")) {
  throw new Error("dist/index.cjs não existe. Rode npm run build antes.");
}

// Lambda com handler "index.handler" procura index.js na raiz.
copyFileSync("dist/index.cjs", "index.js");

// Zip mínimo: apenas index.js + package.json (sem node_modules).
// IMPORTANTE: `tar -a` no Windows pode gerar arquivo com extensão .zip que NÃO é ZIP válido.
// Por isso forçamos Compress-Archive (ZIP real e compatível com AWS Lambda).
//
// Outro detalhe: nosso bundle está em CommonJS. Se o zip contiver um package.json com `"type":"module"`,
// o Node tratará index.js como ESM e vai falhar com "module is not defined".
// Então geramos um package.json mínimo com type=commonjs só para o runtime da Lambda.
// IMPORTANTE: não sobrescrever permanentemente o package.json do projeto.
const originalPackageJsonPath = "package.json";
const originalPackageJsonBackupPath = "package.json.bak";
copyFileSync(originalPackageJsonPath, originalPackageJsonBackupPath);
try {
  writeFileSync(
    originalPackageJsonPath,
    JSON.stringify(
      {
        name: "criptoinvest-price-check",
        private: true,
        type: "commonjs",
      },
      null,
      2,
    ) + "\n",
    "utf-8",
  );

  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path index.js,package.json -DestinationPath ${zipName} -Force"`,
    { stdio: "inherit" },
  );
} finally {
  copyFileSync(originalPackageJsonBackupPath, originalPackageJsonPath);
  rmSync(originalPackageJsonBackupPath);
}

console.log(`Gerado ${zipName} (handler na console: index.handler)`);
