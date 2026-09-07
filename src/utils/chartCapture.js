export function captureChartCanvas(element) {
  if (!element) return null;
  const canvases = [...element.querySelectorAll("canvas")].filter(canvas => canvas.width && canvas.height);
  if (!canvases.length) return null;
  const bounds = element.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return null;
  const scale = window.devicePixelRatio || 1;
  const output = document.createElement("canvas");
  output.width = Math.round(bounds.width * scale);
  output.height = Math.round(bounds.height * scale);
  const context = output.getContext("2d");
  context.scale(scale, scale);
  context.fillStyle = getComputedStyle(element).backgroundColor;
  context.fillRect(0, 0, bounds.width, bounds.height);
  for (const canvas of canvases) {
    const rect = canvas.getBoundingClientRect();
    context.drawImage(canvas, rect.left - bounds.left, rect.top - bounds.top, rect.width, rect.height);
  }
  return output;
}
