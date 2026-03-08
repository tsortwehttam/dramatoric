export function extractWellBlocks(markdown: string): string {
  const blocks: string[] = [];
  const regex = /```dramatoric\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    blocks.push(match[1].trim());
  }
  return blocks.join("\n\n");
}
