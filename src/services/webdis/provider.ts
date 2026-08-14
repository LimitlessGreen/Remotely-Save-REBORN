export function getOrigPath(input: string, vaultName: string): string {
  const prefix = `rs:fs:v1:${vaultName}/`;
  const suffix = ":meta";
  if (input.startsWith(prefix) && input.endsWith(suffix)) {
    return input.slice(prefix.length, -suffix.length);
  }
  return input;
}
