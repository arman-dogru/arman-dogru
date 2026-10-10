#include <stdint.h>

#define MAX_AGENTS 4096

static float px[MAX_AGENTS];
static float py[MAX_AGENTS];
static float vx[MAX_AGENTS];
static float vy[MAX_AGENTS];
static float energy[MAX_AGENTS];
static uint32_t agent_count = 2048;
static uint32_t rng_state = 0xA11CEu;

static uint32_t rng_u32(void) {
  rng_state = rng_state * 1664525u + 1013904223u;
  return rng_state;
}

static float rng01(void) {
  return (float)(rng_u32() & 0x00FFFFFFu) / 16777215.0f;
}

__attribute__((visibility("default")))
void init(uint32_t seed, uint32_t count) {
  rng_state = seed ? seed : 0xA11CEu;
  agent_count = count > MAX_AGENTS ? MAX_AGENTS : (count < 128 ? 128 : count);
  for (uint32_t i = 0; i < agent_count; ++i) {
    float a = rng01() * 6.28318530718f;
    float r = 0.04f + rng01() * 0.44f;
    float rx = (rng01() + rng01() - 1.0f) * r;
    float ry = (rng01() + rng01() - 1.0f) * r;
    px[i] = 0.5f + rx;
    py[i] = 0.5f + ry;
    vx[i] = (rng01() - 0.5f) * 0.08f + a * 0.00001f;
    vy[i] = (rng01() - 0.5f) * 0.08f - a * 0.00001f;
    energy[i] = rng01();
  }
}

__attribute__((visibility("default")))
void step(float dt, float tx, float ty, float attract, float chaos) {
  if (dt > 0.05f) dt = 0.05f;
  if (dt < 0.0001f) dt = 0.0001f;
  for (uint32_t i = 0; i < agent_count; ++i) {
    float dx = tx - px[i];
    float dy = ty - py[i];
    float d2 = dx*dx + dy*dy + 0.0025f;
    float inv = 1.0f / d2;
    float curl_x = -dy * 0.22f;
    float curl_y =  dx * 0.22f;
    float pull = attract * 0.012f * inv;
    float jx = (rng01() - 0.5f) * chaos * 0.16f;
    float jy = (rng01() - 0.5f) * chaos * 0.16f;
    vx[i] += (dx * pull + curl_x + jx) * dt;
    vy[i] += (dy * pull + curl_y + jy) * dt;
    vx[i] *= 0.9955f;
    vy[i] *= 0.9955f;
    px[i] += vx[i] * dt;
    py[i] += vy[i] * dt;
    if (px[i] < 0.0f) px[i] += 1.0f;
    if (px[i] >= 1.0f) px[i] -= 1.0f;
    if (py[i] < 0.0f) py[i] += 1.0f;
    if (py[i] >= 1.0f) py[i] -= 1.0f;
    float speed2 = vx[i]*vx[i] + vy[i]*vy[i];
    energy[i] = speed2 * 220.0f;
    if (energy[i] > 1.0f) energy[i] = 1.0f;
  }
}

__attribute__((visibility("default"))) uint32_t count(void) { return agent_count; }
__attribute__((visibility("default"))) uintptr_t x_ptr(void) { return (uintptr_t)px; }
__attribute__((visibility("default"))) uintptr_t y_ptr(void) { return (uintptr_t)py; }
__attribute__((visibility("default"))) uintptr_t energy_ptr(void) { return (uintptr_t)energy; }
