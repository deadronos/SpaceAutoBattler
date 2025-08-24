export function getWebGLContext(canvas: HTMLCanvasElement): WebGL2RenderingContext | WebGLRenderingContext | null {
  return (canvas.getContext('webgl2') as WebGL2RenderingContext) || (canvas.getContext('webgl') as WebGLRenderingContext) || null;
}

export function hasWebGL(): boolean {
  const cvs = document.createElement('canvas');
  return !!getWebGLContext(cvs);
}
