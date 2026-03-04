"use client";

import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";

type FarmaciaCorregidaToggleProps = {
  novedadId: string;
  initialValue: boolean;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function FarmaciaCorregidaToggle({
  novedadId,
  initialValue,
}: FarmaciaCorregidaToggleProps) {
  const [checked, setChecked] = useState(Boolean(initialValue));
  const [saving, setSaving] = useState(false);

  const estadoLabel = useMemo(
    () => (checked ? "Marcada como corregida" : "Pendiente de correccion"),
    [checked]
  );

  async function toggle() {
    if (saving) return;

    const nextValue = !checked;
    setChecked(nextValue);
    setSaving(true);

    try {
      const res = await fetch(`/api/novedades/${encodeURIComponent(novedadId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farmaciaCorregida: nextValue }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "No se pudo actualizar la novedad");
      }

      toast.success(nextValue ? "Novedad marcada como corregida" : "Marca de novedad corregida removida");
    } catch (error) {
      setChecked(!nextValue);
      toast.error(getErrorMessage(error, "No se pudo guardar el cambio"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={`mt-3 rounded-xl border px-3 py-3 ${
        checked ? "border-emerald-200 bg-emerald-50/70" : "border-amber-200 bg-amber-50/70"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">Novedad corregida</p>
          <p className="text-xs text-gray-600">Marcala cuando confirmes que la novedad ya quedo completa.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={toggle}
          disabled={saving}
          className={`inline-flex items-center gap-3 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
            checked
              ? "border-emerald-300 bg-emerald-100 text-emerald-800"
              : "border-amber-300 bg-amber-100 text-amber-800"
          } ${saving ? "cursor-not-allowed opacity-70" : "hover:opacity-90"}`}
        >
          <span
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              checked ? "bg-emerald-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                checked ? "translate-x-5" : "translate-x-1"
              }`}
            />
          </span>
          <span>{saving ? "Guardando..." : checked ? "Corregida" : "Pendiente"}</span>
        </button>
      </div>
      <p className="mt-2 text-xs text-gray-700">{estadoLabel}</p>
    </div>
  );
}
