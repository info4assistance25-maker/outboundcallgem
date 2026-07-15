// Wrapper attorno a fetch che allega automaticamente il token di sessione
// (JWT rilasciato dopo il login + verifica OTP) come header Authorization,
// per le rotte API che richiedono autenticazione lato server.
export function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = sessionStorage.getItem('gem_token');
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...options, headers });
}
