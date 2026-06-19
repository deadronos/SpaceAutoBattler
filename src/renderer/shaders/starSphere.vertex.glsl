varying vec2 vUv;

void main() {
  vUv = normalize(position).xy * 0.5 + 0.5;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
