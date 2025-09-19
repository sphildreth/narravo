export function makeChildPath(parentPath: string | null, index: number) {
  const seg = String(index).padStart(4,'0');
  return parentPath ? `${parentPath}.${seg}` : seg;
}
