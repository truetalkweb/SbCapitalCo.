import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { MarketDataProvider } from "./context/MarketDataContext";
import RuntimeErrorBoundary from "./components/RuntimeErrorBoundary";
import { installRuntimeDiagnostics } from "./services/runtimeDiagnostics";

installRuntimeDiagnostics();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RuntimeErrorBoundary>
      <MarketDataProvider>
        <App />
      </MarketDataProvider>
    </RuntimeErrorBoundary>
  </StrictMode>
);
