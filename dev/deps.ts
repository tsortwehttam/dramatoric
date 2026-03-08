import path from "node:path";
import ts from "typescript";

export type Dep = {
  spec: string;
  kind: "local" | "node" | "unknown";
  resolved?: string;
};
export type Graph = Record<string, Dep[]>;

export const buildDepGraph = (
  entryFile: string,
  tsconfigPath = "tsconfig.json"
) => {
  const cwd = process.cwd();
  const entryAbs = path.resolve(cwd, entryFile);
  const configFile = ts.findConfigFile(cwd, ts.sys.fileExists, tsconfigPath);
  const cfg = configFile
    ? ts.readConfigFile(configFile, ts.sys.readFile)
    : { config: {} as any };
  const parsed = ts.parseJsonConfigFileContent(
    cfg.config,
    ts.sys,
    configFile ? path.dirname(configFile) : cwd
  );

  const host = ts.createCompilerHost(parsed.options, true);
  const program = ts.createProgram({
    rootNames: Array.from(new Set([entryAbs, ...parsed.fileNames])),
    options: parsed.options,
    host,
  });

  const graph: Graph = {};
  const seen = new Set<string>();

  const classify = (spec: string) =>
    spec.startsWith(".") || spec.startsWith("/")
      ? ("local" as const)
      : ("node" as const);

  const resolve = (spec: string, fromFile: string) => {
    const r = ts.resolveModuleName(
      spec,
      fromFile,
      program.getCompilerOptions(),
      host
    );
    const f = r.resolvedModule?.resolvedFileName;
    return f ? path.normalize(f) : undefined;
  };

  const visit = (file: string) => {
    const f = path.normalize(file);
    if (seen.has(f)) return;
    seen.add(f);

    const sf = program.getSourceFile(f);
    if (!sf) return;

    const specs = ts
      .preProcessFile(sf.getFullText(), true, true)
      .importedFiles.map((x) => x.fileName)
      .concat(
        ts
          .preProcessFile(sf.getFullText(), true, true)
          .referencedFiles.map((x) => x.fileName)
      );

    const deps: Dep[] = [];
    for (const spec of Array.from(new Set(specs))) {
      const kind = classify(spec);
      const resolved = resolve(spec, f);
      deps.push({ spec, kind: resolved ? kind : "unknown", resolved });
      if (resolved && kind === "local") visit(resolved);
    }

    graph[f] = deps;
  };

  visit(entryAbs);
  return graph;
};

export const main = () => {
  const entry = process.argv[2];
  const tsconfig = process.argv[3] ?? "tsconfig.json";
  if (!entry) throw new Error("Usage: depgraph <entry.ts> [tsconfig.json]");
  const g = buildDepGraph(entry, tsconfig);
  process.stdout.write(JSON.stringify(g, null, 2) + "\n");
};

if (import.meta.url === `file://${process.argv[1]}`) main();
