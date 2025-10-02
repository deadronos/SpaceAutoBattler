// based on https://www.shadertoy.com/view/lsf3RH by
// trisomie21 (THANKS!)
// My apologies for the ugly code.

#if defined(GL_FRAGMENT_PRECISION_HIGH)
precision highp float;
#else
precision mediump float;
#endif

uniform float iTime;
uniform vec3 iResolution;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
// Camera roll angle around view direction in radians. Used to de-rotate the inner pattern so it
// appears stable inside the billboard even as the camera rolls.
uniform float iCameraRoll;
// Star-fixed orientation in radians (0 means +X to the right in the disk's UV space).
uniform float iStarNorth;
// Camera alignment: X/Y encode projected direction on the disk plane, Z is facing cosine.
uniform vec3 iViewAlignment;
uniform vec3 iHazeParams;
uniform vec4 iBoundaryFeather;

// Geometry-provided UVs for the billboard (stable in object space)
varying vec2 vUv;

float snoise(vec3 uv, float res)	// by trisomie21
{
	const vec3 s = vec3(1e0, 1e2, 1e4);
	
	uv *= res;
	
	vec3 uv0 = floor(mod(uv, res))*s;
	vec3 uv1 = floor(mod(uv+vec3(1.), res))*s;
	
	vec3 f = fract(uv); f = f*f*(3.0-2.0*f);
	
	vec4 v = vec4(uv0.x+uv0.y+uv0.z, uv1.x+uv0.y+uv0.z,
		      	  uv0.x+uv1.y+uv0.z, uv1.x+uv1.y+uv0.z);
	
	vec4 r = fract(sin(v*1e-3)*1e5);
	float r0 = mix(mix(r.x, r.y, f.x), mix(r.z, r.w, f.x), f.y);
	
	r = fract(sin((v + uv1.z - uv0.z)*1e-3)*1e5);
	float r1 = mix(mix(r.x, r.y, f.x), mix(r.z, r.w, f.x), f.y);
	
	return mix(r0, r1, f.z)*2.-1.;
}

float hazeTaper(vec2 planeCoords)
{
  float radius = length(planeCoords);
  float rimStart = mix(0.65, 0.85, clamp(iHazeParams.y, 0.0, 0.9));
  float rimMix = smoothstep(rimStart, 1.0, radius);
  float rimExponent = max(iHazeParams.z, 0.5);
  float hazeFade = clamp(iHazeParams.x, 0.0, 1.1);
  float rimWeight = pow(rimMix, rimExponent);
  return mix(1.0, hazeFade, rimWeight);
}

float boundaryFeather(vec2 planeCoords)
{
  float disableStart = iBoundaryFeather.x;
  float disableFloor = iBoundaryFeather.z;
  if (disableStart >= 0.999 || disableFloor >= 0.999) {
    return 1.0;
  }
  float radius = clamp(length(planeCoords), 0.0, 1.0);
  float featherStart = clamp(iBoundaryFeather.x, 0.6, 0.999);
  float exponent = max(iBoundaryFeather.y, 0.5);
  float alphaFloor = clamp(iBoundaryFeather.z, 0.0, 1.0);
  float rimMix = smoothstep(featherStart, 1.0, radius);
  float t = pow(clamp(rimMix, 0.0, 1.0), exponent);
  float feather = mix(1.0, alphaFloor, t);
  return clamp(feather, 0.0, 1.0);
}

float freqs[4];

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	freqs[0] = texture( iChannel1, vec2( 0.01, 0.25 ) ).x;
	freqs[1] = texture( iChannel1, vec2( 0.07, 0.25 ) ).x;
	freqs[2] = texture( iChannel1, vec2( 0.15, 0.25 ) ).x;
	freqs[3] = texture( iChannel1, vec2( 0.30, 0.25 ) ).x;

	float brightness	= freqs[1] * 0.25 + freqs[2] * 0.25;
	float radius		= 0.24 + brightness * 0.2;
	float invRadius 	= 1.0 / radius;
	
	vec3 orange		= vec3( 0.8, 0.65, 0.3 );
	vec3 orangeRed		= vec3( 0.8, 0.35, 0.1 );
	float time	= iTime * 0.1;

	vec2 planeLocal = vUv * 2.0 - 1.0;
	float cosNorth = cos(-iStarNorth);
	float sinNorth = sin(-iStarNorth);
	vec2 planeAligned = vec2(
		cosNorth * planeLocal.x - sinNorth * planeLocal.y,
		sinNorth * planeLocal.x + cosNorth * planeLocal.y
	);

	float facingCos = clamp(iViewAlignment.z, 0.0, 1.0);
	float safeCos = max(facingCos, 0.2);
	float axisLength = length(iViewAlignment.xy);
	vec2 viewAxis = axisLength > 0.0001 ? iViewAlignment.xy / axisLength : vec2(0.0, 1.0);
	vec2 tangentAxis = vec2(-viewAxis.y, viewAxis.x);
	vec2 compensatedPlane = tangentAxis * dot(planeAligned, tangentAxis) + viewAxis * (dot(planeAligned, viewAxis) / safeCos);
	float hazeAttenuation = hazeTaper(compensatedPlane);
	float boundaryAttenuation = boundaryFeather(compensatedPlane);

	vec2 p = compensatedPlane * 0.5;
	float fade		= pow( length( 2.0 * p ), 0.5 );
	float fVal1		= 1.0 - fade;
	float fVal2		= 1.0 - fade;
	float dist	= length(p);
	float viewBoost = mix(0.55, 1.0, facingCos);
	
	// Compute polar angle and compensate camera roll so the screen-space noise basis doesn't spin
	float angle		= (atan( p.x, p.y ) - iCameraRoll)/6.2832;
	float distPolar		= length(p);
	vec3 coord		= vec3( angle, distPolar, time * 0.1 );
	
	float newTime1	= abs( snoise( coord + vec3( 0.0, -time * ( 0.35 + brightness * 0.001 ), time * 0.015 ), 15.0 ) );
	float newTime2	= abs( snoise( coord + vec3( 0.0, -time * ( 0.15 + brightness * 0.001 ), time * 0.015 ), 45.0 ) );
	for( int i=1; i<=7; i++ ){
		float power = pow( 2.0, float(i + 1) );
		fVal1 += ( 0.5 / power ) * snoise( coord + vec3( 0.0, -time, time * 0.2 ), ( power * ( 10.0 ) * ( newTime1 + 1.0 ) ) );
		fVal2 += ( 0.5 / power ) * snoise( coord + vec3( 0.0, -time, time * 0.2 ), ( power * ( 25.0 ) * ( newTime2 + 1.0 ) ) );
	}
	
	float corona		= pow( fVal1 * max( 1.1 - fade, 0.0 ), 2.0 ) * 50.0;
	corona			+= pow( fVal2 * max( 1.1 - fade, 0.0 ), 2.0 ) * 50.0;
	corona			*= 1.2 - newTime1;

	vec3 starSphere	= vec3( 0.0 );
	
	vec2 sp = compensatedPlane * ( 2.0 - brightness );
	float r = dot(sp,sp);
	float f = (1.0 - sqrt(abs(1.0 - r))) / (r + 1e-6) + brightness * 0.5;
	if( dist < radius ){
		corona		*= pow( dist * invRadius, 24.0 );
		vec2 compensatedLocal = compensatedPlane;
		float rLocal = dot(compensatedLocal, compensatedLocal);
		float fLocal = (1.0 - sqrt(abs(1.0 - rLocal))) / (rLocal + 1e-6) + brightness * 0.5;
		vec2 newUv = vec2(compensatedLocal.x * fLocal, compensatedLocal.y * fLocal);
		newUv += vec2( time, 0.0 );
		
		vec3 texSample 	= texture( iChannel0, newUv ).rgb;
		float uOff		= ( texSample.g * brightness * 4.5 + time );
		vec2 starUV		= newUv + vec2( uOff, 0.0 );
		starSphere		= texture( iChannel0, starUV ).rgb;
	}
	
	float starGlow	= min( max( 1.0 - dist * ( 1.0 - brightness ), 0.0 ), 1.0 );
	corona *= hazeAttenuation;
	float cappedHaze = min(hazeAttenuation, 1.0);
	starGlow *= cappedHaze;
	corona *= viewBoost;
	starGlow *= viewBoost;
	starSphere *= mix(0.7, 1.0, facingCos);
	vec3 diskCore = vec3( f * ( 0.75 + brightness * 0.3 ) * orange ) + starSphere;
	vec3 haloColor = corona * orange + starGlow * orangeRed;
	vec3 attenuatedColor = (diskCore + haloColor) * boundaryAttenuation;
	fragColor.rgb	= attenuatedColor;
	fragColor.a		= boundaryAttenuation;
}

void main() {
	vec4 color = vec4(0.0);
	mainImage(color, gl_FragCoord.xy);
	gl_FragColor = color;
}