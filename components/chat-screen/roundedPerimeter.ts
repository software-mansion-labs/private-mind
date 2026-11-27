export const roundedPerimeter = (
  width: number,
  height: number,
  radius: number
) =>
  2 * (width - 2 * radius) + 2 * (height - 2 * radius) + 2 * Math.PI * radius;
