
        uniform float uRimStrength;
        uniform vec3 uRimColor;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vec3 normal = normalize(vNormal);
          if (!gl_FrontFacing) {
            normal = -normal;
          }
          vec3 viewDir = normalize(vViewPosition);
          float ndv = abs(dot(normal, viewDir));
          float fresnel = 1.0 - ndv;
          fresnel = pow(fresnel, 2.0);
          vec3 outColor = uRimColor * uRimStrength * fresnel;
          gl_FragColor = vec4(outColor, fresnel);
        }
      