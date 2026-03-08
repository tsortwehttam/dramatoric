import { Dirent, readdirSync, readFileSync } from "fs";

import * as path from "path";

type ExcludeFunc = (relativePath: string, entry: Dirent<string>) => boolean;
type VisitorFunc = (relativePath: string, entry: Dirent<string>, fullPath: string) => void;

const excludePattern = /\.(DS_Store|Thumbs\.db|desktop\.ini|\.git|\.svn|\.env|\.hg|node_modules)$/i;

const defaultExclude: ExcludeFunc = (relativePath, entry) =>
  excludePattern.test(relativePath) || excludePattern.test(entry.name);

export function walkDirsRecursive(dir: string, visitor: VisitorFunc, exclude: ExcludeFunc = defaultExclude) {
  function walk(currentPath: string, basePath: string) {
    const entries = readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      const relativePath = path.relative(basePath, fullPath);
      if (exclude(relativePath, entry)) {
        continue;
      }
      visitor(relativePath, entry, fullPath);
      if (entry.isDirectory()) {
        walk(fullPath, basePath);
      }
    }
  }
  walk(dir, dir);
}

export function loadDirRecursive(dir: string, exclude: ExcludeFunc = defaultExclude): Record<string, Buffer> {
  const out: Record<string, Buffer> = {};
  walkDirsRecursive(
    dir,
    (relativePath, entry, fullPath) => {
      if (entry.isFile()) {
        out[relativePath] = readFileSync(fullPath);
      }
    },
    exclude
  );
  return out;
}
