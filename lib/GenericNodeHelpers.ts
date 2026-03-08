export function walkTree<T, N extends { kids: N[] }>(
  node: N,
  visitor: (node: N, parent: N | null, index: number) => T | null,
  parent: N | null = null,
  index: number = 0
): T | null {
  const result = visitor(node, parent, index);
  if (result !== null && result !== undefined) return result;
  for (let i = 0; i < node.kids.length; i++) {
    const childResult = walkTree(node.kids[i], visitor, node, i);
    if (childResult !== null && childResult !== undefined) return childResult;
  }
  return null;
}

export function findNodes<T extends { kids: T[] }>(
  root: T,
  predicate: (node: T, parent: T | null) => boolean
): T[] {
  const results: T[] = [];
  walkTree(
    root,
    (node, parent) => {
      if (predicate(node, parent)) {
        results.push(node);
      }
      return null;
    },
    null
  );
  return results;
}
