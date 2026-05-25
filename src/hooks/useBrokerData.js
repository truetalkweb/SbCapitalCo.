import { useCallback, useState } from "react";
import axios from "axios";

export function useBrokerData(brokerApiUrl) {
  const [brokerStatus, setBrokerStatus] = useState("Disconnected");
  const [brokerConnected, setBrokerConnected] = useState(false);
  const [brokerAccounts, setBrokerAccounts] = useState([]);
  const [selectedBrokerAccount, setSelectedBrokerAccount] = useState("");
  const [brokerBalances, setBrokerBalances] = useState(null);
  const [brokerPositions, setBrokerPositions] = useState([]);
  const [brokerOrders, setBrokerOrders] = useState([]);
  const [brokerLoading, setBrokerLoading] = useState(false);

  const checkBrokerStatus = useCallback(async () => {
    setBrokerLoading(true);

    try {
      const response = await axios.get(`${brokerApiUrl}/api/questrade/status`);
      setBrokerConnected(Boolean(response.data?.connected));
      setBrokerStatus(response.data?.connected ? "Connected" : "Disconnected");
    } catch {
      setBrokerConnected(false);
      setBrokerStatus("Backend offline");
    }

    setBrokerLoading(false);
  }, [brokerApiUrl]);

  const loadBrokerAccounts = useCallback(async () => {
    setBrokerLoading(true);

    try {
      const response = await axios.get(`${brokerApiUrl}/api/questrade/accounts`);
      const accounts = response.data?.accounts || [];
      const nextAccount = accounts[0]?.number || "";

      setBrokerAccounts(accounts);

      setSelectedBrokerAccount((prev) => prev || nextAccount);

      setBrokerConnected(true);
      setBrokerStatus("Connected");
      setBrokerLoading(false);

      return {
        accounts,
        selectedAccount: selectedBrokerAccount || nextAccount,
      };
    } catch {
      setBrokerConnected(false);
      setBrokerStatus("Accounts failed");
      setBrokerLoading(false);

      return {
        accounts: [],
        selectedAccount: "",
      };
    }
  }, [brokerApiUrl, selectedBrokerAccount]);

  const loadBrokerAccountData = useCallback(
    async (accountNumber = selectedBrokerAccount) => {
      if (!accountNumber) {
        setBrokerStatus("Select account first");
        return;
      }

      setBrokerLoading(true);

      try {
        const [balancesRes, positionsRes, ordersRes] = await Promise.all([
          axios.get(`${brokerApiUrl}/api/questrade/accounts/${accountNumber}/balances`),
          axios.get(`${brokerApiUrl}/api/questrade/accounts/${accountNumber}/positions`),
          axios.get(`${brokerApiUrl}/api/questrade/accounts/${accountNumber}/orders`),
        ]);

        setBrokerBalances(balancesRes.data);
        setBrokerPositions(positionsRes.data?.positions || []);
        setBrokerOrders(ordersRes.data?.orders || []);
        setBrokerStatus(`Synced ${new Date().toLocaleTimeString()}`);
        setBrokerConnected(true);
      } catch {
        setBrokerStatus("Sync failed");
      }

      setBrokerLoading(false);
    },
    [brokerApiUrl, selectedBrokerAccount]
  );

  const refreshBroker = useCallback(async () => {
    await checkBrokerStatus();

    const result = await loadBrokerAccounts();
    const accountNumber = result.selectedAccount || selectedBrokerAccount;

    if (accountNumber) {
      await loadBrokerAccountData(accountNumber);
    }
  }, [
    checkBrokerStatus,
    loadBrokerAccounts,
    loadBrokerAccountData,
    selectedBrokerAccount,
  ]);

  const primaryBrokerBalance =
    brokerBalances?.combinedBalances?.[0] ||
    brokerBalances?.perCurrencyBalances?.[0] ||
    null;

  return {
    brokerStatus,
    brokerConnected,
    brokerAccounts,
    selectedBrokerAccount,
    setSelectedBrokerAccount,
    brokerBalances,
    brokerPositions,
    brokerOrders,
    brokerLoading,
    primaryBrokerBalance,
    checkBrokerStatus,
    loadBrokerAccounts,
    loadBrokerAccountData,
    refreshBroker,
  };
}