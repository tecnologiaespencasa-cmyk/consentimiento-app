"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { FaCalendarAlt, FaCheckCircle, FaChevronLeft, FaChevronRight, FaTimes } from "react-icons/fa";

type MedicamentoRonda = { id: string; nombre: string };
type Reportante = { nombres: string; primerApellido: string; segundoApellido: string | null };
type Ronda = {
  id: string;
  pacienteNombre: string;
  pacienteTipoDoc: string;
  pacienteDocumento: string;
  ips: string;
  cie10Codigo: string;
  diagnosticoDescriptivo: string;
  ingresoEfectivo: boolean | null;
  causaNoIngreso: string | null;
  observacionNoIngreso: string | null;
  otros: string | null;
  createdAt: Date | string;
  medicamentos: MedicamentoRonda[];
  usuario?: Reportante;
};
type ActualizacionRonda = Pick<Ronda, "ingresoEfectivo" | "causaNoIngreso" | "observacionNoIngreso">;

const CAUSAS_NO_INGRESO = ["Cambio en el estado clínico", "No aceptación de atención domiciliaria por el paciente", "Cambio de decisión por parte del médico tratante", "Alta de la IPS sin atención domiciliaria", "Otra"];

function fecha(value: string | Date) {
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" }).format(new Date(value));
}

function nombreReporte(ronda: Ronda) {
  const u = ronda.usuario;
  return u ? `${u.nombres} ${u.primerApellido}${u.segundoApellido ? ` ${u.segundoApellido}` : ""}`.replace(/\s+/g, " ") : "Mi reporte";
}

export default function RondasTabla({ rondas, page, totalPages, basePath, mostrarReportante = false, mostrarIngreso = false, puedeGestionar = false, puedeRegistrarCausaNoIngreso = false, refrescarAutomaticamente = false }: { rondas: Ronda[]; page: number; totalPages: number; basePath: string; mostrarReportante?: boolean; mostrarIngreso?: boolean; puedeGestionar?: boolean; puedeRegistrarCausaNoIngreso?: boolean; refrescarAutomaticamente?: boolean }) {
  const router = useRouter();
  const [data, setData] = useState<Ronda[]>(rondas);
  const [seleccionada, setSeleccionada] = useState<Ronda | null>(null);

  useEffect(() => { setData(rondas); }, [rondas]);
  useEffect(() => {
    if (!refrescarAutomaticamente || seleccionada) return;
    const interval = window.setInterval(() => router.refresh(), 60000);
    return () => window.clearInterval(interval);
  }, [refrescarAutomaticamente, router, seleccionada]);

  const ir = (next: number) => {
    const join = basePath.includes("?") ? "&" : "?";
    window.location.href = `${basePath}${join}page=${next}`;
  };
  const aplicarActualizacion = (actualizacion: ActualizacionRonda) => {
    setSeleccionada((actual) => actual ? { ...actual, ...actualizacion } : actual);
    setData((actual) => actual.map((ronda) => ronda.id === seleccionada?.id ? { ...ronda, ...actualizacion } : ronda));
  };

  return <>
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {data.length === 0 ? <div className="p-12 text-center text-slate-500">No hay pacientes reportados con los filtros seleccionados.</div> : <>
        <div className="overflow-x-auto"><table className="w-full min-w-[860px]"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4">Paciente</th><th className="px-5 py-4">Identificación</th><th className="px-5 py-4">IPS</th><th className="px-5 py-4">Diagnóstico</th>{mostrarReportante && <th className="px-5 py-4">Reportado por</th>}{(mostrarIngreso || puedeGestionar) && <th className="px-5 py-4">Ingreso efectivo</th>}<th className="px-5 py-4">Fecha</th></tr></thead><tbody className="divide-y divide-slate-100">{data.map((ronda) => <tr key={ronda.id} onClick={() => setSeleccionada(ronda)} className="cursor-pointer transition-colors hover:bg-red-50"><td className="px-5 py-4"><p className="font-bold text-slate-800">{ronda.pacienteNombre}</p><p className="text-xs text-red-700">Ver detalle</p></td><td className="px-5 py-4 text-sm text-slate-600">{ronda.pacienteTipoDoc} {ronda.pacienteDocumento}</td><td className="px-5 py-4 text-sm text-slate-600">{ronda.ips}</td><td className="px-5 py-4"><span className="font-semibold text-slate-700">{ronda.cie10Codigo}</span><p className="max-w-xs truncate text-xs text-slate-500">{ronda.diagnosticoDescriptivo}</p></td>{mostrarReportante && <td className="px-5 py-4 text-sm text-slate-600">{nombreReporte(ronda)}</td>}{(mostrarIngreso || puedeGestionar) && <td className="px-5 py-4"><EstadoIngreso value={ronda.ingresoEfectivo} /></td>}<td className="px-5 py-4 text-sm text-slate-600">{fecha(ronda.createdAt)}</td></tr>)}</tbody></table></div>
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm"><span className="text-slate-500">Página {page} de {totalPages}</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => ir(page - 1)} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"><FaChevronLeft /></button><button disabled={page >= totalPages} onClick={() => ir(page + 1)} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"><FaChevronRight /></button></div></div>
      </>}
    </div>
    {seleccionada && <Detalle ronda={seleccionada} reportante={mostrarReportante ? nombreReporte(seleccionada) : undefined} puedeGestionar={puedeGestionar} puedeRegistrarCausaNoIngreso={puedeRegistrarCausaNoIngreso} onActualizado={aplicarActualizacion} onClose={() => setSeleccionada(null)} />}
  </>;
}

function Detalle({ ronda, reportante, puedeGestionar, puedeRegistrarCausaNoIngreso, onActualizado, onClose }: { ronda: Ronda; reportante?: string; puedeGestionar: boolean; puedeRegistrarCausaNoIngreso: boolean; onActualizado: (actualizacion: ActualizacionRonda) => void; onClose: () => void }) {
  const [ingresoEfectivo, setIngresoEfectivo] = useState<boolean | null>(ronda.ingresoEfectivo);
  const [causaNoIngreso, setCausaNoIngreso] = useState(ronda.causaNoIngreso ?? "");
  const [observacionNoIngreso, setObservacionNoIngreso] = useState(ronda.observacionNoIngreso ?? "");
  const [guardando, setGuardando] = useState(false);

  async function guardarGestion() {
    if (ingresoEfectivo === null) return toast.error("Selecciona Sí o No para el ingreso efectivo.");
    setGuardando(true);
    try {
      const response = await fetch(`/api/rondas/${ronda.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ingresoEfectivo }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible guardar la gestión.");
      onActualizado(data.ronda);
      toast.success("Gestión actualizada correctamente.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible guardar la gestión.");
    } finally {
      setGuardando(false);
    }
  }

  async function guardarCausaNoIngreso() {
    setGuardando(true);
    try {
      const response = await fetch(`/api/rondas/${ronda.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ causaNoIngreso, observacionNoIngreso }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible guardar la información.");
      onActualizado(data.ronda);
      toast.success("Causa y observación actualizadas.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible guardar la información.");
    } finally {
      setGuardando(false);
    }
  }

  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={onClose}><div role="dialog" aria-modal="true" aria-label="Detalle de ronda" className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}><div className="sticky top-0 flex items-start justify-between border-b border-slate-100 bg-white p-5"><div><p className="text-sm font-bold uppercase tracking-wide text-red-700">Ronda Intramural</p><h2 className="text-xl font-extrabold text-slate-900">{ronda.pacienteNombre}</h2><p className="text-sm text-slate-500"><FaCalendarAlt className="mr-1 inline" />{fecha(ronda.createdAt)}</p></div><button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Cerrar"><FaTimes /></button></div><div className="space-y-6 p-5"><div className="grid grid-cols-1 gap-4 md:grid-cols-3"><Dato label="Identificación" value={`${ronda.pacienteTipoDoc} ${ronda.pacienteDocumento}`} /><Dato label="IPS" value={ronda.ips} /><Dato label="Reportado por" value={reportante || "Mi perfil"} /><Dato label="Ingreso efectivo" value={etiquetaIngreso(ronda.ingresoEfectivo)} /><Dato label="Código CIE-10" value={ronda.cie10Codigo} /><div className="md:col-span-2"><Dato label="Diagnóstico descriptivo" value={ronda.diagnosticoDescriptivo} /></div></div><div><h3 className="mb-3 text-base font-extrabold text-slate-800">Medicamentos ordenados</h3>{ronda.medicamentos.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">No se registraron medicamentos.</p> : <div className="rounded-xl border border-slate-200"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="p-3">Medicamento</th></tr></thead><tbody className="divide-y divide-slate-100">{ronda.medicamentos.map((m) => <tr key={m.id}><td className="p-3 font-semibold text-slate-700">{m.nombre}</td></tr>)}</tbody></table></div>}</div><Dato label="Otros" value={ronda.otros || "No aplica"} />
      {puedeGestionar && <section className="rounded-2xl border border-red-200 bg-red-50/60 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-extrabold text-slate-800">Gestión de ingreso</h3><p className="mt-1 text-sm text-slate-600">Confirma si el paciente tuvo ingreso efectivo.</p></div><FaCheckCircle className="text-2xl text-red-700" /></div><fieldset className="mt-4"><legend className="text-sm font-bold text-slate-700">Ingreso efectivo</legend><div className="mt-2 flex flex-wrap gap-3"><OpcionIngreso etiqueta="Sí" seleccionada={ingresoEfectivo === true} onChange={() => setIngresoEfectivo(true)} /><OpcionIngreso etiqueta="No" seleccionada={ingresoEfectivo === false} onChange={() => setIngresoEfectivo(false)} /></div></fieldset><div className="mt-4 flex justify-end"><button type="button" disabled={guardando || ingresoEfectivo === null} onClick={guardarGestion} className="rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50">{guardando ? "Guardando..." : "Guardar gestión"}</button></div></section>}
      {puedeGestionar && ronda.ingresoEfectivo === false && (ronda.causaNoIngreso || ronda.observacionNoIngreso) && <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4"><h3 className="font-extrabold text-slate-800">Información de ingreso no efectivo</h3><p className="mt-1 text-sm text-slate-600">Información registrada por quien reportó el paciente.</p><div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2"><Dato label="Causa" value={ronda.causaNoIngreso || "No registrada"} /><Dato label="Observación" value={ronda.observacionNoIngreso || "No registrada"} /></div></section>}
      {puedeRegistrarCausaNoIngreso && ronda.ingresoEfectivo === false && <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4"><h3 className="font-extrabold text-slate-800">Información de ingreso no efectivo</h3><p className="mt-1 text-sm text-slate-600">Selecciona una causa y agrega una observación si aplica.</p><fieldset className="mt-4"><legend className="text-sm font-bold text-slate-700">Causa</legend><div className="mt-2 grid grid-cols-1 gap-2">{CAUSAS_NO_INGRESO.map((causa) => <label key={causa} className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors ${causaNoIngreso === causa ? "border-amber-500 bg-amber-100 text-amber-900" : "border-slate-200 bg-white text-slate-700 hover:border-amber-300"}`}><input type="radio" name="causaNoIngreso" checked={causaNoIngreso === causa} onChange={() => setCausaNoIngreso(causa)} className="mt-0.5 accent-amber-700" />{causa}</label>)}</div></fieldset><label className="mt-4 block text-sm font-bold text-slate-700">Observación <span className="font-normal text-slate-500">({observacionNoIngreso.length}/99)</span><textarea value={observacionNoIngreso} onChange={(e) => setObservacionNoIngreso(e.target.value.slice(0, 99))} maxLength={99} rows={3} className="input mt-1 resize-y" placeholder="Escribe una observación" /></label><div className="mt-4 flex justify-end"><button type="button" disabled={guardando} onClick={guardarCausaNoIngreso} className="rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50">{guardando ? "Guardando..." : "Guardar información"}</button></div></section>}
    </div></div></div>;
}

function OpcionIngreso({ etiqueta, seleccionada, onChange }: { etiqueta: string; seleccionada: boolean; onChange: () => void }) {
  return <label className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition-colors ${seleccionada ? "border-red-500 bg-red-100 text-red-800" : "border-slate-200 bg-white text-slate-700 hover:border-red-300"}`}><input type="radio" name="ingresoEfectivo" checked={seleccionada} onChange={onChange} className="accent-red-700" />{etiqueta}</label>;
}

function etiquetaIngreso(value: boolean | null) {
  return value === null ? "Pendiente" : value ? "Sí" : "No";
}

function EstadoIngreso({ value }: { value: boolean | null }) {
  const estado = value === null ? { label: "Pendiente", className: "border-yellow-200 bg-yellow-50 text-yellow-800" } : value ? { label: "Sí", className: "border-green-200 bg-green-50 text-green-800" } : { label: "No", className: "border-red-200 bg-red-50 text-red-800" };
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${estado.className}`}>{estado.label}</span>;
}

function Dato({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{value}</p></div>;
}
