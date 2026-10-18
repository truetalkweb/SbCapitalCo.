import { scannerCoverage } from '../utils/scannerCoverage.js';
export default function ScannerCoverageNotice({ meta, theme }) {
  const coverage = scannerCoverage(meta);
  return <div role="status" aria-label="Scanner coverage" style={{ color: coverage.partial ? theme.amber : theme.muted, fontSize: 11, lineHeight: 1.5, overflowWrap: 'anywhere' }}>
    <strong>{coverage.label}</strong>{' · '}{coverage.detail}{' '}{coverage.snapshot}
    {coverage.warning && <div>{coverage.warning}</div>}
    {meta.refreshing && <div>Provider refresh is running; available results will update when it finishes.</div>}
  </div>;
}
