import { redirect } from "next/navigation";

// Sin sesión, el proxy manda a /login antes de llegar aquí
export default function Home() {
  redirect("/inicio");
}
