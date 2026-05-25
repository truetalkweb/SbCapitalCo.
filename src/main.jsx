import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { MarketDataProvider } from "./context/MarketDataContext";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <MarketDataProvider>
      <App />
    </MarketDataProvider>
  </StrictMode>
);