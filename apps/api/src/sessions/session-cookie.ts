export const sessionCookieName = "captionflow_session";

export function createSessionCookieValue(sessionId: string, accessToken: string) {
  return `${sessionId}.${accessToken}`;
}

export function readSessionAccessToken(cookieHeader: string | undefined, sessionId: string) {
  const encodedCookie = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${sessionCookieName}=`))
    ?.slice(sessionCookieName.length + 1);

  if (!encodedCookie) return undefined;

  let cookie: string;
  try {
    cookie = decodeURIComponent(encodedCookie);
  } catch {
    return undefined;
  }

  const separator = cookie.indexOf(".");
  if (separator < 1 || cookie.slice(0, separator) !== sessionId) return undefined;

  return cookie.slice(separator + 1) || undefined;
}
