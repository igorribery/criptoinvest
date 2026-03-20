// Shims mínimos para manter build/lint estáveis mesmo quando o ambiente do zip
// remove `devDependencies`. Não afeta runtime; só tipagem no TypeScript.
declare module "pg";

