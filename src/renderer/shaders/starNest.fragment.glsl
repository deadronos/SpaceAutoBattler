// Star Nest by Pablo Roman Andrioli
// This work is licensed under the MIT license. To view a copy of this license, visit https://opensource.org/licenses/MIT or send a letter to Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

// Adapted for Three.js ShaderMaterial by GitHub Copilot for SpaceAutoBattler project.
// Changes: Replaced mainImage with main(), iResolution with uResolution uniform, iTime with uTime uniform.
// Added uniforms for configurables: uZoom, uTile, uSpeed, uBrightness, uDarkmatter, uDistfading, uSaturation.
// Defines for quality presets: iterations, volsteps, stepsize, formuparam.

uniform vec2 uResolution;
uniform float uTime;
uniform float uZoom;
uniform float uTile;
uniform float uSpeed;
uniform float uBrightness;
uniform float uDarkmatter;
uniform float uDistfading;
uniform float uSaturation;
uniform int uIterations;
uniform int uVolsteps;
uniform float uStepsize;
uniform float uFormuparam;

#define iterations uIterations  // But this won't work; remove #define and use uniforms in loops

void main() {
    // get coords and direction
    vec2 uv = gl_FragCoord.xy / uResolution.xy - 0.5;
    uv.y *= uResolution.y / uResolution.x;
    vec3 dir = vec3(uv * uZoom, 1.);
    float time = uTime * uSpeed + 0.25;

    // mouse rotation (disabled for determinism; can be enabled optionally)
    // For now, use fixed rotation or from GameState if needed
    float a1 = 0.5; // fixed
    float a2 = 0.8; // fixed
    mat2 rot1 = mat2(cos(a1), sin(a1), -sin(a1), cos(a1));
    mat2 rot2 = mat2(cos(a2), sin(a2), -sin(a2), cos(a2));
    dir.xz *= rot1;
    dir.xy *= rot2;
    vec3 from = vec3(1.0, 0.5, 0.5);
    from += vec3(time * 2.0, time, -2.0);
    from.xz *= rot1;
    from.xy *= rot2;

    // volumetric rendering
    float s = 0.1, fade = 1.0;
    vec3 v = vec3(0.0);
    for (int r = 0; r < uVolsteps; r++) {
        vec3 p = from + s * dir * 0.5;
        p = abs(vec3(uTile) - mod(p, vec3(uTile * 2.0))); // tiling fold
        float pa, a = pa = 0.0;
        for (int i = 0; i < uIterations; i++) {
            p = abs(p) / dot(p, p) - uFormuparam; // the magic formula
            a += abs(length(p) - pa); // absolute sum of average change
            pa = length(p);
        }
        float dm = max(0.0, uDarkmatter - a * a * 0.001); // dark matter
        a *= a * a; // add contrast
        if (r > 6) fade *= 1.0 - dm; // dark matter, don't render near
        v += fade;
        v += vec3(s, s * s, s * s * s * s) * a * uBrightness * fade; // coloring based on distance
        fade *= uDistfading; // distance fading
        s += uStepsize;
    }
    v = mix(vec3(length(v)), v, uSaturation); // color adjust
    gl_FragColor = vec4(v * 0.01, 1.0);
}