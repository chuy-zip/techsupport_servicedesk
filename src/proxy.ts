import { NextResponse, type NextRequest } from "next/server";
import { decrypt, SESSION_COOKIE } from "@/lib/session";

// Filtro rápido antes de cada página: solo revisa la cookie, sin consultar la base.
// La verificación real ocurre en src/lib/auth.ts.

const PUBLIC_PATHS = ["/login"];

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await decrypt(request.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (!session && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.nextUrl));
  }
  if (session && isPublic) {
    return NextResponse.redirect(new URL("/inicio", request.nextUrl));
  }
  return NextResponse.next();
}

// Las rutas de API, los archivos estáticos y las imágenes no pasan por aquí
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)"],
};
