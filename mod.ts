/**
 * @module genhtml-report-parser
 *
 * Entry point for the genhtml-report-parser module. Re-exports all public APIs for parsing genhtml (LCOV) HTML coverage reports.
 *
 * ## Usage
 *
 * ```ts
 * import { findRootIndexFile, parseRootIndexFile } from "jsr:@fenv-org/genhtml-report-parser";
 *
 * const rootIndexFile = await findRootIndexFile("/path/to/report/dir/or.zip");
 * const report = await parseRootIndexFile(rootIndexFile.absolutePath);
 * console.log(report);
 * ```
 */

export * from "./src/file.ts";
export * from "./src/parser.ts";
