import { createContext, useContext } from "react";

type PanelContextValue = {
  panelIndex: number;
  isFirstPanel: boolean;
  isLastPanel: boolean;
  orientation: "horizontal" | "vertical";
};

const PanelContext = createContext<PanelContextValue | null>(null);

const usePanelContext = () => useContext(PanelContext);

export { PanelContext, usePanelContext };
export type { PanelContextValue };
