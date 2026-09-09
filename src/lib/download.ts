export function downloadBlob(bytes: Uint8Array, filename: string, type = "application/pdf") {
  const arr = new Uint8Array(bytes);
  const blob = new Blob([arr], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}