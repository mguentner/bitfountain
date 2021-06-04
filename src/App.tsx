import React, { useEffect, useState } from "react";
import "./App.css";
import { Receiver } from "./Receiver";
import { Transmitter } from "./Transmitter";
import { useParams } from "./useParams";
import readmeMarkdown from "./README.md";

type AppMode = "transmitter" | "receiver" | "initial";

function App() {
  const [appMode, setAppMode] = useState<AppMode>("initial");
  const modeSwitch = useParams("p");

  useEffect(() => {
    switch (modeSwitch) {
      case "transmitter":
        setAppMode("transmitter");
        break;
      case "receiver":
        setAppMode("receiver");
        break;
      default:
        setAppMode("initial");
        break;
    }
  }, [modeSwitch, setAppMode]);

  const appNode = (() => {
    switch (appMode) {
      case "transmitter":
        return <Transmitter />;
      case "receiver":
        return <Receiver />;
      case "initial":
        return null;
    }
  })();

  return (
    <div className="app">
      <div className="mode-switcher">
        <button
          onClick={() => setAppMode("transmitter")}
          className={appMode === "transmitter" ? "selected" : ""}
        >
          Transmitter
        </button>
        <button
          onClick={() => setAppMode("receiver")}
          className={appMode === "receiver" ? "selected" : ""}
        >
          Receiver
        </button>
      </div>
      {appMode === "initial" && (
        <div className="readme">
          <div dangerouslySetInnerHTML={{ __html: readmeMarkdown }}></div>
        </div>
      )}
      {appNode}
    </div>
  );
}

export default App;
