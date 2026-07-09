import * as React from "react";

const ButtonGroupContext = React.createContext(false);

function useInButtonGroup(): boolean {
  return React.useContext(ButtonGroupContext);
}

export { ButtonGroupContext, useInButtonGroup };
