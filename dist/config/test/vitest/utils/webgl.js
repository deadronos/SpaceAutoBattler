export function getWebGLContext(canvas) {
    return canvas.getContext('webgl2') || canvas.getContext('webgl') || null;
}
export function hasWebGL() {
    const cvs = document.createElement('canvas');
    return !!getWebGLContext(cvs);
}
