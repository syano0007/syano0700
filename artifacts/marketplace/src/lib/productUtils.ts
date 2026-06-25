export function parseSpecsFromDescription(desc: string) {
  const specs: { id: string; key: string; value: string }[] = [];
  const remaining: string[] = [];
  for (const line of desc.split("\n")) {
    const m = line.match(/^([^:\n]{1,60}):\s*(.+)$/);
    if (m && !line.startsWith("http") && !line.startsWith("www")) {
      specs.push({ id: `sp-${Date.now()}-${Math.random()}`, key: m[1].trim(), value: m[2].trim() });
    } else {
      remaining.push(line);
    }
  }
  return { specs, description: remaining.join("\n").replace(/^\n+/, "").trim() };
}
