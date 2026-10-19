export const BASE_PATH = (document.querySelector('meta[name="app-base"]')?.content || '').replace(
  /\/$/,
  ''
);
export function appPathname() {
  const pathname = location.pathname;
  return BASE_PATH && (pathname === BASE_PATH || pathname.startsWith(BASE_PATH + '/'))
    ? pathname.slice(BASE_PATH.length) || '/'
    : pathname;
}
export const localUrl = (path) => `${BASE_PATH}${path}`;
export const LIBRARY_ENDPOINT =
  document.querySelector('meta[name="library-endpoint"]')?.content || '/api/library';
