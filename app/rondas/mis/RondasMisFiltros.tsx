"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { FaFilter, FaTimes } from "react-icons/fa";

type Filtros = { desde: string; hasta: string; documento: string };

export default function RondasMisFiltros({ initial }: { initial: Filtros }) {
  const router = useRouter();
  const [filtros, setFiltros] = useState(initial);

  function submit(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    Object.entries(filtros).forEach(([key, value]) => { if (value) params.set(key, value); });
    router.push(`/rondas/mis${params.size ? `?${params}` : ""}`);
  }

  return <form onSubmit={submit} className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="mb-3 flex items-center gap-2 font-extrabold text-slate-800"><FaFilter className="text-red-700" />Filtros</div>
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <label className="text-sm font-bold text-slate-700">Desde<input type="date" className="input mt-1" value={filtros.desde} onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })} /></label>
      <label className="text-sm font-bold text-slate-700">Hasta<input type="date" className="input mt-1" value={filtros.hasta} onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value })} /></label>
      <label className="text-sm font-bold text-slate-700">Cédula / identificación<input className="input mt-1" placeholder="Número de identificación" value={filtros.documento} onChange={(e) => setFiltros({ ...filtros, documento: e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase() })} /></label>
    </div>
    <div className="mt-4 flex justify-end gap-2">
      <button type="button" onClick={() => router.push("/rondas/mis")} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 font-semibold hover:bg-slate-50"><FaTimes />Limpiar</button>
      <button className="rounded-lg bg-red-700 px-4 py-2 font-bold text-white hover:bg-red-800">Aplicar filtros</button>
    </div>
  </form>;
}
