import { existsSync } from "@std/fs";
import { extname, resolve } from "@std/path";
import $ from "@david/dax";

/**
 * Finds the absolute path to the root `index.html` file from the given path.
 *
 * If the path is a directory, it looks for `index.html` inside it.
 * If the path is a zip file, it extracts and locates `index.html` in a temporary directory.
 *
 * @param path - The path to a directory or zip file containing a genhtml report.
 * @returns An object with the absolute path to `index.html` and relative path info.
 * @throws If the path does not exist, is not a directory or zip, or `index.html` is not found.
 */
export async function findRootIndexFile(path: string): Promise<
  {
    absolutePath: string;
    relative: {
      root: string;
      relativePath: string;
    };
  }
> {
  if (!existsSync(path)) {
    throw new Error(`Path does not exist: ${path}`);
  }

  if (Deno.statSync(path).isDirectory) {
    const indexFile = resolve(path, "index.html");
    if (existsSync(indexFile)) {
      return {
        absolutePath: indexFile,
        relative: {
          root: path,
          relativePath: "index.html",
        },
      };
    }

    throw new Error(`No index.html file found in directory: ${path}`);
  }

  const ext = extname(path).toLowerCase();
  if (ext === ".zip") {
    const result = await $`command -v unzip`.quiet("both").noThrow();
    if (result.code !== 0) {
      throw new Error("unzip command not found. Please install unzip.");
    }

    const tempDir = await Deno.makeTempDir();
    const unzipResult = await $`unzip -o ${$.path(path)} -d ${$.path(tempDir)}`
      .quiet("stdout").noThrow();
    if (unzipResult.code !== 0) {
      throw new Error(`Failed to unzip file: ${path}`);
    }

    const indexFile = resolve(tempDir, "index.html");
    if (existsSync(indexFile)) {
      return {
        absolutePath: indexFile,
        relative: {
          root: tempDir,
          relativePath: "index.html",
        },
      };
    }
    throw new Error(`No index.html file found in zip: ${path}`);
  }

  throw new Error(`Path is not a directory or a zip file: ${path}`);
}
