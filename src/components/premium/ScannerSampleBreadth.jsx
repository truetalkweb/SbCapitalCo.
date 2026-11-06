import { isProviderSampleRow } from '../../utils/marketDataContract.js';
import { nullableMoveOf } from './premiumWorkspaceData';
import { PremiumCard } from './PremiumWorkspacePrimitives';

export default function ScannerSampleBreadth({ stocks, theme }) {
  const moves = stocks.filter(isProviderSampleRow).map(nullableMoveOf).filter(value => value !== null);
  const advancing = moves.filter(value => value > 0).length;
  const declining = moves.filter(value => value < 0).length;
  return <PremiumCard theme={theme}>
    <div style={{ padding: 12, color: theme.muted }}>
      <strong>Workspace Sample Breadth</strong>
      <div>{advancing} advancing / {declining} declining / {moves.length - advancing - declining} unchanged</div>
      <div>{moves.length} of {stocks.length} tracked symbols with usable moves</div>
    </div>
  </PremiumCard>;
}
