"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type DevRow = {
  user_auth_id: string;
  nombre_estudio: string | null;
  razon_social: string | null;
  nit: string | null;
  direccion: string | null;
  pais_id: number | null;
  telefono: string | null;
  estado_verificacion: "pendiente" | "verificado" | "rechazado";
  actualizado_en: string | null;
};

type Country = { id: number; nombre: string; codigo?: string };

export default function AdminDevelopersTable({
  initialRows,
  initialCountries,
}: {
  initialRows: DevRow[];
  initialCountries: Country[];
}) {
  const [rows, setRows] = useState<DevRow[]>(initialRows);
  const [countries] = useState<Country[]>(initialCountries);
  const [onlyPending, setOnlyPending] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  function countryName(pid: number | null) {
    if (!pid) return "—";
    const c = countries.find((x) => Number(x.id) === Number(pid));
    return c?.nombre || `ID ${pid}`;
  }

  const filtered = useMemo(
    () => rows.filter((r) => (onlyPending ? r.estado_verificacion === "pendiente" : true)),
    [rows, onlyPending],
  );

  async function reload() {
    const { data, error } = await supabase
      .from("desarrolladores")
      .select(
        "user_auth_id, nombre_estudio, razon_social, nit, direccion, pais_id, telefono, estado_verificacion, actualizado_en",
      )
      .order("actualizado_en", { ascending: false });
    if (error) {
      setError(error.message);
      return;
    }
    setRows((data as DevRow[]) || []);
  }

  // Reconsultar en cliente al montar, por si el SSR aún no tenía cookies
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function act(user_auth_id: string, action: "approve" | "reject") {
    try {
      setActing(user_auth_id + action);
      setError(null);
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error("Sin sesión válida");
      const res = await fetch("/api/admin/developers/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_auth_id, action }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "No se pudo aplicar la acción");
      }
      await reload();
    } catch (e: any) {
      setError(e?.message || "Error de red");
    } finally {
      setActing(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <label className="text-sm flex items-center gap-2">
          <input
            type="checkbox"
            checked={onlyPending}
            onChange={(e) => setOnlyPending(e.target.checked)}
          />
          Mostrar solo pendientes
        </label>
      </div>

      {error && <div className="text-sm text-red-500 mb-3">{error}</div>}

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-accent/30">
            <tr>
              <th className="text-left p-3">Estudio</th>
              <th className="text-left p-3">Razón social</th>
              <th className="text-left p-3">NIT</th>
              <th className="text-left p-3">País</th>
              <th className="text-left p-3">Teléfono</th>
              <th className="text-left p-3">Estado</th>
              <th className="text-left p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-4 text-center text-muted-foreground">
                  No hay solicitudes {onlyPending ? "pendientes" : ""}.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.user_auth_id} className="border-t">
                  <td className="p-3">{r.nombre_estudio || "—"}</td>
                  <td className="p-3">{r.razon_social || "—"}</td>
                  <td className="p-3">{r.nit || "—"}</td>
                  <td className="p-3">{countryName(r.pais_id)}</td>
                  <td className="p-3">{r.telefono || "—"}</td>
                  <td className="p-3 capitalize">{r.estado_verificacion}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button
                        className="px-3 py-1 rounded bg-green-600 text-white disabled:opacity-60"
                        onClick={() => act(r.user_auth_id, "approve")}
                        disabled={acting !== null || r.estado_verificacion === "verificado"}
                        aria-label="Aprobar"
                      >
                        {acting === r.user_auth_id + "approve" ? "Aprobando…" : "Aprobar"}
                      </button>
                      <button
                        className="px-3 py-1 rounded bg-red-600 text-white disabled:opacity-60"
                        onClick={() => act(r.user_auth_id, "reject")}
                        disabled={acting !== null || r.estado_verificacion === "rechazado"}
                        aria-label="Rechazar"
                      >
                        {acting === r.user_auth_id + "reject" ? "Rechazando…" : "Rechazar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
