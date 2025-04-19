import { findRootIndexFile, parseRootIndexFile } from "../mod.ts";

const rootIndexFile = await findRootIndexFile(Deno.args[0]);
const report = await parseRootIndexFile(rootIndexFile.absolutePath);
console.log(report);
