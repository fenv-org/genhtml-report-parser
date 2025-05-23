import type {
  GenhtmlReport,
  GenhtmlReportChild,
  GenhtmlReportStats,
} from "./parser.ts";
import { Fraction } from "fraction.js";

/**
 * Type of difference between two nodes in the coverage report.
 * - "added": Node exists only in the after report.
 * - "removed": Node exists only in the before report.
 * - "changed": Node exists in both but has changed stats or children.
 */
export type DiffType = "added" | "removed" | "changed";

/**
 * Describes the difference in coverage statistics between two nodes.
 * @property Coverage The coverage percentage of the second node.
 * @property Total The total lines of the second node.
 * @property Hit The covered lines of the second node.
 * @property CoverageDelta Change in coverage percentage.
 * @property TotalDelta Change in total lines.
 * @property HitDelta Change in hit lines.
 */
export type DiffStats = {
  Coverage: number;
  Total: number;
  Hit: number;
  CoverageDelta?: number;
  TotalDelta?: number;
  HitDelta?: number;
};

/**
 * Represents a node in the diff tree, indicating the type of change, node type, path, optional stats, and any child diff nodes.
 * @property type The type of difference (added, removed, changed).
 * @property nodeType The type of node (File or Directory).
 * @property path The relative path of the node.
 * @property stats Optional difference in coverage statistics.
 * @property children Optional child diff nodes.
 */
export type DiffNode = {
  type: DiffType;
  nodeType: "File" | "Directory";
  path: string;
  stats?: DiffStats;
  children?: DiffNode[];
};

/**
 * Represents the diff for the root node, including the diff of the root's stats and the diffs of its children.
 * @property stats Optional difference in coverage statistics for the root node.
 * @property children Array of DiffNode objects representing the differences in the root's children.
 */
export type DiffRoot = {
  stats?: DiffStats;
  children: DiffNode[];
};

/**
 * Compares two GenhtmlReport objects and returns a DiffRoot object representing the differences in coverage between the two reports, including root stats and children diffs.
 * @param before The original GenhtmlReport.
 * @param after The updated GenhtmlReport.
 * @returns DiffRoot object describing the root and children differences.
 */
export function diff(before: GenhtmlReport, after: GenhtmlReport): DiffRoot {
  return {
    stats: statsDiff(before.root.stats, after.root.stats),
    children: diffChildren(before.root.children, after.root.children),
  };
}

function statsDiff(
  a: GenhtmlReportStats,
  b: GenhtmlReportStats,
): DiffStats | undefined {
  const CoverageDelta = Number(new Fraction(b.Coverage).sub(a.Coverage));
  const TotalDelta = b.Total - a.Total;
  const HitDelta = b.Hit - a.Hit;
  if (CoverageDelta !== 0 || TotalDelta !== 0 || HitDelta !== 0) {
    return {
      Coverage: b.Coverage,
      Total: b.Total,
      Hit: b.Hit,
      CoverageDelta,
      TotalDelta,
      HitDelta,
    };
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
            Coverage: bNode.stats.Coverage,
            Total: bNode.stats.Total,
            Hit: bNode.stats.Hit,
            CoverageDelta: bNode.stats.Coverage,
            TotalDelta: bNode.stats.Total,
            HitDelta: bNode.stats.Hit,
          }
          : undefined;
        children = bNode.children
          ? diffChildren([], bNode.children)
          : undefined;
      } else if (bNode.type === "File") {
        stats = bNode.stats
          ? {
            Coverage: bNode.stats.Coverage,
            Total: bNode.stats.Total,
            Hit: bNode.stats.Hit,
            CoverageDelta: bNode.stats.Coverage,
            TotalDelta: bNode.stats.Total,
            HitDelta: bNode.stats.Hit,
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
