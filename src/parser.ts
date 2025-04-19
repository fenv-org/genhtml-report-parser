import { DOMParser, Element, HTMLDocument, NodeType } from "@b-fuze/deno-dom";

/**
 * The different categories of the summary
 *
 * @see https://arxiv.org/pdf/2008.07947
 */
export type GenhtmlReportStats = {
  // Coverage in percentage
  Coverage?: number;
  // Covered + Uncovered code (not including EUB, ECB, DUB, DCB categories)
  Total?: number;
  // Exercised code only (CBC + GBC + GNC + GIC)
  Hit?: number;
  // Uncovered New Code
  UNC?: number;
  // Lost Baseline Coverage
  LBC?: number;
  // Uncovered Included Code
  UIC?: number;
  // Uncovered Baseline Code
  UBC?: number;
  // Gained Baseline Coverage
  GBC?: number;
  // Gained coverage Included Code
  GIC?: number;
  // Gained coverage New Code
  GNC?: number;
  // Covered Baseline Code
  CBC?: number;
  // Excluded Uncovered Baseline code
  EUB?: number;
  // Excluded Covered Baseline code
  ECB?: number;
  // Deleted Uncovered Baseline code
  DUB?: number;
  // Deleted Covered Baseline code
  DCB?: number;
};

export async function parseRootIndexFile(filepath: string): Promise<any> {
  const fileContent = await Deno.readTextFile(filepath);
  const rootDocument = new DOMParser()
    .parseFromString(fileContent, "text/html");
  return parseRootDocumentStats(rootDocument);
}

/**
 * Read the stats from the root index file.
 */
export function parseRootDocumentStats(
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
    const key = header.textContent.trim() as keyof GenhtmlReportStats;
    summary[key] = parseCoverage(summaryValues[index].textContent.trim());
  });
  return summary;
}

function parseCoverage(coverage: string): number {
  if (coverage.endsWith(" %")) {
    return parseFloat(coverage.slice(0, -2));
  }
  return parseFloat(coverage);
}
