import { formatPacificDateTime } from '../../../utils/timeFormatters';
import { money } from '../premiumWorkspaceData';
import { PremiumCard, PremiumTable } from '../PremiumWorkspacePrimitives';

export default function PaperOrderActivity({ orders = [], selectedId, theme }) {
  const selected = orders.find(order => order.id === selectedId);
  if (!selected) return null;
  const parentId = selected.parentId || selected.id;
  const rows = orders.filter(order => order.id === parentId || order.parentId === parentId)
    .map(order => ({ ...order, activityId: "activity-" + order.id }))
    .sort((a, b) => Number(Boolean(a.parentId)) - Number(Boolean(b.parentId)));
  return <PremiumCard theme={theme} title="Selected order activity">
    <PremiumTable theme={theme} rows={rows} keyField="activityId" rowLabel={order => [order.symbol, order.type, order.status].filter(Boolean).join(" ")} columns={[
      { key: 'type', label: 'Order', width: '130px', render: order => (order.parentId ? 'Linked exit · ' : '') + String(order.action || order.side || "Unknown side").replaceAll('_', ' ') + ' · ' + (order.type || order.orderType || "Unknown type") },
      { key: 'status', label: 'Status', width: '100px' },
      { key: 'filled', label: 'Fill', width: '145px', render: order => order.filled > 0 ? order.filled + ' @ ' + money(order.price) : 'No fill recorded' },
      { key: 'time', label: 'Latest event', width: '170px', render: order => formatPacificDateTime(order.cancelledAt || order.filledAt || order.createdAt) },
      { key: 'reason', label: 'Details', width: '1fr' },
    ]} />
  </PremiumCard>;
}
