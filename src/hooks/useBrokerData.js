import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { getCleanProviderMessage } from "../utils/healthStatus";
import { loadSetting, saveSetting } from "../utils/storage";

export function useBrokerData(brokerApiUrl) {
  const [brokerStatus, setBrokerStatus] = useState("Disconnected");
  const [brokerConnected, setBrokerConnected] = useState(false);
  const [brokerDetails, setBrokerDetails] = useState(null);
  const [brokerError, setBrokerError] = useState("");
  const [brokerAccounts, setBrokerAccounts] = useState([]);
  const [selectedBrokerAccount, setSelectedBrokerAccount] = useState(() =>
    loadSetting("sb_selected_broker_account", "")
  );
  const [brokerBalances, setBrokerBalances] = useState(null);
  const [brokerPositions, setBrokerPositions] = useState([]);
  const [brokerOrders, setBrokerOrders] = useState([]);
  const [brokerLoading, setBrokerLoading] = useState(false);
  const [liveOrderLoading, setLiveOrderLoading] = useState(false);
  const [platformHealth, setPlatformHealth] = useState(null);
  const [lastHealthCheckedAt, setLastHealthCheckedAt] = useState(null);
  const [liveReadiness, setLiveReadiness] = useState(null);
  const [liveOrderPreview, setLiveOrderPreview] = useState(null);
  const [brokerSyncMeta, setBrokerSyncMeta] = useState({
    lastSuccessAt: null,
    latencyMs: null,
  });

  function getBrokerError(error, clean = false) {
    const payload = error?.response?.data?.error || error?.response?.data || error?.message;
    const status = error?.response?.status;
    const statusText = error?.response?.statusText;
    const prefix = status ? `HTTP ${status}${statusText ? ` ${statusText}` : ""}: ` : "";

    if (!payload) return clean ? "Broker request failed." : `${prefix}Broker request failed`;
    if (typeof payload === "string") {
      const message = `${prefix}${payload}`;

      return clean ? getCleanProviderMessage(message, "Questrade degraded. Retry shortly.") : message;
    }

    const message = `${prefix}${payload.error_description || payload.error || JSON.stringify(payload)}`;

    return clean ? getCleanProviderMessage(message, "Questrade degraded. Retry shortly.") : message;
  }

  const checkBrokerStatus = useCallback(async () => {
    setBrokerLoading(true);

    try {
      const [statusResponse, healthResponse] = await Promise.allSettled([
        axios.get(`${brokerApiUrl}/api/questrade/status`, { timeout: 6000 }),
        axios.get(`${brokerApiUrl}/api/health/deep`, { timeout: 7000 }),
      ]);
      let resolvedHealthResponse = healthResponse;

      if (healthResponse.status !== "fulfilled") {
        resolvedHealthResponse = await Promise.allSettled([
          axios.get(`${brokerApiUrl}/api/platform/health`, { timeout: 6000 }),
        ]).then(([fallback]) => fallback);
      }
      const response = statusResponse.status === "fulfilled" ? statusResponse.value : null;

      if (resolvedHealthResponse.status === "fulfilled") {
        const healthData = resolvedHealthResponse.value.data || null;

        setPlatformHealth(healthData);

        if (healthData?.broker?.sync || healthData?.questrade?.sync) {
          setBrokerSyncMeta((prev) => ({
            ...prev,
            ...(healthData.broker?.sync || healthData.questrade?.sync || {}),
          }));
        }
      }

      if (!response) throw statusResponse.reason;

      const connected = Boolean(response.data?.connected);

      setBrokerConnected(connected);
      setBrokerDetails(response.data || null);
      const cleanError = response.data?.error ? getBrokerError({ response }, true) : "";

      setBrokerError(cleanError);
      setBrokerStatus(connected ? "Connected to Questrade" : cleanError || "Questrade degraded");
      setLastHealthCheckedAt(new Date().toISOString());

      return {
        connected,
        details: response.data || null,
        error: cleanError,
      };
    } catch (error) {
      setBrokerConnected(false);
      setBrokerDetails(error.response?.data || null);
      setBrokerError(getBrokerError(error, true));
      setBrokerStatus(error.response ? "Questrade degraded" : "Backend offline");
      setLastHealthCheckedAt(new Date().toISOString());

      return {
        connected: false,
        details: error.response?.data || null,
        error: getBrokerError(error, true),
      };
    }
    finally {
      setBrokerLoading(false);
    }
  }, [brokerApiUrl]);

  const loadLiveReadiness = useCallback(
    async (accountNumber = selectedBrokerAccount) => {
      try {
        const query = accountNumber ? `?accountId=${encodeURIComponent(accountNumber)}` : "";
        const response = await axios.get(`${brokerApiUrl}/api/questrade/live-readiness${query}`, {
          timeout: 8000,
        });

        setLiveReadiness(response.data || null);
        return response.data || null;
      } catch (error) {
        const payload = error.response?.data || {
          brokerConnected: false,
          blockingReasons: [getBrokerError(error)],
        };

        setLiveReadiness(payload);
        setBrokerError(getBrokerError(error));
        return payload;
      }
    },
    [brokerApiUrl, selectedBrokerAccount]
  );

  const previewLiveOrder = useCallback(
    async (orderPayload) => {
      setLiveOrderLoading(true);

      try {
        const response = await axios.post(`${brokerApiUrl}/api/questrade/orders/preview`, orderPayload, {
          timeout: 12000,
        });

        setLiveOrderPreview(response.data || null);

        if (response.data?.readiness) {
          setLiveReadiness(response.data.readiness);
        }

        setBrokerError("");
        return response.data || null;
      } catch (error) {
        const payload = error.response?.data || {
          error: getBrokerError(error),
          previewReady: false,
          validationErrors: [getBrokerError(error)],
        };

        setLiveOrderPreview(payload);
        setBrokerError(getBrokerError(error));
        return payload;
      } finally {
        setLiveOrderLoading(false);
      }
    },
    [brokerApiUrl]
  );

  const submitLiveOrder = useCallback(
    async (orderPayload) => {
      setLiveOrderLoading(true);

      try {
        const response = await axios.post(`${brokerApiUrl}/api/questrade/orders/live`, orderPayload, {
          timeout: 15000,
        });

        setLiveOrderPreview(response.data?.preview || null);
        setBrokerError("");
        return response.data || null;
      } catch (error) {
        const payload = error.response?.data || {
          submitted: false,
          error: getBrokerError(error),
          blockingReasons: [getBrokerError(error)],
        };

        if (payload.preview) {
          setLiveOrderPreview(payload.preview);
        }

        if (payload.preview?.readiness) {
          setLiveReadiness(payload.preview.readiness);
        }

        setBrokerError(getBrokerError(error));
        return payload;
      } finally {
        setLiveOrderLoading(false);
      }
    },
    [brokerApiUrl]
  );

  const loadBrokerAccounts = useCallback(async () => {
    setBrokerLoading(true);

    try {
      const response = await axios.get(`${brokerApiUrl}/api/questrade/accounts`, { timeout: 8000 });
      const accounts = response.data?.accounts || [];
      const storedAccount = loadSetting("sb_selected_broker_account", "");
      const preferredAccount = selectedBrokerAccount || storedAccount;
      const nextAccount =
        accounts.find((account) => account.number === preferredAccount)?.number ||
        accounts[0]?.number ||
        "";

      setBrokerAccounts(accounts);

      setSelectedBrokerAccount((prev) => prev || nextAccount);

      setBrokerConnected(true);
      setBrokerStatus("Account linked");
      setBrokerError("");
      Promise.resolve().then(() => loadLiveReadiness(selectedBrokerAccount || nextAccount));
      setBrokerLoading(false);

      return {
        accounts,
        selectedAccount: selectedBrokerAccount || nextAccount,
      };
    } catch (error) {
      setBrokerConnected(false);
      setBrokerStatus("Account load failed");
      setBrokerError(getBrokerError(error));
      setBrokerDetails(error.response?.data || null);
      setBrokerLoading(false);

      return {
        accounts: [],
        selectedAccount: "",
      };
    }
  }, [brokerApiUrl, loadLiveReadiness, selectedBrokerAccount]);

  useEffect(() => {
    if (!selectedBrokerAccount) return;

    saveSetting("sb_selected_broker_account", selectedBrokerAccount);
  }, [selectedBrokerAccount]);

  const loadBrokerAccountData = useCallback(
    async (accountNumber = selectedBrokerAccount) => {
      if (!accountNumber) {
        setBrokerStatus("Select account first");
        return;
      }

      setBrokerLoading(true);
      const startedAt = Date.now();

      try {
        const [balancesRes, positionsRes, ordersRes] = await Promise.all([
          axios.get(`${brokerApiUrl}/api/questrade/accounts/${accountNumber}/balances`, { timeout: 8000 }),
          axios.get(`${brokerApiUrl}/api/questrade/accounts/${accountNumber}/positions`, { timeout: 8000 }),
          axios.get(`${brokerApiUrl}/api/questrade/accounts/${accountNumber}/orders`, { timeout: 8000 }),
        ]);

        setBrokerBalances(balancesRes.data);
        setBrokerPositions(positionsRes.data?.positions || []);
        setBrokerOrders(ordersRes.data?.orders || []);
        const degradedSync = [balancesRes.data, positionsRes.data, ordersRes.data].some((payload) =>
          payload?.degraded || payload?.fallback
        );

        setBrokerStatus(degradedSync ? "Broker data degraded" : `Synced ${new Date().toLocaleTimeString()}`);
        setBrokerSyncMeta({
          lastSuccessAt: new Date().toISOString(),
          latencyMs: Date.now() - startedAt,
        });
        setBrokerConnected(true);
        setBrokerError(
          degradedSync
            ? getCleanProviderMessage(
                balancesRes.data?.userMessage ||
                  positionsRes.data?.userMessage ||
                  ordersRes.data?.userMessage ||
                  "Broker account data degraded.",
                "Broker account data degraded. Retry account sync shortly."
              )
            : ""
        );
      } catch (error) {
        setBrokerStatus("Broker sync failed");
        setBrokerError(getBrokerError(error));
        setBrokerDetails(error.response?.data || null);
      }

      setBrokerLoading(false);
    },
    [brokerApiUrl, selectedBrokerAccount]
  );

  const refreshBroker = useCallback(async () => {
    const statusResult = await checkBrokerStatus();

    if (!statusResult?.connected) {
      return statusResult;
    }

    const result = await loadBrokerAccounts();
    const accountNumber = result.selectedAccount || selectedBrokerAccount;

    if (accountNumber) {
      await loadBrokerAccountData(accountNumber);
      await loadLiveReadiness(accountNumber);
    }

    return statusResult;
  }, [
    checkBrokerStatus,
    loadBrokerAccounts,
    loadBrokerAccountData,
    loadLiveReadiness,
    selectedBrokerAccount,
  ]);

  const primaryBrokerBalance =
    brokerBalances?.combinedBalances?.[0] ||
    brokerBalances?.perCurrencyBalances?.[0] ||
    null;

  return {
    brokerStatus,
    brokerConnected,
    brokerDetails,
    brokerError,
    brokerAccounts,
    selectedBrokerAccount,
    setSelectedBrokerAccount,
    brokerBalances,
    brokerPositions,
    brokerOrders,
    brokerLoading,
    liveOrderLoading,
    platformHealth,
    liveReadiness,
    liveOrderPreview,
    brokerSyncMeta,
    primaryBrokerBalance,
    lastHealthCheckedAt,
    checkBrokerStatus,
    loadBrokerAccounts,
    loadBrokerAccountData,
    loadLiveReadiness,
    previewLiveOrder,
    submitLiveOrder,
    refreshBroker,
  };
}
