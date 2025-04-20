import { DOMParser, type Element, type HTMLDocument } from "@b-fuze/deno-dom";
import { dirname, isAbsolute, relative, resolve } from "@std/path";
import { findRootIndexFile } from "../mod.ts";

export type FilePath = {
  absolute: string;
  relative: string;
};

export type GenhtmlReport = {
  directory: string;
  root: GenhtmlReportRoot;
};

type GenhtmlReportRoot = {
  path: FilePath;
  stats: GenhtmlReportStats;
  children: GenhtmlReportChild[];
};

type GenhtmlReportChild =
  | GenhtmlReportFile
  | GenhtmlReportDirectory;

type GenhtmlReportFile = {
  type: "File";
  path: FilePath;
  stats: GenhtmlReportStats;
};

type GenhtmlReportDirectory = {
  type: "Directory";
  path: FilePath;
  stats: GenhtmlReportStats;
  children: GenhtmlReportFile[];
};

/**
 * The different categories of the summary
 *
 * @see https://arxiv.org/pdf/2008.07947
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
      path: {
        absolute: filepath,
        relative: relative(rootDirectory, filepath),
      },
      stats: rootStats,
      children: await parseChildren(rootDirectory, rootDocument),
    },
  };
}

/**
 * Read the stats from the given `index.html` document.
 */
export function parseStats(
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
        const childChildren = await parseChildren(rootDirectory, childDocument);
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
  return rows.map((row) => {
    // "directoryOrFile" is an <a> element
    const directoryOrFile = tableTypeValue === "Directory"
      ? row.querySelector("td.coverDirectory")
      : row.querySelector("td.coverFile");
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
