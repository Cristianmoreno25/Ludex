// app/auth/sign-up/page.tsx 

import { redirect } from "next/navigation";

export default function Home() {
  // Redirige a public/html/register.html
  redirect("html/register.html");
}
