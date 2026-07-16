/** Return a same-origin application path, or the safe default `/`.
 *
 * OAuth callback values are attacker-controlled. Resolving against the current
 * request and comparing origins handles tricky forms such as `//host` and
 * `/\\host`, which simple `startsWith('/')` checks can misclassify.
 */
export function safeInternalPath(candidate: string | null, requestUrl: string): string {
  if (!candidate || !candidate.startsWith("/")) return "/";
  try {
    const request = new URL(requestUrl);
    const target = new URL(candidate, request);
    if (target.origin !== request.origin || !target.pathname.startsWith("/")) return "/";
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/";
  }
}
