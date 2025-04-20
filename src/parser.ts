/**
 * @module genhtml-report-parser/parser
 *
 * Provides types and functions to parse genhtml (LCOV) HTML coverage reports into structured JSON objects.
 *
 * This module extracts coverage statistics and file/directory hierarchies from genhtml-generated `index.html` files or zipped report archives.
 *
 * @see https://arxiv.org/pdf/2008.07947 for coverage categories
 */

import { DOMParser, type Element, type HTMLDocument } from "@b-fuze/deno-dom";
import { dirname, isAbsolute, relative, resolve } from "@std/path";
import { findRootIndexFile } from "./file.ts";

/**
 * Represents an absolute and relative file path.
 */
export type FilePath = {
  absolute: string;
  relative: string;
};

/**
 * The root object returned by parsing a genhtml report.
 */
export type GenhtmlReport = {
  directory: string;
  root: GenhtmlReportRoot;
};

/**
 * The root node of a genhtml report, containing stats and children.
 */
export type GenhtmlReportRoot = {
  stats: GenhtmlReportStats;
  children: GenhtmlReportChild[];
};

/**
 * A child node in the genhtml report tree, either a file or directory.
 */
export type GenhtmlReportChild =
  | GenhtmlReportFile
  | GenhtmlReportDirectory;

/**
 * Represents a file node in the genhtml report tree.
 */
export type GenhtmlReportFile = {
  type: "File";
  path: FilePath;
  stats: GenhtmlReportStats;
};

/**
 * Represents a directory node in the genhtml report tree.
 */
export type GenhtmlReportDirectory = {
  type: "Directory";
  path: FilePath;
  stats: GenhtmlReportStats;
  children: GenhtmlReportFile[];
};

/**
 * Coverage statistics for a file or directory, following genhtml conventions.
 *
 * @see https://arxiv.org/pdf/2008.07947 for details on each category
 */
export type GenhtmlReportStats = {
  /** Coverage in percentage */
  Coverage: number;
  /**  Covered + Uncovered code (not including EUB, ECB, DUB, DCB categories) */
  Total: number;
  /** Exercised code only (CBC + GBC + GNC + GIC) */
  Hit: number;
  /** Uncovered New Code */
  UNC?: number;
  /** Lost Baseline Coverage */
  LBC?: number;
  /** Uncovered Included Code */
  UIC?: number;
  /** Uncovered Baseline Code */
  UBC?: number;
  /** Gained Baseline Coverage */
  GBC?: number;
  /** Gained coverage Included Code */
  GIC?: number;
  /** Gained coverage New Code */
  GNC?: number;
  /** Covered Baseline Code */
  CBC?: number;
  /** Excluded Uncovered Baseline code */
  EUB?: number;
  /** Excluded Covered Baseline code */
  ECB?: number;
  /** Deleted Uncovered Baseline code */
  DUB?: number;
  /**  Deleted Covered Baseline code */
  DCB?: number;
};

type GenhtmlReportStatsKeys = keyof GenhtmlReportStats;

/**
 * Parses a genhtml report root `index.html` file and returns a structured report object.
 *
 * @param filepath - The path to the root `index.html` file.
 * @returns The parsed genhtml report, or undefined if parsing fails.
 */
export async function parseRootIndexFile(
  filepath: string,
): Promise<GenhtmlReport | undefined> {
  const rootDocument = await openDocument(filepath);
  const rootDirectory = resolve(dirname(filepath));
  const rootStats = parseStats(rootDocument);
  if (!rootStats) return;

  return {
    directory: rootDirectory,
    root: {
      stats: rootStats,
      children: await parseChildren(rootDirectory, rootDocument),
    },
  };
}

/**
 * Read the stats from the given `index.html` document.
 */
function parseStats(
  document: HTMLDocument,
): GenhtmlReportStats | undefined {
  const summaryHeaders = [...document.querySelectorAll(
    "body > table:nth-child(1) > tbody > tr:nth-child(3) > td > " +
      'table > tbody > tr:nth-child(1) > td[class*="headerCovTableHead"]',
  )];
  const summaryValues = [...document.querySelectorAll(
    "body > table:nth-child(1) > tbody > tr:nth-child(3) > td > " +
      'table > tbody > tr:nth-child(2) > td[class*="headerCovTableEntry"]',
  )];
  if (summaryHeaders.length === 0 || summaryValues.length === 0) return;

  const summary = {} as GenhtmlReportStats;
  summaryHeaders.forEach((header, index) => {
    const key = header.textContent.trim() as GenhtmlReportStatsKeys;
    summary[key] = parseCoverage(summaryValues[index].textContent.trim());
  });
  return summary;
}

async function parseChildren(
  rootDirectory: string,
  document: HTMLDocument,
): Promise<GenhtmlReportChild[]> {
  const children: GenhtmlReportChild[] = [];
  const entries = parseEntries(document);
  for (const entry of entries) {
    switch (entry.type) {
      case "Directory": {
        const indexFilePath = await findRootIndexFile(
          isAbsolute(entry.path)
            ? entry.path
            : resolve(rootDirectory, entry.path),
        );
        const childDocument = await openDocument(indexFilePath.absolutePath);
        const relativePath = isAbsolute(entry.path)
          ? relative(rootDirectory, entry.path)
          : entry.path;
        const childChildren = await parseChildren(
          resolve(rootDirectory, relativePath),
          childDocument,
        );
        children.push({
          type: "Directory",
          path: {
            absolute: isAbsolute(entry.path)
              ? entry.path
              : resolve(rootDirectory, entry.path),
            relative: isAbsolute(entry.path)
              ? relative(rootDirectory, entry.path)
              : entry.path,
          },
          stats: entry.stats,
          children: childChildren.flatMap((child) => {
            if (child.type === "File") {
              return {
                ...child,
                path: {
                  absolute: child.path.absolute,
                  relative: relative(rootDirectory, child.path.absolute),
                },
              };
            } else {
              return [];
            }
          }),
        });
        break;
      }
      case "File": {
        children.push({
          type: "File",
          path: {
            absolute: isAbsolute(entry.path)
              ? entry.path
              : resolve(rootDirectory, entry.path),
            relative: isAbsolute(entry.path)
              ? relative(rootDirectory, entry.path)
              : entry.path,
          },
          stats: entry.stats,
        });
        break;
      }
      default: {
        continue;
      }
    }
  }
  return children;
}

function parseEntries(
  document: HTMLDocument,
): {
  path: string;
  type: "Directory" | "File" | undefined;
  stats: GenhtmlReportStats;
}[] {
  const tableTypeValue = tableType(document);
  const keys = parseStatKeys(document).filter((key) => key !== "Coverage");
  const rows = tableRows(document);
  return rows.flatMap((row) => {
    // "directoryOrFile" is an <a> element
    const directoryOrFile = tableTypeValue === "Directory"
      ? row.querySelector("td.coverDirectory")
      : row.querySelector("td.coverFile");
    if (!directoryOrFile) {
      return [];
    }
    const path = directoryOrFile?.textContent.trim() || "";
    const coverage = parseCoverage(
      (row.querySelector("td.coverPerHi") ??
        row.querySelector("td.coverPerMed") ??
        row.querySelector("td.coverPerLo")!)
        .textContent.trim(),
    );
    const numbers = row.querySelectorAll("td:nth-child(n+4)");
    const stats: GenhtmlReportStats = {
      Coverage: coverage,
      Total: 0,
      Hit: 0,
    };
    keys.forEach((key, index) => {
      const value = numbers[index].textContent.trim() || "0";
      stats[key] = parseCoverage(value);
    });
    return {
      path,
      type: tableTypeValue,
      stats,
    };
  });
}

function parseStatKeys(
  document: HTMLDocument,
): GenhtmlReportStatsKeys[] {
  return Object.keys(parseStats(document) || {}) as GenhtmlReportStatsKeys[];
}

function parseCoverage(coverage: string): number {
  if (coverage.endsWith(" %")) {
    return parseFloat(coverage.slice(0, -2));
  }
  return parseFloat(coverage);
}

async function openDocument(filepath: string): Promise<HTMLDocument> {
  const fileContent = await Deno.readTextFile(filepath);
  return new DOMParser().parseFromString(fileContent, "text/html");
}

function tableType(document: HTMLDocument): "Directory" | "File" | undefined {
  const td = document.querySelector(
    "body > center > table > tbody > tr:nth-child(2) > td:nth-child(1)",
  );
  if (!td) return;

  const text = td.textContent.trim();
  if (text === "Directory") {
    return "Directory";
  }
  if (text === "File") {
    return "File";
  }
  return;
}

function tableRows(document: HTMLDocument): Element[] {
  const rows = document.querySelectorAll(
    "body > center > table > tbody > tr:nth-child(n+4)",
  );
  return [...rows];
}
