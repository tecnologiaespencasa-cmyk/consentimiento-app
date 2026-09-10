// Catalogo cerrado de IPS habilitadas para Ronda Intramural. Se usa tanto en el
// formulario de registro como en la validacion del endpoint.
export const IPS_OPCIONES = ["SURA ROBLEDO", "CLÍNICA LAS AMÉRICAS", "CLÍNICA LAS AMÉRICAS SUR"] as const;

export type IpsRonda = (typeof IPS_OPCIONES)[number];
