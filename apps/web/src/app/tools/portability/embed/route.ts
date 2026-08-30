import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { requireCommercialAccess } from "@/server/auth/access";

const upstreamOrigin = "https://consulta.portabilidad.pe";
const upstreamPath = "/";
const embedPath = "/tools/portability/embed";
const antiforgeryCookiePrefix = ".AspNetCore.Antiforgery.";

export async function GET(request: NextRequest) {
  await requireCommercialAccess();
  return proxyPortabilityRequest(request);
}

export async function POST(request: NextRequest) {
  await requireCommercialAccess();
  return proxyPortabilityRequest(request);
}

async function proxyPortabilityRequest(request: NextRequest) {
  const upstreamUrl = new URL(upstreamPath, upstreamOrigin);
  upstreamUrl.search = request.nextUrl.search;

  const requestHeaders = new Headers({
    Accept: "text/html,application/xhtml+xml",
    "Accept-Language": "es-PE,es;q=0.9",
    Referer: `${upstreamOrigin}/`,
  });
  const upstreamCookies = getUpstreamCookies(
    request.headers.get("cookie") ?? "",
  );

  if (upstreamCookies) {
    requestHeaders.set("Cookie", upstreamCookies);
  }

  const contentType = request.headers.get("content-type");
  if (contentType) {
    requestHeaders.set("Content-Type", contentType);
  }
  if (request.method === "POST") {
    requestHeaders.set("Origin", upstreamOrigin);
  }

  const upstreamResponse = await fetch(upstreamUrl, {
    body: request.method === "POST" ? await request.arrayBuffer() : undefined,
    cache: "no-store",
    headers: requestHeaders,
    method: request.method,
    redirect: "follow",
  });

  const responseType = upstreamResponse.headers.get("content-type") ?? "";
  if (!responseType.includes("text/html")) {
    return NextResponse.json(
      { message: "El portal de portabilidad devolvió una respuesta inválida." },
      { status: 502 },
    );
  }

  const html = prepareEmbeddedHtml(await upstreamResponse.text());
  const response = new NextResponse(html, {
    status: upstreamResponse.ok ? upstreamResponse.status : 502,
    headers: {
      "Cache-Control": "private, no-cache, no-store, max-age=0",
      "Content-Security-Policy": "frame-ancestors 'self'",
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });

  copyAntiforgeryCookie(upstreamResponse, response);
  return response;
}

function prepareEmbeddedHtml(html: string) {
  const baseTag = `<base href="${upstreamOrigin}/">`;
  const languageHandler = `${embedPath}?handler=Language`;

  return html
    .replace(/<head>/i, `<head>${baseTag}`)
    .replace('action="/?handler=Language"', `action="${languageHandler}"`)
    .replace(
      'formaction="/?handler=Check"',
      `formaction="${embedPath}?handler=Check"`,
    );
}

function getUpstreamCookies(cookieHeader: string) {
  return cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .filter((cookie) => cookie.startsWith(antiforgeryCookiePrefix))
    .join("; ");
}

function copyAntiforgeryCookie(
  upstreamResponse: Response,
  response: NextResponse,
) {
  const setCookieHeader = upstreamResponse.headers.get("set-cookie") ?? "";
  const match = setCookieHeader.match(
    /(?:^|,\s*)(\.AspNetCore\.Antiforgery\.[^=;,]+)=([^;,]+)/,
  );

  if (!match?.[1] || !match[2]) return;

  response.cookies.set({
    httpOnly: true,
    name: match[1],
    path: embedPath,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    value: match[2],
  });
}
