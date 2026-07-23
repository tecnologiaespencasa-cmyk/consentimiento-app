"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { FaCheckCircle, FaMinusCircle, FaPlusCircle, FaPills, FaUserPlus } from "react-icons/fa";

type Medicamento = { nombre: string };
type MedicamentoForm = { nombre: string };
const nuevoMedicamento = (): MedicamentoForm => ({ nombre: "" });

export default function RegistrarRondaForm({ medicamentosCatalogo }: { medicamentosCatalogo: Medicamento[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ pacienteNombre: "", pacienteTipoDoc: "CC", pacienteDocumento: "", ips: "", cie10Codigo: "", diagnosticoDescriptivo: "", otros: "" });
  const [medicamentos, setMedicamentos] = useState<MedicamentoForm[]>([nuevoMedicamento()]);
  const cie10Valido = /^[A-Z][0-9]{3}$/.test(form.cie10Codigo);
  const catalogoSet = useMemo(() => new Set(medicamentosCatalogo.map((m) => m.nombre.toUpperCase())), [medicamentosCatalogo]);

  useEffect(() => {
    if (!cie10Valido) { setForm((prev) => ({ ...prev, diagnosticoDescriptivo: "" })); return; }
    const controller = new AbortController();
    fetch(`/api/rondas/catalogos?cie10=${encodeURIComponent(form.cie10Codigo)}`, { signal: controller.signal })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setForm((prev) => prev.cie10Codigo === form.cie10Codigo ? { ...prev, diagnosticoDescriptivo: data?.descripcion ?? "" } : prev))
      .catch(() => undefined);
    return () => controller.abort();
  }, [form.cie10Codigo, cie10Valido]);

  function actualizarMedicamento(index: number, nombre: string) {
    setMedicamentos((prev) => prev.map((m, i) => i === index ? { ...m, nombre: nombre.toUpperCase() } : m));
  }
  function actualizarDocumento(value: string) {
    const regex = ["PA", "CE"].includes(form.pacienteTipoDoc) ? /[^A-Za-z0-9]/g : /[^0-9]/g;
    setForm((prev) => ({ ...prev, pacienteDocumento: value.replace(regex, "").toUpperCase() }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.diagnosticoDescriptivo) return toast.error("Ingresa un código CIE-10 válido.");
    if (medicamentos.some((m) => !catalogoSet.has(m.nombre))) return toast.error("Selecciona los medicamentos desde el listado sugerido.");
    setSaving(true);
    try {
      const response = await fetch("/api/rondas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, medicamentos }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible registrar la ronda.");
      toast.success("Paciente registrado en Ronda Intramural.");
      router.push("/rondas/mis");
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Error al registrar la ronda."); }
    finally { setSaving(false); }
  }

  return <div className="min-h-screen bg-gradient-to-b from-red-50 via-white to-white pb-12">
    <header className="relative overflow-hidden bg-gradient-to-br from-red-800 via-red-700 to-red-600 text-white">
      <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full border-[28px] border-white/10" />
      <div className="absolute -bottom-20 right-1/4 h-44 w-44 rounded-full bg-white/5" />
      <div className="container relative mx-auto px-4 py-9 md:py-11"><div className="flex items-center gap-4 md:gap-5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/25 bg-white/15 shadow-lg backdrop-blur-sm md:h-20 md:w-20"><FaUserPlus className="text-3xl md:text-4xl" /></div>
        <div><p className="text-xs font-bold uppercase tracking-[0.22em] text-red-100">Ronda Intramural · Registro clínico</p><h1 className="mt-1 text-3xl font-black tracking-tight md:text-4xl">Nuevo reporte de paciente</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-red-100 md:text-base">Documenta la información clínica y el tratamiento para dar continuidad a la atención intramural.</p></div>
      </div></div>
    </header>
    <form onSubmit={submit} className="container mx-auto max-w-7xl px-4 py-8 space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-extrabold text-slate-800 text-lg">Información del paciente</h2>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Campo label="Nombre del paciente"><input required value={form.pacienteNombre} onChange={(e) => setForm((p) => ({ ...p, pacienteNombre: e.target.value.replace(/[^A-Za-zÀ-ÖØ-öø-ÿÑñ ]/g, "").toUpperCase() }))} placeholder="Nombres y apellidos" className="input" /></Campo>
          <Campo label="Tipo de identificación"><select value={form.pacienteTipoDoc} onChange={(e) => setForm((p) => ({ ...p, pacienteTipoDoc: e.target.value, pacienteDocumento: "" }))} className="input"><option>CC</option><option>RC</option><option>PA</option><option>CE</option><option>TI</option><option>PE</option><option>PPT</option></select></Campo>
          <Campo label="Número de identificación"><input required value={form.pacienteDocumento} onChange={(e) => actualizarDocumento(e.target.value)} placeholder={["PA", "CE"].includes(form.pacienteTipoDoc) ? "Letras y números" : "Solo números"} className="input" /></Campo>
          <Campo label="IPS"><input required value={form.ips} onChange={(e) => setForm((p) => ({ ...p, ips: e.target.value.toUpperCase() }))} placeholder="Nombre de la IPS" className="input" /></Campo>
          <Campo label="Código CIE-10"><input required maxLength={4} value={form.cie10Codigo} onChange={(e) => setForm((p) => ({ ...p, cie10Codigo: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") }))} placeholder="Ejemplo: N390" className="input uppercase" /><p className="mt-1 text-xs text-slate-500">Una letra y tres números.</p></Campo>
          <Campo label="Diagnóstico descriptivo"><div className={`input flex items-center min-h-11 ${form.diagnosticoDescriptivo ? "bg-slate-50 text-slate-700" : "bg-slate-50 text-slate-400"}`} aria-live="polite">{form.diagnosticoDescriptivo || "Se completa automáticamente con el CIE-10"}</div></Campo>
        </div>
      </section>
      <section className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm"><div className="flex flex-wrap justify-between items-center gap-3"><div><h2 className="font-extrabold text-slate-800 text-lg flex items-center gap-2"><FaPills className="text-red-700" /> Medicamentos</h2><p className="text-sm text-slate-500">Puedes agregar hasta seis medicamentos.</p></div>
        <button type="button" disabled={medicamentos.length >= 6} onClick={() => setMedicamentos((p) => [...p, nuevoMedicamento()])} className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"><FaPlusCircle /> Agregar medicamento</button></div>
        <datalist id="medicamentos-ronda">{medicamentosCatalogo.map((m) => <option key={m.nombre} value={m.nombre.toUpperCase()} />)}</datalist>
        <div className="mt-5 space-y-4">{medicamentos.map((m, index) => <div key={index} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"><div className="mb-3 flex items-center justify-between"><span className="font-bold text-slate-700">Medicamento {index + 1}</span>{medicamentos.length > 1 && <button type="button" onClick={() => setMedicamentos((p) => p.filter((_, i) => i !== index))} className="text-sm font-semibold text-red-600 hover:text-red-800"><FaMinusCircle className="inline mr-1" /> Quitar</button>}</div>
          <div className="max-w-3xl"><Campo label="Medicamento"><input required list="medicamentos-ronda" value={m.nombre} onChange={(e) => actualizarMedicamento(index, e.target.value)} placeholder="Escribe para buscar" className="input" /></Campo></div>
        </div>)}</div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><Campo label="Otros"><textarea value={form.otros} onChange={(e) => setForm((p) => ({ ...p, otros: e.target.value.toUpperCase() }))} maxLength={2000} rows={3} placeholder="Terapias, NPT, Clínica de heridas, etc." className="input resize-y" /></Campo></section>
      <div className="flex justify-end"><button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-700 to-red-700 px-6 py-3 font-bold text-white shadow-md hover:from-red-800 hover:to-red-800 disabled:opacity-60"><FaCheckCircle />{saving ? "Guardando..." : "Registrar paciente"}</button></div>
    </form>
  </div>;
}
function Campo({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-bold text-slate-700">{label}<span className="mt-1.5 block font-normal">{children}</span></label>; }
