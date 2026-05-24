export default function RightTradingPanel({
  children,
  showRightDock,
}) {
  if (!showRightDock) return null;

  return <>{children}</>;
}