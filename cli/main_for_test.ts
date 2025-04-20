import { diff, findRootIndexFile, parseRootIndexFile } from "../mod.ts";

const indexA = await findRootIndexFile(Deno.args[0]);
const indexB = await findRootIndexFile(Deno.args[1]);
const reportA = await parseRootIndexFile(indexA.absolutePath);
const reportB = await parseRootIndexFile(indexB.absolutePath);

const diffReport = diff(reportA!, reportB!);
console.log(JSON.stringify(diffReport, null, 2));
