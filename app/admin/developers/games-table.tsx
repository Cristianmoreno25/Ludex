"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type GameRow = {
  id: number;
  titulo: string;
  categoria_id: number | null;
  precio: number;
  developer_auth_id: string;
  actualizado_en: string | null;
};

export default function GamesReviewTable({ initialRows }: { initialRows: GameRow[] }) {
  const [rows, setRows] = useState<GameRow[]>(initialRows);
  const [acting, setActing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  async function reload() {
    const { data, error } = await supabase
      .from("juegos")
      .select("id, titulo, categoria_id, precio, developer_auth_id, actualizado_en")
      .eq("estado", "revision")
      .order("actualizado_en", { ascending: false });
    if (error) setError(error.message);
    setRows((data as GameRow[]) || []);
  }

  async function act(id: number, action: "approve" | "reject") {
    try {
      setActing(id);
      setError(null);
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error("Sin sesión válida");
      const res = await fetch("/api/admin/games/review", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ juego_id: id, action }),
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
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Juegos en revisión</h2>
      </div>
      {error && <div className="text-sm text-red-500 mb-3">{error}</div>}
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-accent/30">
            <tr>
              <th className="text-left p-3">ID</th>
              <th className="text-left p-3">Título</th>
              <th className="text-left p-3">Precio</th>
              <th className="text-left p-3">Actualizado</th>
              <th className="text-left p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-muted-foreground">
                  No hay juegos en revisión.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">{r.id}</td>
                  <td className="p-3">{r.titulo}</td>
                  <td className="p-3">${Number(r.precio || 0).toFixed(2)}</td>
                  <td className="p-3">{r.actualizado_en ? new Date(r.actualizado_en).toLocaleString() : "—"}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button
                        className="px-3 py-1 rounded bg-green-600 text-white disabled:opacity-60"
                        onClick={() => act(r.id, "approve")}
                        disabled={acting !== null}
                        aria-label="Aprobar juego"
                      >
                        {acting === r.id ? "..." : "Aprobar"}
                      </button>
                      <button
                        className="px-3 py-1 rounded bg-red-600 text-white disabled:opacity-60"
                        onClick={() => act(r.id, "reject")}
                        disabled={acting !== null}
                        aria-label="Rechazar juego"
                      >
                        {acting === r.id ? "..." : "Rechazar"}
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

