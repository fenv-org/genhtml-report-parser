/**
 * @module genhtml-report-parser
 *
 * Entry point for the genhtml-report-parser module. Re-exports all public APIs for parsing genhtml (LCOV) HTML coverage reports.
 *
 * ## Usage
 *
 * ```ts
 * import { findRootIndexFile, parseRootIndexFile, diff } from "jsr:@fenv-org/genhtml-report-parser";
 *
 * const rootIndexFileA = await findRootIndexFile("/path/to/reportA");
 * const rootIndexFileB = await findRootIndexFile("/path/to/reportB");
 * const reportA = await parseRootIndexFile(rootIndexFileA.absolutePath);
 * const reportB = await parseRootIndexFile(rootIndexFileB.absolutePath);
 * const diffResult = diff(reportA!, reportB!);
 * console.log(diffResult);
 * ```
 */

export * from "./src/analyzer.ts";
export * from "./src/file.ts";
export * from "./src/parser.ts";
