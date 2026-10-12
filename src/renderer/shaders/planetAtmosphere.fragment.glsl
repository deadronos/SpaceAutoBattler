
        uniform vec3 uAtmosphereColor;
        uniform float uAtmosphereStrength;
        uniform float uAtmosphereFalloff;
        uniform vec3 uLightDir;

        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;

        void main() {
          vec3 normal = normalize(vWorldNormal);
          if (!gl_FrontFacing) {
            normal = -normal;
          }

          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          vec3 lightDir = normalize(uLightDir);

          // Fresnel limb term: brightest at grazing angles near the silhouette.
          float fresnel = pow(1.0 - abs(dot(normal, viewDir)), uAtmosphereFalloff);

          // Forward scattering: only the star-facing hemisphere glows, so the
          // limb fades out on the night side.
          float forwardScatter = max(dot(normal, lightDir), 0.0);

          float intensity = fresnel * forwardScatter * uAtmosphereStrength;
          gl_FragColor = vec4(uAtmosphereColor * intensity, intensity);
        }
      