import { useRef, useState } from 'react';
import { JOURNAL_CSV_LIMIT, JOURNAL_CSV_TEMPLATE, previewJournalCsv } from '../../../utils/journalCsvImport.js';
import { money } from '../premiumWorkspaceData';
import { ActionButton, PremiumCard, PremiumTable } from '../PremiumWorkspacePrimitives';

export default function JournalImport({ journalRows, importJournalEntries, theme }) {
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState('');
  const selection = useRef(0);
  const existingIds = new Set(journalRows.map(row => row.id));
  const entries = preview?.entries.filter(row => !existingIds.has(row.id)) || [];
  const duplicates = preview ? preview.duplicates + preview.entries.length - entries.length : 0;

  async function readFile(event) {
    const file = event.currentTarget.files?.[0];
    const version = ++selection.current;
    event.currentTarget.value = '';
    setPreview(null);
    setMessage('');
    if (!file) return;
    try {
      if (file.size > JOURNAL_CSV_LIMIT) throw new Error('Choose a CSV file up to 256 KB.');
      const text = await file.text();
      if (selection.current === version) setPreview(previewJournalCsv(text, journalRows));
    } catch (error) {
      if (selection.current === version) setMessage(error.message || 'Unable to read this CSV.');
    }
  }

  return <PremiumCard theme={theme} title="Import closed USD trades">
    <div style={{ display: 'grid', gap: 12, padding: 14, minWidth: 0 }}>
      <p style={{ margin: 0 }}>Use the template for closed trades with a unique trade ID, a UTC close time, and total fees. Convert broker exports to these columns before importing.</p>
      <a style={{ color: theme.text }} href={'data:text/csv;charset=utf-8,' + encodeURIComponent(JOURNAL_CSV_TEMPLATE)} download="journal-trades-template.csv">Download CSV template</a>
      <label>Journal CSV file <input type="file" accept=".csv,text/csv" onChange={readFile} /></label>
      {message && <div role="status">{message}</div>}
      {preview && <>
        <div role="status">{entries.length} new trades · {duplicates} already imported · {preview.errors.length} errors</div>
        {preview.errors.length > 0 && <div role="alert">
          Correct the CSV before importing.
          <ul>{preview.errors.slice(0, 10).map(error => <li key={error}>{error}</li>)}</ul>
        </div>}
        <PremiumTable theme={theme} rows={entries.slice(0, 20)} keyField="id" emptyMessage="No new trades to preview." columns={[
          { key: 'symbol', label: 'Symbol', width: '90px' },
          { key: 'bias', label: 'Side', width: '70px' },
          { key: 'closedAt', label: 'Close time (UTC)', width: '175px' },
          { key: 'quantity', label: 'Quantity', width: '80px' },
          { key: 'pnl', label: 'Net P&L', width: '110px', render: row => money(row.pnl) },
        ]} />
        {entries.length > 20 && <span>Showing the first 20 of {entries.length} trades.</span>}
        <div><ActionButton theme={theme} active disabled={!entries.length || preview.errors.length > 0} onClick={() => {
          importJournalEntries(entries);
          setMessage('Imported ' + entries.length + (entries.length === 1 ? ' trade.' : ' trades.'));
          setPreview(null);
        }}>Import trades</ActionButton></div>
      </>}
    </div>
  </PremiumCard>;
}
