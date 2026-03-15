import { useEffect } from "react";
import OperatorApp from "./operator/OperatorApp";
import OutputApp from "./output/OutputApp";

const isOutputWindow =
  new URLSearchParams(window.location.search).get("window") === "output";

export default function App() {
  useEffect(() => {
    if (isOutputWindow) {
      document.body.classList.add("output-body");
      document.title = "OpenStage — Output";
    }
  }, []);

  return isOutputWindow ? <OutputApp /> : <OperatorApp />;
}
