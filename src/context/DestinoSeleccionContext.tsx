import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useSesion } from "./SesionContext";

export type DestinoSeleccionado = {
  id?: string;
  nombre: string;
  direccion: string | null;
  lat: number;
  lng: number;
  esPredeterminado: boolean;
};

type EstadoDestino = {
  destinoSeleccionado: DestinoSeleccionado | null;
  setDestinoSeleccionado: (destino: DestinoSeleccionado | null) => void;
};

const DestinoSeleccionContext = createContext<EstadoDestino | undefined>(
  undefined,
);

export function DestinoSeleccionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [destinoSeleccionado, setDestinoSeleccionado] =
    useState<DestinoSeleccionado | null>(null);
  const { session } = useSesion();
  const usuarioId = session?.user.id ?? null;

  useEffect(() => {
    setDestinoSeleccionado(null);
  }, [usuarioId]);

  const value = useMemo(
    () => ({ destinoSeleccionado, setDestinoSeleccionado }),
    [destinoSeleccionado],
  );

  return (
    <DestinoSeleccionContext.Provider value={value}>
      {children}
    </DestinoSeleccionContext.Provider>
  );
}

export function useDestinoSeleccionado(): EstadoDestino {
  const contexto = useContext(DestinoSeleccionContext);

  if (!contexto) {
    throw new Error(
      "useDestinoSeleccionado debe usarse dentro de DestinoSeleccionProvider.",
    );
  }

  return contexto;
}
