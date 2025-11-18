export async function getBearerTokenAsync() {
  return "Bearer DUMMY_TOKEN"; // replace UBS token
}
export async function ensureSuccessStatusCodeAsync(res: Response) {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
export async function getPdfAsync(fileName: string, signal?: AbortSignal) {
  // const bearer = await getBearerTokenAsync();
  const res = await fetch(`/api/pdf?fileName=${encodeURIComponent(fileName)}`, {
    signal,
  });
  await ensureSuccessStatusCodeAsync(res);
  return new Uint8Array(await res.arrayBuffer());
}
