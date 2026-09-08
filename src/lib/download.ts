export function downloadBlob(bytes: Uint8Array, filename: string, type = "application/pdf") {
  const arr = new Uint8Array(bytes);
  const blob = new Blob([arr], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}