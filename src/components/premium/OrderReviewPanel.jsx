import { money } from "./premiumWorkspaceData.js";
import { ActionButton, PremiumCard, PremiumTable } from "./PremiumWorkspacePrimitives";

export default function OrderReviewPanel({ review, dismissReview, theme }) {
  if (!review) return null;
  const price = typeof review.referencePrice === "number" && review.referencePrice > 0 ? review.referencePrice : null;
  const qty = Number(review.quantity);
  return <section aria-label="Action review preview"><PremiumCard theme={theme} title={review.label}
    action={<ActionButton theme={theme} onClick={dismissReview}>Dismiss Review</ActionButton>}>
    <div style={{ padding:14, fontSize:12, color:theme.muted, lineHeight:1.6 }}>
      <b style={{color:theme.text}}>{review.symbol}</b> · {review.targets.length} affected records<br />
      Review only. These records remain unchanged and nothing is sent to a broker.
      {review.quantity !== undefined && <div>Reference price: {money(price)} · Estimated notional: {money(price !== null && qty > 0 ? price * qty : null)}<br />Reference only; excludes fees and slippage. Buying power and execution eligibility are not verified.</div>}
    </div>
    <PremiumTable theme={theme} keyField="id" columns={[
      {key:"symbol",label:"Symbol",width:"100px"},{key:"kind",label:"Record",width:"1fr"},
      {key:"quantity",label:"Quantity",width:"80px"},{key:"source",label:"Source",width:"1fr"},
    ]} rows={review.targets} emptyMessage="No matching working orders or open positions." />
  </PremiumCard></section>;
}
