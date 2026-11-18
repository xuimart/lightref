float computeSSAO(vec2 fragXY, float myDepth) {
  if (uHasDepthMap < 0.5) return 1.0;
  vec2 uv = fragXY / max(vec2(1.0), uResolution);
  float radius = 0.018;
  float occ = 0.0;
  float angle = fract(sin(dot(fragXY, vec2(12.9898, 78.233))) * 43758.5453) * 6.283185;
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float a = angle + fi * 2.39996;
    float r = radius * (0.25 + 0.75 * ((fi + 0.5) / 8.0));
    vec2 suv = clamp(uv + vec2(cos(a), sin(a)) * r, 0.002, 0.998);
    vec4 ds = texture2D(uDepthMap, suv);
    float sampleD = ds.r + ds.g / 255.0;
    if (sampleD < 0.998) {
      float diff = myDepth - sampleD;
      if (diff > 0.0012 && diff < 0.018) {
        occ += smoothstep(0.018, 0.004, diff) * smoothstep(0.0012, 0.004, diff);
      }
    }
  }
  return clamp(1.0 - (occ / 8.0) * 1.35, 0.25, 1.0);
}
