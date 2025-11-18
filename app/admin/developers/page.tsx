import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminDevelopersTable from "./table";
import GamesReviewTable from "./games-table";

export default async function AdminDevelopersPage() {
  const supabase = await createClient();

  // Asegura sesión en SSR
  const { data: userRes, error: uErr } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (uErr || !user) {
    redirect("/html/login.html");
  }

  const role = String(user.app_metadata?.role || "").toLowerCase();
  const isAdmin = role === "admin";
  if (!isAdmin) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6">
        <div className="text-sm text-red-500">No autorizado</div>
      </div>
    );
  }

  // Carga inicial SSR para evitar carreras en cliente
  const [{ data: paises }, { data: devs }, { data: juegosRevision }] = await Promise.all([
    supabase.from("paises").select("id,nombre,codigo").order("nombre", { ascending: true }),
    supabase
      .from("desarrolladores")
      .select(
        "user_auth_id, nombre_estudio, razon_social, nit, direccion, pais_id, telefono, estado_verificacion, actualizado_en",
      )
      .order("actualizado_en", { ascending: false }),
    supabase
      .from("juegos")
      .select("id, titulo, categoria_id, precio, developer_auth_id, actualizado_en")
      .eq("estado", "revision")
      .order("actualizado_en", { ascending: false }),
  ]);

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Solicitudes de desarrollador</h1>
      <AdminDevelopersTable initialRows={devs ?? []} initialCountries={paises ?? []} />
      <GamesReviewTable initialRows={juegosRevision ?? []} />
    </div>
  );
}