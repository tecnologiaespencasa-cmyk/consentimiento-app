/**
 * Consentimiento informado para la prestacion del servicio de Auxiliar de
 * Enfermeria por Turnos en el domicilio ("cuidador").
 *
 * Es la unica definicion del texto y de las opciones del formato: la usan el
 * formulario (para mostrar el documento en pantalla y pintar los campos) y el
 * endpoint (para validar lo que llega y armar el PDF). Al estar en un solo
 * sitio, lo que el paciente lee en pantalla y lo que queda firmado en el PDF
 * no pueden desincronizarse.
 *
 * El texto se transcribe del documento entregado por la IPS, incluida su
 * numeracion (pasa del 18 al 20 y del 23 al 25). Cualquier cambio de redaccion
 * se hace aqui y aplica a la pantalla y al PDF a la vez.
 */

import { EDAD_MAXIMA, esFechaReal, moverAnios } from "./validacionCampos";

export const FORMATO_CUIDADOR = "CUIDADOR";

export const TITULO_CUIDADOR =
  "CONSENTIMIENTO INFORMADO PARA LA PRESTACIÓN DEL SERVICIO DE AUXILIAR DE ENFERMERÍA POR TURNOS EN EL DOMICILIO";

export const PIE_CUIDADOR = [
  "Especialistas En Casa - www.especialistasencasa.com – 6043222498",
  "Instagram y Facebook: @especialistasencasa – info@especialistasencasa.com",
] as const;

// ===========================
// Opciones (casillas del documento)
// ===========================

export const TIPOS_DOCUMENTO_CUIDADOR = [
  { value: "CC", label: "Cédula de ciudadanía" },
  { value: "TI", label: "Tarjeta de identidad" },
  { value: "RC", label: "Registro civil" },
  { value: "CE", label: "Cédula de extranjería" },
  { value: "PA", label: "Pasaporte" },
  { value: "OTRO", label: "Otro:" },
] as const;

export const OTORGANTES_CUIDADOR = [
  { value: "PACIENTE", label: "El paciente." },
  { value: "REPRESENTANTE_LEGAL", label: "Padre, madre o representante legal." },
  { value: "APOYO_DESIGNADO", label: "Apoyo designado para la toma de decisiones." },
  {
    value: "FAMILIAR_RESPONSABLE",
    label: "Familiar o responsable autorizado, ante imposibilidad del paciente.",
  },
  { value: "OTRA_PERSONA", label: "Otra persona legalmente facultada:" },
] as const;

export const RAZONES_NO_FIRMA_CUIDADOR = [
  { value: "MENOR_EDAD", label: "Menor de edad." },
  { value: "ALTERACION_CONCIENCIA", label: "Alteración del estado de conciencia." },
  { value: "DIFICULTAD_COGNITIVA", label: "Dificultad cognitiva o de comunicación." },
  { value: "CONDICION_CLINICA", label: "Condición clínica que impide firmar." },
  { value: "REPRESENTACION_LEGAL", label: "Representación legal formal." },
  { value: "OTRA", label: "Otra:" },
] as const;

export const TURNOS_CUIDADOR = [
  { value: "6", label: "Turno de 6 horas." },
  { value: "8", label: "Turno de 8 horas." },
  { value: "12", label: "Turno de 12 horas." },
  { value: "24", label: "Turno de 24 horas." },
] as const;

export const DECLARACIONES_DATOS_CUIDADOR = [
  { value: "POLITICA", label: "Recibí información sobre la política de tratamiento de datos." },
  {
    value: "CANALES",
    label: "Conozco los canales para consultar, actualizar, corregir o solicitar información.",
  },
  {
    value: "AUTORIZA",
    label:
      "Autorizo el tratamiento de mis datos para las finalidades asistenciales, administrativas y legales relacionadas con el servicio.",
  },
] as const;

export const SI_NO_CUIDADOR = [
  { value: "SI", label: "Sí." },
  { value: "NO", label: "No." },
] as const;

export const CAMARAS_CUIDADOR = [
  { value: "NO", label: "No existen cámaras o dispositivos de grabación." },
  { value: "SI", label: "Sí existen cámaras o dispositivos de grabación." },
] as const;

export const DECISIONES_CUIDADOR = [
  {
    value: "ACEPTO",
    label: "ACEPTO voluntariamente la prestación del servicio de Auxiliar de Enfermería por Turnos.",
  },
  { value: "NO_ACEPTO", label: "NO ACEPTO la prestación del servicio." },
  {
    value: "ACEPTO_CON_OBSERVACIONES",
    label: "ACEPTO CON LAS SIGUIENTES OBSERVACIONES O LIMITACIONES:",
  },
] as const;

export type TipoDocumentoCuidador = (typeof TIPOS_DOCUMENTO_CUIDADOR)[number]["value"];
export type OtorganteCuidador = (typeof OTORGANTES_CUIDADOR)[number]["value"];
export type RazonNoFirmaCuidador = (typeof RAZONES_NO_FIRMA_CUIDADOR)[number]["value"];
export type TurnoCuidador = (typeof TURNOS_CUIDADOR)[number]["value"];
export type DeclaracionDatosCuidador = (typeof DECLARACIONES_DATOS_CUIDADOR)[number]["value"];
export type SiNoCuidador = (typeof SI_NO_CUIDADOR)[number]["value"];
export type DecisionCuidador = (typeof DECISIONES_CUIDADOR)[number]["value"];

// ===========================
// Rotulos de los campos a diligenciar
// ===========================

export const ETIQUETAS_CUIDADOR = {
  pacienteNombre: "Nombres y apellidos",
  tipoDocumento: "Tipo de documento",
  numeroDocumento: "Número de documento",
  fechaNacimiento: "Fecha de nacimiento",
  edad: "Edad",
  direccionServicio: "Dirección donde se prestará el servicio",
  municipio: "Municipio",
  telefonoContacto: "Teléfono de contacto",
  diagnostico: "Diagnóstico principal",
  repNombre: "Nombres y apellidos",
  repId: "Tipo y número ID",
  repParentesco: "Parentesco o relación con el paciente",
  repTelefono: "Teléfono",
  razonNoFirma: "Razón por la cual el paciente no firma directamente, cuando aplique:",
  horarioProgramado: "Horario inicialmente programado",
  fechaInicio: "Fecha de inicio",
  camarasUbicacion: "En caso afirmativo, indico su ubicación:",
  preguntas: "Preguntas formuladas y respuestas brindadas:",
  motivoNegativa: "Motivo de la negativa o desistimiento:",
} as const;

export const FIRMAS_CUIDADOR = {
  titulo: "25. FIRMAS",
  paciente: "Paciente (cuando aplique)",
  representante: "Representante, apoyo o responsable autorizado",
  profesional: "Profesional que brinda la información",
  nombre: "Nombre",
  documento: "Documento",
  parentesco: "Parentesco o calidad en que actúa",
  cargo: "Cargo",
  registroProfesional: "Documento o registro profesional, cuando aplique",
  declaracionProfesional:
    "Declaro que suministré información suficiente, clara y comprensible, verifiqué la comprensión del paciente o responsable y resolví las preguntas formuladas.",
} as const;

/**
 * Cargo sugerido segun la profesion registrada en el usuario. Solo precarga el
 * campo "Cargo" de la firma del profesional; el usuario lo puede corregir.
 */
export const CARGO_POR_PROFESION: Record<string, string> = {
  AUXILIAR_ENFERMERIA: "Auxiliar de enfermería",
  ENFERMERIA: "Profesional de enfermería",
  MEDICO: "Médico",
  FISIOTERAPIA: "Fisioterapeuta",
  FONOAUDIOLOGIA: "Fonoaudiólogo(a)",
  NUTRICION: "Nutricionista",
};

// ===========================
// Documento: numerales en el orden en que se leen y se imprimen
// ===========================

/** Grupo de datos que se diligencia en ese punto del documento. */
export type CamposCuidador =
  | "paciente"
  | "otorgante"
  | "servicio"
  | "declaracionesDatos"
  | "registroClinico"
  | "camaras"
  | "preguntas"
  | "aceptacion"
  | "motivoNegativa";

export type BloqueCuidador =
  | { tipo: "parrafo"; texto: string }
  | { tipo: "subtitulo"; texto: string }
  | { tipo: "lista"; items: readonly string[] }
  | { tipo: "campos"; campos: CamposCuidador };

export type SeccionCuidador = {
  titulo: string;
  bloques: readonly BloqueCuidador[];
  /** El numeral se imprime junto a las firmas, en la misma hoja si caben. */
  conFirmas?: boolean;
};

const parrafo = (texto: string): BloqueCuidador => ({ tipo: "parrafo", texto });
const lista = (...items: string[]): BloqueCuidador => ({ tipo: "lista", items });
const campos = (grupo: CamposCuidador): BloqueCuidador => ({ tipo: "campos", campos: grupo });

export const SECCIONES_CUIDADOR: readonly SeccionCuidador[] = [
  {
    titulo: "1. IDENTIFICACIÓN DEL PACIENTE",
    bloques: [campos("paciente")],
  },
  {
    titulo: "2. IDENTIFICACIÓN DE QUIEN OTORGA EL CONSENTIMIENTO",
    bloques: [parrafo("El consentimiento es otorgado por:"), campos("otorgante")],
  },
  {
    titulo: "3. IDENTIFICACIÓN DEL SERVICIO AUTORIZADO",
    bloques: [
      parrafo(
        "Autorizo el inicio y la prestación del servicio domiciliario de Auxiliar de Enfermería por Turnos, en la siguiente modalidad:"
      ),
      campos("servicio"),
    ],
  },
  {
    titulo: "4. INFORMACIÓN SOBRE LA NATURALEZA DEL SERVICIO",
    bloques: [
      parrafo(
        "Declaro que se me explicó que el servicio de Auxiliar de Enfermería por Turnos consiste en la prestación de cuidados básicos y asistenciales en el domicilio, ejecutados por talento humano autorizado, de acuerdo con:"
      ),
      lista(
        "La valoración integral del paciente.",
        "El plan de cuidados.",
        "Las órdenes clínicas vigentes.",
        "Las competencias del Auxiliar de Enfermería.",
        "Los protocolos y procedimientos institucionales.",
        "La intensidad y horario autorizados.",
        "Las condiciones de seguridad del paciente y del entorno."
      ),
      parrafo(
        "El servicio busca apoyar la continuidad del cuidado, prevenir complicaciones, detectar cambios en la condición de salud, ejecutar las intervenciones autorizadas y brindar educación al paciente y a su cuidador."
      ),
      parrafo(
        "Comprendo que el Auxiliar de Enfermería actúa bajo los lineamientos institucionales y la orientación o supervisión del profesional de Enfermería, según las características del caso."
      ),
    ],
  },
  {
    titulo: "5. ACTIVIDADES QUE PODRÁN REALIZARSE",
    bloques: [
      parrafo("De acuerdo con las necesidades identificadas y el plan de cuidados, el servicio podrá incluir:"),
      lista(
        "Observación de la condición general del paciente.",
        "Toma y registro de signos vitales, cuando esté indicada.",
        "Apoyo en higiene, baño, vestido y confort.",
        "Movilización, transferencias y cambios de posición.",
        "Aplicación de medidas para prevenir caídas y lesiones por presión.",
        "Apoyo en alimentación e hidratación.",
        "Apoyo en actividades de eliminación y continencia.",
        "Administración de medicamentos prescritos y autorizados.",
        "Cuidados básicos de dispositivos dentro de la competencia del auxiliar.",
        "Aplicación de medidas de prevención de infecciones.",
        "Identificación y reporte de signos de alarma.",
        "Educación al paciente, cuidador y familia.",
        "Registro de la atención en la historia clínica.",
        "Activación de rutas institucionales ante novedades clínicas o de seguridad."
      ),
      parrafo(
        "La realización de una actividad dependerá de que exista indicación, entrenamiento, autorización, insumos y condiciones seguras."
      ),
    ],
  },
  {
    titulo: "6. ACTIVIDADES QUE NO HACEN PARTE DEL SERVICIO",
    bloques: [
      parrafo(
        "Declaro que se me informó y comprendo que el Auxiliar de Enfermería no es trabajador doméstico, acompañante social, vigilante del inmueble ni reemplazo integral del cuidador o la familia."
      ),
      parrafo("El servicio no incluye:"),
      lista(
        "Aseo general de la vivienda.",
        "Lavado o planchado de ropa de la familia.",
        "Preparación de alimentos para otras personas.",
        "Compras, pagos, diligencias bancarias o trámites personales.",
        "Cuidado de personas distintas al paciente asignado.",
        "Llevar solo al paciente a consultas, terapias o seguimientos médicos por fuera del domicilio",
        "Cuidado, alimentación o paseo de mascotas.",
        "Vigilancia de viviendas, vehículos u otros bienes.",
        "Administración de dinero, cuentas, claves o propiedades.",
        "Reparaciones o labores domésticas.",
        "Actividades de mensajería.",
        "Procedimientos por fuera de la competencia del auxiliar.",
        "Formulación o modificación de tratamientos.",
        "Prestación de servicios particulares no autorizados por la IPS."
      ),
      parrafo(
        "Me comprometo a no solicitar, presionar ni condicionar al Auxiliar de Enfermería para que realice actividades excluidas."
      ),
    ],
  },
  {
    titulo: "7. PARTICIPACIÓN DEL CUIDADOR Y LA FAMILIA",
    bloques: [
      parrafo(
        "Comprendo que el servicio no elimina ni reemplaza las responsabilidades del cuidador principal, la familia o la red de apoyo."
      ),
      parrafo("El cuidador y la familia deberán:"),
      lista(
        "Participar en la educación y entrenamiento.",
        "Suministrar información completa y veraz.",
        "Facilitar el cumplimiento del plan de cuidados.",
        "Proveer los elementos personales y domésticos requeridos.",
        "Gestionar los trámites que les correspondan.",
        "Mantener condiciones adecuadas de orden, higiene y seguridad.",
        "Informar cambios clínicos, hospitalizaciones, traslados o ausencias.",
        "Garantizar el cuidado del paciente fuera del horario autorizado.",
        "Tratar respetuosamente al personal.",
        "Evitar interferencias o instrucciones contradictorias.",
        "Cumplir los acuerdos institucionales."
      ),
      parrafo(
        "La presencia del Auxiliar de Enfermería no implica que este asuma la representación legal, custodia absoluta o responsabilidad familiar sobre el paciente."
      ),
    ],
  },
  {
    titulo: "8. BENEFICIOS ESPERADOS",
    bloques: [
      parrafo("Se me explicó que los beneficios esperados del servicio pueden incluir:"),
      lista(
        "Continuidad del cuidado en el domicilio.",
        "Apoyo en las necesidades básicas del paciente.",
        "Vigilancia de cambios en su condición general.",
        "Prevención de complicaciones evitables.",
        "Mayor adherencia al plan de atención.",
        "Educación y fortalecimiento de las capacidades del cuidador.",
        "Detección y reporte oportuno de signos de alarma.",
        "Apoyo a la seguridad, comodidad y dignidad del paciente."
      ),
      parrafo(
        "Entiendo que los resultados pueden variar según la condición clínica, la respuesta individual, la adherencia al plan, la participación del cuidador y otros factores que no dependen exclusivamente de la IPS."
      ),
      parrafo("No se me ha garantizado la curación, recuperación total ni un resultado clínico específico."),
    ],
  },
  {
    titulo: "9. RIESGOS Y POSIBLES COMPLICACIONES",
    bloques: [
      parrafo(
        "Comprendo que, aunque se aplican medidas de prevención y seguridad, la atención domiciliaria puede estar asociada con riesgos como:"
      ),
      lista(
        "Caídas durante movilizaciones o desplazamientos.",
        "Lesiones de piel o lesiones por presión.",
        "Broncoaspiración o dificultad durante la alimentación.",
        "Reacciones adversas o errores relacionados con medicamentos.",
        "Infecciones.",
        "Sangrado o desplazamiento accidental de dispositivos.",
        "Deterioro clínico inesperado.",
        "Complicaciones propias de la enfermedad.",
        "Retrasos en la atención por dificultades de acceso, comunicación o traslado.",
        "Riesgos derivados de condiciones inseguras del domicilio.",
        "Eventos asociados con la falta de insumos, medicamentos o equipos.",
        "Exposición a riesgos biológicos, físicos, ambientales o de seguridad."
      ),
      parrafo(
        "Se me explicó que la ocurrencia de una complicación no significa, por sí sola, que haya existido una atención inadecuada."
      ),
    ],
  },
  {
    titulo: "10. SIGNOS DE ALARMA Y ATENCIÓN DE URGENCIAS",
    bloques: [
      parrafo(
        "Comprendo que el servicio de Auxiliar de Enfermería por Turnos no reemplaza un servicio de urgencias, ambulancia, hospitalización ni unidad de cuidado intensivo."
      ),
      parrafo("Ante signos de alarma o riesgo para la vida, la IPS podrá:"),
      lista(
        "Activar la ruta institucional de atención.",
        "Solicitar valoración médica.",
        "Contactar al servicio de emergencias.",
        "Recomendar o gestionar el traslado.",
        "Informar al cuidador, familia y asegurador.",
        "Suspender actividades que no puedan realizarse de manera segura en el domicilio."
      ),
      parrafo(
        "Autorizo al equipo asistencial para adoptar las medidas iniciales razonables y necesarias dentro de sus competencias mientras se activa la atención requerida."
      ),
      parrafo(
        "El paciente, cuidador o familia deberá colaborar con las decisiones de traslado o atención urgente. La negativa será informada, documentada y gestionada conforme con los procedimientos institucionales."
      ),
    ],
  },
  {
    titulo: "11. CONDICIONES DEL DOMICILIO",
    bloques: [
      parrafo("Me comprometo a mantener condiciones mínimas para una atención segura, incluyendo:"),
      lista(
        "Acceso razonable al domicilio.",
        "Servicios públicos esenciales, cuando sean necesarios.",
        "Iluminación y ventilación adecuadas.",
        "Espacio suficiente para el cuidado.",
        "Condiciones básicas de orden e higiene.",
        "Control de mascotas.",
        "Ausencia de violencia, amenazas, armas expuestas o consumo de sustancias que alteren el comportamiento.",
        "Disponibilidad de los elementos necesarios para atender al paciente.",
        "Protección de la integridad física y emocional del talento humano."
      ),
      parrafo(
        "Comprendo que la IPS podrá condicionar, restringir, suspender o terminar el servicio cuando exista un riesgo grave que no pueda ser controlado."
      ),
    ],
  },
  {
    titulo: "12. ASIGNACIÓN Y CAMBIO DEL PERSONAL",
    bloques: [
      parrafo(
        "Comprendo que el Auxiliar de Enfermería será seleccionado y asignado por la IPS conforme con criterios de competencia, disponibilidad, ubicación, continuidad y características del paciente."
      ),
      parrafo(
        "La IPS podrá cambiar al auxiliar por razones operativas, clínicas, contractuales, de seguridad, incapacidad, ausencia, desempeño o continuidad del servicio."
      ),
      parrafo("Entiendo que:"),
      lista(
        "No se garantiza la asignación permanente de una persona determinada.",
        "Las solicitudes de cambio serán evaluadas objetivamente.",
        "No podré contratar directamente al auxiliar asignado.",
        "Los cambios de horario, turnos o personal deberán tramitarse exclusivamente a través de la IPS.",
        "No entregaré pagos, préstamos, incentivos o compensaciones directamente al personal asistencial."
      ),
    ],
  },
  {
    titulo: "13. SUPERVISIÓN, COMUNICACIÓN Y SEGUIMIENTO",
    bloques: [
      parrafo("Autorizo a la IPS para realizar, con fines asistenciales, de calidad y seguridad:"),
      lista(
        "Supervisiones presenciales o remotas.",
        "Llamadas de seguimiento.",
        "Verificación del cumplimiento de turnos.",
        "Auditoría de los registros clínicos.",
        "Confirmación de la prestación con el paciente o cuidador.",
        "Revaloraciones de Enfermería.",
        "Seguimiento a incidentes, eventos adversos, quejas y novedades.",
        "Comunicación con el equipo tratante y la entidad responsable del pago, dentro de los límites aplicables."
      ),
      parrafo(
        "Las supervisiones se realizarán respetando la dignidad, privacidad y confidencialidad del paciente."
      ),
    ],
  },
  {
    titulo: "14. REGISTRO EN LA HISTORIA CLÍNICA",
    bloques: [
      parrafo(
        "Se me informó que las actividades, observaciones, novedades y comunicaciones relacionadas con la atención serán registradas en la historia clínica y en los sistemas institucionales."
      ),
      parrafo(
        "Comprendo que la historia clínica es un documento privado y sometido a reserva, y que será administrada conforme con las disposiciones legales y las políticas institucionales."
      ),
      parrafo(
        "Me comprometo a permitir que el personal autorizado realice los registros requeridos y a no solicitar su alteración, omisión o falsificación."
      ),
    ],
  },
  {
    titulo: "15. TRATAMIENTO DE DATOS PERSONALES Y DATOS DE SALUD",
    bloques: [
      parrafo("Se me informó que la IPS tratará los datos personales y datos sensibles de salud necesarios para:"),
      lista(
        "Identificar al paciente.",
        "Prestar y coordinar la atención.",
        "Elaborar y custodiar la historia clínica.",
        "Gestionar autorizaciones y facturación.",
        "Comunicarse con el paciente, cuidador, familia y asegurador.",
        "Gestionar riesgos, calidad y seguridad del paciente.",
        "Atender requerimientos de autoridades competentes.",
        "Cumplir obligaciones legales y contractuales."
      ),
      parrafo(
        "El tratamiento se realizará conforme con la política institucional de tratamiento de datos personales."
      ),
      parrafo("Declaro que:"),
      campos("declaracionesDatos"),
      parrafo(
        "Esta autorización no comprende finalidades comerciales distintas ni autoriza la divulgación indiscriminada de la información clínica."
      ),
    ],
  },
  {
    titulo: "16. FOTOGRAFÍAS, VIDEOS Y GRABACIONES",
    bloques: [
      parrafo(
        "Comprendo que las fotografías, videos o audios que permitan identificar al paciente constituyen información personal y no deberán captarse o utilizarse sin justificación y autorización, salvo los eventos permitidos por la ley."
      ),
      { tipo: "subtitulo", texto: "16.1 Registro con finalidad clínica" },
      parrafo(
        "Cuando sea necesario documentar una condición clínica, lesión, dispositivo, riesgo o evolución, autorizo:"
      ),
      campos("registroClinico"),
      parrafo(
        "La captación y conservación deberá realizarse mediante los medios institucionales autorizados y formar parte del registro asistencial correspondiente."
      ),
      parrafo(
        "La negativa no afectará la prestación general del servicio, salvo que la imagen sea indispensable para una valoración o seguimiento específico, situación que deberá explicarse."
      ),
    ],
  },
  {
    titulo: "17. CÁMARAS DE VIDEOVIGILANCIA EN EL DOMICILIO",
    bloques: [
      parrafo("Declaro que en el domicilio:"),
      campos("camaras"),
      parrafo("Me comprometo a informar previamente a la IPS y al talento humano sobre su existencia y ubicación."),
      parrafo(
        "Comprendo que no deberán instalarse ni utilizarse cámaras en baños, espacios de cambio de ropa, descanso privado o lugares donde se afecte injustificadamente la intimidad."
      ),
      parrafo(
        "Las grabaciones no podrán utilizarse para intimidar, acosar, divulgar información clínica o vulnerar la dignidad del paciente o del personal."
      ),
    ],
  },
  {
    titulo: "18. DERECHO A PREGUNTAR Y RECIBIR INFORMACIÓN",
    bloques: [
      parrafo("Declaro que:"),
      lista(
        "Recibí información clara y suficiente sobre el servicio.",
        "Tuve la oportunidad de formular preguntas.",
        "Mis preguntas fueron respondidas de manera comprensible.",
        "Pude solicitar la presencia de un familiar o persona de confianza.",
        "No fui presionado, amenazado ni inducido indebidamente para aceptar.",
        "Puedo solicitar aclaraciones adicionales durante la prestación.",
        "Conozco los canales institucionales para presentar solicitudes, quejas o reclamos."
      ),
      campos("preguntas"),
    ],
  },
  {
    titulo: "20. ACEPTACIÓN DEL SERVICIO",
    bloques: [
      parrafo("Después de recibir y comprender la información anterior:"),
      campos("aceptacion"),
      parrafo(
        "Declaro que la información suministrada es veraz y que informaré oportunamente cualquier cambio que pueda afectar la atención."
      ),
      parrafo(
        "Comprendo que este consentimiento autoriza la prestación general del servicio, pero no reemplaza los consentimientos específicos que puedan requerirse para procedimientos, intervenciones o usos particulares de información."
      ),
    ],
  },
  {
    titulo: "21. REVOCATORIA DEL CONSENTIMIENTO",
    bloques: [
      parrafo(
        "Comprendo que puedo revocar este consentimiento o rechazar una actividad específica, siempre que tenga capacidad para decidir o actúe mediante persona legalmente facultada."
      ),
      parrafo("La revocatoria deberá:"),
      lista(
        "Ser libre y voluntaria.",
        "Ser informada al equipo asistencial.",
        "Quedar registrada.",
        "Incluir la explicación de los riesgos previsibles de la decisión.",
        "No afectar la atención de urgencias requerida para proteger la vida o integridad, dentro de los límites legales."
      ),
      parrafo(
        "La revocatoria no elimina los registros ya generados ni las obligaciones legales de conservación de la historia clínica."
      ),
    ],
  },
  {
    titulo: "22. NEGATIVA O DESISTIMIENTO",
    bloques: [
      parrafo(
        "Cuando el paciente o su representante rechace el servicio o una intervención indicada, el profesional responsable deberá explicar:"
      ),
      lista(
        "La condición identificada.",
        "Los beneficios esperados.",
        "Los riesgos previsibles de no recibir la atención.",
        "Las alternativas disponibles.",
        "Los signos de alarma.",
        "Las recomendaciones para continuidad del cuidado."
      ),
      campos("motivoNegativa"),
    ],
  },
  {
    titulo: "23. DECLARACIÓN FINAL",
    conFirmas: true,
    bloques: [
      parrafo("Con mi firma declaro que:"),
      lista(
        "Leí o me fue leído este documento.",
        "Comprendí la naturaleza, alcance, beneficios, riesgos, límites y alternativas del servicio.",
        "Comprendí que el Auxiliar de Enfermería no reemplaza al cuidador ni realiza labores domésticas.",
        "Conozco mis responsabilidades y las condiciones requeridas en el domicilio.",
        "Recibí respuesta a mis preguntas.",
        "Entrego mi decisión de manera libre y voluntaria.",
        "Recibí o puedo solicitar una copia de este documento.",
        "Comprendo que el consentimiento es un proceso continuo de información y comunicación, y no únicamente la firma de este formato."
      ),
    ],
  },
];

// ===========================
// Datos diligenciados
// ===========================

export type DatosCuidador = {
  // 1. Paciente
  pacienteNombre: string;
  pacienteTipoDocumento: TipoDocumentoCuidador;
  pacienteTipoDocumentoOtro: string;
  cedula: string;
  pacienteFechaNacimiento: string; // YYYY-MM-DD
  direccionServicio: string;
  municipio: string;
  pacienteTelefono: string;
  diagnostico: string;

  // 2. Quien otorga (los datos del representante solo aplican si no es el paciente)
  otorgante: OtorganteCuidador;
  otorganteOtro: string;
  repNombre: string;
  repTipoDocumento: TipoDocumentoCuidador | "";
  repTipoDocumentoOtro: string;
  repDocumento: string;
  repParentesco: string;
  repTelefono: string;
  razonesNoFirma: RazonNoFirmaCuidador[];
  razonNoFirmaOtra: string;

  // 3. Servicio
  turno: TurnoCuidador;
  horarioProgramado: string;
  fechaInicioServicio: string; // YYYY-MM-DD

  // 15, 16.1, 17 y 18
  declaracionesDatos: DeclaracionDatosCuidador[];
  autorizaRegistroClinico: SiNoCuidador;
  camaras: SiNoCuidador;
  camarasUbicacion: string;
  preguntasRespuestas: string;

  // 20 y 22
  decision: DecisionCuidador;
  observacionesAceptacion: string;
  motivoNegativa: string;

  // 25. Profesional que brinda la informacion
  profesionalCargo: string;
  profesionalRegistro: string;
};

// ===========================
// Validacion de fechas
// ===========================
// Las reglas de los campos de texto son comunes a todos los formatos y estan
// en lib/validacionCampos.

// Ventana admitida para la fecha de inicio del servicio, respecto a hoy.
const ANIOS_ATRAS_INICIO = 10;
const ANIOS_ADELANTE_INICIO = 1;

/** Fechas de nacimiento admitidas: desde hace 120 años hasta hoy. `hoy` en YYYY-MM-DD. */
export function rangoFechaNacimientoCuidador(hoy: string) {
  return { min: moverAnios(hoy, -EDAD_MAXIMA), max: hoy };
}

export function rangoFechaInicioCuidador(hoy: string) {
  return { min: moverAnios(hoy, -ANIOS_ATRAS_INICIO), max: moverAnios(hoy, ANIOS_ADELANTE_INICIO) };
}

/** Mensaje de error de la fecha de nacimiento, o "" si es valida (o esta vacia). */
export function validarFechaNacimientoCuidador(fecha: string, hoy: string): string {
  if (!fecha) return "";
  if (!esFechaReal(fecha)) return "Fecha inválida";

  const { min, max } = rangoFechaNacimientoCuidador(hoy);
  if (fecha > max) return "La fecha de nacimiento no puede ser posterior a hoy";
  if (fecha < min) return `Revisa el año: la edad no puede superar los ${EDAD_MAXIMA} años`;
  return "";
}

/** Mensaje de error de la fecha de inicio del servicio, o "" si es valida (o esta vacia). */
export function validarFechaInicioCuidador(fecha: string, hoy: string): string {
  if (!fecha) return "";
  if (!esFechaReal(fecha)) return "Fecha inválida";

  const { min, max } = rangoFechaInicioCuidador(hoy);
  if (fecha < min || fecha > max) {
    return `Revisa el año: debe estar entre el ${formatearFechaCuidador(min)} y el ${formatearFechaCuidador(max)}`;
  }
  return "";
}

// ===========================
// Utilidades compartidas
// ===========================

/** "CC 1036123456"; si el tipo es "Otro" se usa el texto que escribio el usuario. */
export function formatearDocumentoCuidador(tipo: string, tipoOtro: string, numero: string): string {
  const sigla = tipo === "OTRO" ? tipoOtro.trim() : tipo;
  return `${sigla} ${numero}`.trim();
}

/** Convierte YYYY-MM-DD en DD/MM/AAAA. Devuelve "" si la fecha no tiene ese formato. */
export function formatearFechaCuidador(fecha: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/**
 * Edad cumplida a la fecha de referencia, ambas en formato YYYY-MM-DD. Se
 * calcula a partir de la fecha de nacimiento para no pedirla dos veces.
 */
export function calcularEdadCuidador(fechaNacimiento: string, referencia: string): string {
  const n = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaNacimiento);
  const r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(referencia);
  if (!n || !r) return "";

  let anios = Number(r[1]) - Number(n[1]);
  let meses = Number(r[2]) - Number(n[2]);
  if (Number(r[3]) < Number(n[3])) meses -= 1;
  if (meses < 0) {
    anios -= 1;
    meses += 12;
  }

  if (anios < 0) return "";
  if (anios >= 1) return anios === 1 ? "1 año" : `${anios} años`;
  return meses === 1 ? "1 mes" : `${meses} meses`;
}
