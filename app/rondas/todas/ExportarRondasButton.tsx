"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { FaFileExcel } from "react-icons/fa";

export default function ExportarRondasButton() {
  const [exportando, setExportando] = useState(false);

  async function exportar() {
    setExportando(true);
    try {
      const response = await fetch("/api/rondas/exportar");
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "No fue posible exportar los pacientes.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `rondas_intramurales_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Archivo de pacientes exportado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible exportar los pacientes.");
    } finally {
      setExportando(false);
    }
  }

  return <button type="button" onClick={exportar} disabled={exportando} className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-bold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"><FaFileExcel />{exportando ? "Exportando..." : "Exportar Excel"}</button>;
}
