
        varying vec2 vUv;
        varying float vRadius;
        varying vec3 vNormal;
        varying vec3 vPosView;
        varying vec3 vWorldPos;
        uniform float uInnerRadius;
        uniform float uOuterRadius;

        void main() {
          vUv = uv;
          // Compute normalized radius from object-space position instead of UVs.
          float localRadius = length(position.xy);
          vRadius = clamp((localRadius - uInnerRadius) / max((uOuterRadius - uInnerRadius), 1e-6), 0.0, 1.0);

          // Provide transformed normal and view-space position for fresnel calc
          vNormal = normalize(normalMatrix * normal);
          vPosView = (modelViewMatrix * vec4(position, 1.0)).xyz;
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;

          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      