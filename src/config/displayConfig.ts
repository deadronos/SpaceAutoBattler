export function getDefaultBounds() {
  const W = (typeof window !== 'undefined' && window.innerWidth) ? window.innerWidth : 800;
  const H = (typeof window !== 'undefined' && window.innerHeight) ? window.innerHeight : 600;
  return { W: Math.max(800, W), H: Math.max(600, H) };
}

export default { getDefaultBounds };
