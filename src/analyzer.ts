import type {
  GenhtmlReport,
  GenhtmlReportChild,
  GenhtmlReportStats,
} from "./parser.ts";
import { Fraction } from "npm:fraction.js";

// Types for diff result
export type DiffType = "added" | "removed" | "changed";

export type DiffStats = {
  coverageDelta?: number;
  totalDelta?: number;
  hitDelta?: number;
};

export type DiffNode = {
  type: DiffType;
  nodeType: "File" | "Directory";
  path: string;
  stats?: DiffStats;
  children?: DiffNode[];
};

export function diff(before: GenhtmlReport, after: GenhtmlReport): DiffNode[] {
  return diffChildren(before.root.children, after.root.children);
}

function statsDiff(
  a: GenhtmlReportStats,
  b: GenhtmlReportStats,
): DiffStats | undefined {
  const coverageDelta = Number(new Fraction(b.Coverage).sub(a.Coverage));
  const totalDelta = b.Total - a.Total;
  const hitDelta = b.Hit - a.Hit;
  if (coverageDelta !== 0 || totalDelta !== 0 || hitDelta !== 0) {
    return { coverageDelta, totalDelta, hitDelta };
  }
  return undefined;
}

function buildMap(
  children: GenhtmlReportChild[],
): Map<string, GenhtmlReportChild> {
  const map = new Map<string, GenhtmlReportChild>();
  for (const child of children) {
    map.set(child.path.relative, child);
  }
  return map;
}

function diffChildren(
  aChildren: GenhtmlReportChild[],
  bChildren: GenhtmlReportChild[],
): DiffNode[] {
  const aMap = buildMap(aChildren);
  const bMap = buildMap(bChildren);
  const allKeys = new Set([...aMap.keys(), ...bMap.keys()]);
  const diffs: DiffNode[] = [];
  for (const key of allKeys) {
    const aNode = aMap.get(key);
    const bNode = bMap.get(key);
    if (aNode && !bNode) {
      // Removed
      diffs.push({
        type: "removed",
        nodeType: aNode.type,
        path: key,
      });
    } else if (!aNode && bNode) {
      // Added
      let stats: DiffStats | undefined = undefined;
      let children: DiffNode[] | undefined = undefined;
      if (bNode.type === "Directory") {
        stats = bNode.stats
          ? {
            coverageDelta: bNode.stats.Coverage,
            totalDelta: bNode.stats.Total,
            hitDelta: bNode.stats.Hit,
          }
          : undefined;
        children = bNode.children
          ? diffChildren([], bNode.children)
          : undefined;
      } else if (bNode.type === "File") {
        stats = bNode.stats
          ? {
            coverageDelta: bNode.stats.Coverage,
            totalDelta: bNode.stats.Total,
            hitDelta: bNode.stats.Hit,
          }
          : undefined;
      }
      diffs.push({
        type: "added",
        nodeType: bNode.type,
        path: key,
        ...(stats ? { stats } : {}),
        ...(children && children.length > 0 ? { children } : {}),
      });
    } else if (aNode && bNode) {
      // Both exist, check for changes
      if (aNode.type === "Directory" && bNode.type === "Directory") {
        const stats = statsDiff(aNode.stats, bNode.stats);
        const children = diffChildren(aNode.children, bNode.children);
        if (stats || children.length > 0) {
          diffs.push({
            type: "changed",
            nodeType: "Directory",
            path: key,
            stats,
            children,
          });
        }
      } else if (aNode.type === "File" && bNode.type === "File") {
        const stats = statsDiff(aNode.stats, bNode.stats);
        if (stats) {
          diffs.push({
            type: "changed",
            nodeType: "File",
            path: key,
            stats,
          });
        }
      }
    }
  }
  return diffs;
}
