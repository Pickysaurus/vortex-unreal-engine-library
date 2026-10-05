import { defineConfig } from "rolldown";
import { builtinModules, createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { peerDependencies } = require("@nexusmods/vortex-api/package.json");
function getExternals() {
    const builtins = builtinModules.filter((m) => !m.startsWith("_"));
    return [
        ...new Set([...builtins, ...Object.keys(peerDependencies || {}), "electron", "vortex-api"]),
    ];
}
export default defineConfig({
    input: "src/index.ts",
    output: {
        file: "dist/index.js",
        format: "cjs",
        sourcemap: true,
        exports: "auto",
    },
    external: getExternals(),
    platform: "node",
    resolve: {
        extensions: [".js", ".jsx", ".json", ".ts", ".tsx"],
        tsconfigFilename: "tsconfig.json",
    },
    plugins: [
        // Add custom plugins as needed (e.g., for native addons, asset copying)
    ],
});