
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;

        void main() {
          // World-space normal/position so the star light direction (world space)
          // can drive a forward-scattering term in the fragment shader.
          vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
          vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
