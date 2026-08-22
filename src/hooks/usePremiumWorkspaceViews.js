import { useMemo } from "react";
import {
  filterNewsRows,
  filterOrderRows,
  filterWatchlistRows,
  selectVisibleRow,
} from "../utils/premiumWorkspaceViews";

export function usePremiumWorkspaceViews({
  alertRows,
  dashboard,
  headlines,
  newsSearch,
  newsView,
  orderRows,
  orderSearch,
  orderView,
  positionRows,
  selected,
  selectedAlertSymbol,
  selectedNewsId,
  selectedOrderId,
  selectedPositionSymbol,
  watchlistSearch,
  watchlistView,
}) {
  return useMemo(() => {
    const watchlistRows = filterWatchlistRows(
      dashboard.watchlistRows,
      watchlistView,
      watchlistSearch,
    );
    const newsRows = filterNewsRows(
      headlines,
      newsView,
      newsSearch,
      dashboard.watchlistRows.map((row) => row.symbol),
    );
    const visibleOrderRows = filterOrderRows(orderRows, orderView, orderSearch);

    return {
      newsRows,
      selectedAlert: alertRows.find((row) => row.id === selectedAlertSymbol)
        || alertRows.find((row) => row.symbol === selected.symbol)
        || alertRows[0],
      selectedOrder: selectVisibleRow(visibleOrderRows, selectedOrderId, selected.symbol),
      selectedPosition: positionRows.find((row) => row.symbol === selectedPositionSymbol)
        || positionRows.find((row) => row.symbol === selected.symbol)
        || positionRows[0],
      selectedStory: selectVisibleRow(newsRows, selectedNewsId, selected.symbol),
      visibleOrderRows,
      watchlistRows,
    };
  }, [
    alertRows,
    dashboard.watchlistRows,
    headlines,
    newsSearch,
    newsView,
    orderRows,
    orderSearch,
    orderView,
    positionRows,
    selected.symbol,
    selectedAlertSymbol,
    selectedNewsId,
    selectedOrderId,
    selectedPositionSymbol,
    watchlistSearch,
    watchlistView,
  ]);
}
