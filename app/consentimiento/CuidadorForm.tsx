"use client";

import { useState } from "react";
import styles from "./Consentimiento.module.css";
import { Campo, CampoFecha } from "./Campo";
import { getBogotaDateKey } from "@/lib/bogotaDate";
import {
  CAMARAS_CUIDADOR,
  DECISIONES_CUIDADOR,
  DECLARACIONES_DATOS_CUIDADOR,
  ETIQUETAS_CUIDADOR,
  FIRMAS_CUIDADOR,
  OTORGANTES_CUIDADOR,
  RAZONES_NO_FIRMA_CUIDADOR,
  SECCIONES_CUIDADOR,
  SI_NO_CUIDADOR,
  TIPOS_DOCUMENTO_CUIDADOR,
  TITULO_CUIDADOR,
  TURNOS_CUIDADOR,
  calcularEdadCuidador,
  rangoFechaInicioCuidador,
  rangoFechaNacimientoCuidador,
  validarFechaInicioCuidador,
  validarFechaNacimientoCuidador,
} from "@/lib/consentimientoCuidador";
import type { CamposCuidador, OtorganteCuidador } from "@/lib/consentimientoCuidador";
import { REGLAS, reglaDocumento } from "@/lib/validacionCampos";

const E = ETIQUETAS_CUIDADOR;
const R = REGLAS;

type Props = {
  /** Quien otorga el consentimiento: de esto depende que firmas se piden. */
  otorgante: OtorganteCuidador | "";
  onOtorganteChange: (otorgante: OtorganteCuidador) => void;
};

function Opcion({
  children,
  ...input
}: React.InputHTMLAttributes<HTMLInputElement> & { children: React.ReactNode }) {
  return (
    <label className={styles.fo18RadioItem}>
      <input className={styles.fo18RadioInput} {...input} />
      <span>{children}</span>
    </label>
  );
}

/** Tipo de documento (y cual, si es "Otro") junto con su numero, que se valida segun el tipo. */
function DocumentoFields({
  prefijo,
  etiquetaTipo,
  etiquetaNumero,
  nombreNumero,
}: {
  prefijo: "paciente" | "rep";
  etiquetaTipo: string;
  etiquetaNumero: string;
  nombreNumero: string;
}) {
  const [tipo, setTipo] = useState("");

  return (
    <>
      <div className={styles.field}>
        <label>{etiquetaTipo}</label>
        <select
          name={`${prefijo}TipoDocumento`}
          required
          className={styles.input}
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
        >
          <option value="" disabled>
            Selecciona una opción
          </option>
          {TIPOS_DOCUMENTO_CUIDADOR.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label.replace(/:$/, "")}
            </option>
          ))}
        </select>
      </div>

      {tipo === "OTRO" && (
        <Campo etiqueta="¿Cuál tipo de documento?" name={`${prefijo}TipoDocumentoOtro`} regla={R.tipoDocumentoOtro} />
      )}

      <Campo etiqueta={etiquetaNumero} name={nombreNumero} regla={reglaDocumento(tipo)} />
    </>
  );
}

/** Datos de quien otorga cuando no es el paciente. */
function DatosRepresentante() {
  const [otraRazon, setOtraRazon] = useState(false);

  return (
    <>
      <div className={styles.grid2}>
        <Campo etiqueta={E.repNombre} name="repNombre" regla={R.nombreCompleto} ancho />

        <DocumentoFields prefijo="rep" etiquetaTipo="Tipo de ID" etiquetaNumero="Número de ID" nombreNumero="repDocumento" />

        <Campo etiqueta={E.repParentesco} name="repParentesco" regla={R.parentesco} />
        <Campo etiqueta={E.repTelefono} name="repTelefono" regla={R.telefono} type="tel" placeholder="Ej.: 3001234567" />
      </div>

      <div className={styles.fo18SectionTitle}>{E.razonNoFirma}</div>
      <div className={`${styles.cuidadorOpciones} ${styles.cuidadorOpcionesCompactas}`}>
        {RAZONES_NO_FIRMA_CUIDADOR.map((r) => (
          <Opcion
            key={r.value}
            type="checkbox"
            name="razonesNoFirma"
            value={r.value}
            onChange={r.value === "OTRA" ? (e) => setOtraRazon(e.target.checked) : undefined}
          >
            {r.label.replace(/:$/, "")}
          </Opcion>
        ))}
      </div>

      {otraRazon && <Campo etiqueta="¿Cuál otra razón?" name="razonNoFirmaOtra" regla={R.aclaracion} />}
    </>
  );
}

/**
 * Cargo y registro del profesional que firma (numeral 25). Van precargados
 * desde su usuario y se pueden corregir.
 */
export function DatosProfesionalCuidador({ cargo, registro }: { cargo: string; registro: string }) {
  return (
    <>
      <Campo etiqueta={FIRMAS_CUIDADOR.cargo} name="profesionalCargo" regla={R.cargo} defaultValue={cargo} />
      <Campo
        etiqueta={FIRMAS_CUIDADOR.registroProfesional}
        name="profesionalRegistro"
        regla={R.registroProfesional}
        opcional
        defaultValue={registro}
      />
    </>
  );
}

/**
 * Consentimiento del cuidador (Auxiliar de Enfermeria por Turnos). Muestra el
 * documento completo, numeral por numeral, con los campos a diligenciar en el
 * punto donde aparecen en el texto. Los campos viajan por su atributo `name`
 * en el formulario de la pagina.
 */
export default function CuidadorForm({ otorgante, onOtorganteChange }: Props) {
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [camaras, setCamaras] = useState("");

  const hoy = getBogotaDateKey(new Date());
  // Una fecha fuera de rango no muestra edad (nada de "526 años").
  const edad = validarFechaNacimientoCuidador(fechaNacimiento, hoy) ? "" : calcularEdadCuidador(fechaNacimiento, hoy);

  const renderCampos = (grupo: CamposCuidador) => {
    switch (grupo) {
      case "paciente":
        return (
          <div className={styles.grid2}>
            <Campo etiqueta={E.pacienteNombre} name="pacienteNombre" regla={R.nombreCompleto} ancho />

            <DocumentoFields
              prefijo="paciente"
              etiquetaTipo={E.tipoDocumento}
              etiquetaNumero={E.numeroDocumento}
              nombreNumero="cedula"
            />

            <CampoFecha
              etiqueta={E.fechaNacimiento}
              name="pacienteFechaNacimiento"
              rango={rangoFechaNacimientoCuidador(hoy)}
              validar={(fecha) => validarFechaNacimientoCuidador(fecha, hoy)}
              value={fechaNacimiento}
              onChange={setFechaNacimiento}
            />

            <div className={styles.field}>
              <label>{E.edad}</label>
              <input type="text" className={styles.input} value={edad} readOnly placeholder="Se calcula sola" />
              <p className={styles.miniHint}>(Se calcula con la fecha de nacimiento)</p>
            </div>

            <Campo etiqueta={E.direccionServicio} name="direccionServicio" regla={R.direccion} ancho />
            <Campo etiqueta={E.municipio} name="municipio" regla={R.municipio} />
            <Campo
              etiqueta={E.telefonoContacto}
              name="pacienteTelefono"
              regla={R.telefono}
              type="tel"
              placeholder="Ej.: 3001234567"
            />
            <Campo etiqueta={E.diagnostico} name="diagnostico" regla={R.diagnostico} ancho />
          </div>
        );

      case "otorgante":
        return (
          <>
            <div className={styles.cuidadorOpciones}>
              {OTORGANTES_CUIDADOR.map((o) => (
                <Opcion
                  key={o.value}
                  type="radio"
                  name="otorgante"
                  value={o.value}
                  required
                  checked={otorgante === o.value}
                  onChange={() => onOtorganteChange(o.value)}
                >
                  {o.label.replace(/:$/, "")}
                </Opcion>
              ))}
            </div>

            {otorgante === "OTRA_PERSONA" && (
              <Campo etiqueta="¿Cuál otra persona legalmente facultada?" name="otorganteOtro" regla={R.aclaracion} />
            )}

            {otorgante === "PACIENTE" && (
              <p className={styles.cuidadorNota}>
                Los datos de quien otorga se toman del paciente (numeral 1). No hay que escribirlos de nuevo.
              </p>
            )}

            {otorgante !== "" && otorgante !== "PACIENTE" && <DatosRepresentante />}
          </>
        );

      case "servicio":
        return (
          <>
            <div className={`${styles.cuidadorOpciones} ${styles.cuidadorOpcionesCompactas}`}>
              {TURNOS_CUIDADOR.map((t) => (
                <Opcion key={t.value} type="radio" name="turno" value={t.value} required>
                  {t.label}
                </Opcion>
              ))}
            </div>

            <div className={styles.grid2}>
              <Campo
                etiqueta={E.horarioProgramado}
                name="horarioProgramado"
                regla={R.horario}
                placeholder="Ej.: 7:00 a. m. a 7:00 p. m."
              />
              <CampoFecha
                etiqueta={E.fechaInicio}
                name="fechaInicioServicio"
                rango={rangoFechaInicioCuidador(hoy)}
                validar={(fecha) => validarFechaInicioCuidador(fecha, hoy)}
              />
            </div>
          </>
        );

      case "declaracionesDatos":
        return (
          <div className={styles.cuidadorOpciones}>
            {DECLARACIONES_DATOS_CUIDADOR.map((dato) => (
              <Opcion key={dato.value} type="checkbox" name="declaracionesDatos" value={dato.value}>
                {dato.label}
              </Opcion>
            ))}
          </div>
        );

      case "registroClinico":
        return (
          <div className={`${styles.cuidadorOpciones} ${styles.cuidadorOpcionesCompactas}`}>
            {SI_NO_CUIDADOR.map((o) => (
              <Opcion key={o.value} type="radio" name="autorizaRegistroClinico" value={o.value} required>
                {o.label}
              </Opcion>
            ))}
          </div>
        );

      case "camaras":
        return (
          <>
            <div className={styles.cuidadorOpciones}>
              {CAMARAS_CUIDADOR.map((o) => (
                <Opcion
                  key={o.value}
                  type="radio"
                  name="camaras"
                  value={o.value}
                  required
                  checked={camaras === o.value}
                  onChange={() => setCamaras(o.value)}
                >
                  {o.label}
                </Opcion>
              ))}
            </div>

            {camaras === "SI" && (
              <Campo etiqueta={E.camarasUbicacion} name="camarasUbicacion" regla={R.textoMedio} filas={3} />
            )}
          </>
        );

      case "preguntas":
        return (
          <Campo
            etiqueta={E.preguntas}
            name="preguntasRespuestas"
            regla={R.textoLargo}
            opcional
            filas={4}
            placeholder="Opcional. Escribe las preguntas del paciente o responsable y la respuesta que se dio."
          />
        );

      case "aceptacion":
        return (
          <>
            <ul className={styles.cuidadorLista}>
              {DECISIONES_CUIDADOR.map((decision) => (
                <li key={decision.value}>{decision.label}</li>
              ))}
            </ul>
            <p className={styles.cuidadorNota}>
              La decisión se registra en el paso siguiente, al presionar «Continuar a confirmación».
            </p>
          </>
        );

      case "motivoNegativa":
        return (
          <>
            <p className={styles.cuidadorTexto}>
              <strong>{E.motivoNegativa}</strong>
            </p>
            <p className={styles.cuidadorNota}>
              Solo aplica si no se acepta el servicio. Se pide en el paso de confirmación.
            </p>
          </>
        );
    }
  };

  return (
    <>
      <div className={styles.section}>
        <h3 className={styles.cuidadorTitulo}>{TITULO_CUIDADOR}</h3>
        <p className={styles.cuidadorNota}>
          Lee el documento con el paciente o su responsable y completa los campos de cada numeral. La fecha, la hora
          y la edad las pone el sistema.
        </p>
      </div>

      {SECCIONES_CUIDADOR.map((seccion) => (
        <div key={seccion.titulo} className={styles.section}>
          <h3 className={styles.sectionTitle}>{seccion.titulo}</h3>

          {seccion.bloques.map((bloque, i) => {
            if (bloque.tipo === "parrafo") {
              return (
                <p key={i} className={styles.cuidadorTexto}>
                  {bloque.texto}
                </p>
              );
            }
            if (bloque.tipo === "subtitulo") {
              return (
                <h4 key={i} className={styles.cuidadorSubtitulo}>
                  {bloque.texto}
                </h4>
              );
            }
            if (bloque.tipo === "lista") {
              return (
                <ul key={i} className={styles.cuidadorLista}>
                  {bloque.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              );
            }
            return <div key={i}>{renderCampos(bloque.campos)}</div>;
          })}
        </div>
      ))}
    </>
  );
}
