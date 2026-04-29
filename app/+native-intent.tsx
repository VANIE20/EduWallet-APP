export function redirectSystemPath({
  path,
  initial,
}: { path: string; initial: boolean }) {
  // Pass deposit deep-link params through so the deposit screen can detect them
  if (path.startsWith('/deposit') || path.includes('status=')) {
    return path;
  }
  return '/';
}
