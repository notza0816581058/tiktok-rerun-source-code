// The real deployment can serve the app under a sub-path; the demo always runs at the root.
export const BASE_PATH = '';

export function apiPath(path: string): string {
  return `${BASE_PATH}${path}`;
}
