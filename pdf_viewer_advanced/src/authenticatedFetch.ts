// Replace getBearerTokenAsync with UBS/MSAL token acquisition.

export async function getBearerTokenAsync(): Promise<string> {
  console.warn("getBearerTokenAsync: using placeholder token. Replace with UBS token provider.");
  return "Bearer PLACEHOLDER_TOKEN";
}

export async function ensureSuccessStatusCodeAsync(response: Response): Promise<void> {
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status} ${response.statusText} - ${text}`);
  }
}

export async function getPdfAsync(fileName: string, signal?: AbortSignal): Promise<Uint8Array> {
  const bearer = await getBearerTokenAsync();
  const url = `/api/pdf?fileName=${encodeURIComponent(fileName)}`;

  const response = await fetch(url, {
    signal,
    headers: {
      Authorization: bearer,
      Accept: "application/pdf"
    }
  });

  await ensureSuccessStatusCodeAsync(response);

  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}
