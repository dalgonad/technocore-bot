export function canvasPoint(clientX, clientY, rect, intrinsicWidth, intrinsicHeight, fit = 'fill') {
  const width = rect.width || intrinsicWidth;
  const height = rect.height || intrinsicHeight;
  let scaleX = width / intrinsicWidth;
  let scaleY = height / intrinsicHeight;
  if (fit === 'cover') scaleX = scaleY = Math.max(scaleX, scaleY);
  if (fit === 'contain') scaleX = scaleY = Math.min(scaleX, scaleY);
  const offsetX = (width - intrinsicWidth * scaleX) / 2;
  const offsetY = (height - intrinsicHeight * scaleY) / 2;
  const x = (clientX - rect.left - offsetX) / scaleX;
  const y = (clientY - rect.top - offsetY) / scaleY;
  return { x, y, inside: x >= 0 && y >= 0 && x < intrinsicWidth && y < intrinsicHeight };
}
