#!/usr/bin/node
/*
 * RotCord, a Vencord fork and a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import esbuild from "esbuild";
import { readFileSync } from "fs";
import { readdir, readFile } from "fs/promises";
import { join } from "path";

import {
    BUILD_TIMESTAMP,
    commonOpts,
    globPlugins,
    VERSION,
    watch,
} from "./common.mjs";

/**
 * @type {esbuild.BuildOptions}
 */
const commonOptions = {
    ...commonOpts,
    entryPoints: ["browser/Vencord.ts"],
    globalName: "Vencord",
    format: "iife",
    external: ["plugins", "git-hash", "/assets/*"],
    plugins: [globPlugins("web"), ...commonOpts.plugins],
    target: ["esnext"],
    define: {
        IS_WEB: "true",
        IS_EXTENSION: "false",
        IS_STANDALONE: "true",
        IS_DEV: JSON.stringify(watch),
        IS_DISCORD_DESKTOP: "false",
        IS_VESKTOP: "false",
        IS_UPDATER_DISABLED: "true",
        VERSION: JSON.stringify(VERSION),
        BUILD_TIMESTAMP,
    },
};

const MonacoWorkerEntryPoints = [
    "vs/language/css/css.worker.js",
    "vs/editor/editor.worker.js",
];

const RnNoiseFiles = [
    "dist/rnnoise.wasm",
    "dist/rnnoise_simd.wasm",
    "dist/rnnoise/workletProcessor.js",
    "LICENSE",
];

await Promise.all([
    esbuild.build({
        entryPoints: MonacoWorkerEntryPoints.map(
            (entry) => `node_modules/monaco-editor/esm/${entry}`
        ),
        bundle: true,
        minify: true,
        format: "iife",
        outbase: "node_modules/monaco-editor/esm/",
        outdir: "dist/monaco",
    }),
    esbuild.build({
        entryPoints: ["browser/monaco.ts"],
        bundle: true,
        minify: true,
        format: "iife",
        outfile: "dist/monaco/index.js",
        loader: {
            ".ttf": "file",
        },
    }),
    esbuild.build({
        ...commonOptions,
        outfile: "dist/browser.js",
        footer: { js: "//# sourceURL=VencordWeb" },
    }),
    esbuild.build({
        ...commonOptions,
        outfile: "dist/extension.js",
        define: {
            ...commonOptions?.define,
            IS_EXTENSION: "true",
        },
        footer: { js: "//# sourceURL=VencordWeb" },
    }),
    esbuild.build({
        ...commonOptions,
        inject: ["browser/GMPolyfill.js", ...(commonOptions?.inject || [])],
        define: {
            ...commonOptions?.define,
            window: "unsafeWindow",
        },
        outfile: "dist/Vencord.user.js",
        banner: {
            js: readFileSync("browser/userscript.meta.js", "utf-8").replace(
                "%version%",
                `${VERSION}.${new Date().getTime()}`
            ),
        },
        footer: {
            // UserScripts get wrapped in an iife, so define Vencord prop on window that returns our local
            js: "Object.defineProperty(unsafeWindow,'Vencord',{get:()=>Vencord});",
        },
    }),
]);

/**
 * @type {(dir: string) => Promise<string[]>}
 */
async function globDir(dir) {
    const files = [];

    for (const child of await readdir(dir, { withFileTypes: true })) {
        const p = join(dir, child.name);
        if (child.isDirectory()) files.push(...(await globDir(p)));
        else files.push(p);
    }

    return files;
}

/**
 * @type {(dir: string, basePath?: string) => Promise<Record<string, string>>}
 */
async function loadDir(dir, basePath = "") {
    const files = await globDir(dir);
    return Object.fromEntries(
        await Promise.all(
            files.map(async (f) => [
                f.slice(basePath.length),
                await readFile(f),
            ])
        )
    );
}
