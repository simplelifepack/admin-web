export function bytesToMb(bytes: number) {
  return (bytes / (1024 * 1024)).toLocaleString(undefined, { maximumFractionDigits: 1 });
}
