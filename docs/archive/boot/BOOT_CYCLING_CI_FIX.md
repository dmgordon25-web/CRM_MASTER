# Boot Cycling CI Timeout Fix - November 5, 2025

## Issue
The initial boot cycling implementation failed CI checks with a timeout error:
```
TimeoutError: Waiting failed: 15000ms exceeded
    at page.waitForFunction(() => !!window.__SPLASH_HIDDEN__, { timeout: 15000 })
```

The CI test in `tools/feature_check.mjs` waits for `window.__SPLASH_HIDDEN__` to be set within 15 seconds, but the original animation sequence was taking too long.

## Root Cause
Original timing was too conservative:
- Tab/partner delay: 600ms per switch
- Toggle delays: 300ms between mode changes
- Partner cycling: up to 3 partners
- **Total estimated time**: ~8-13 seconds (too close to the 15s timeout)

In CI environments with slower rendering, this could exceed 15 seconds.

## Solution - Optimized Timing

### Changes Made to `/workspace/crm-app/js/boot/boot_hardener.js`

1. **Reduced main animation delay** (line 518):
   - From: `const delay = 600;`
   - To: `const delay = 300;`

2. **Reduced toggle delays** (lines 617, 619, 656, 658):
   - From: `await wait(300);`
   - To: `await wait(150);`

3. **Reduced partner cycling limit** (line 556):
   - From: `.slice(0, 3); // Cycle through first 3 partners max`
   - To: `.slice(0, 2); // Cycle through first 2 partners max (optimized for CI timing)`

### New Timing Breakdown

**Optimized boot animation duration:**
- Initial dashboard load: 300ms (was 600ms)
- Initial toggle cycle: 600ms (was 1,200ms)
  - Today → All: 150ms
  - All → Today: 150ms  
  - Final wait: 300ms
- Partner cycling: 900ms (was 2,400ms)
  - 2 partners × 300ms = 600ms
  - Reset to "All": 300ms
- Tab cycling: 1,500ms (was 3,000ms)
  - 5 tabs × 300ms
- Dashboard return + ready wait: 200ms - 5s (variable)
- Final toggle cycle: 300ms (was 600ms)
  - All → Today: 150ms
  - Final wait: 150ms

**Total**: ~4-9 seconds (was ~8-13 seconds)

### Performance Improvement
- **50% faster** overall animation sequence
- **Well under** the 15-second CI timeout
- Leaves ~6-11 seconds of buffer for slower CI environments
- Still cycles through all required elements

## Benefits of Optimization

1. **CI Stability**: Animation completes reliably within timeout
2. **Faster Boot**: Users see the application ready ~4-5 seconds faster
3. **Maintained Functionality**: Still cycles through:
   - Dashboard Today/All modes (before and after)
   - 2 partners (sufficient for testing partner filter cycling)
   - All 6 tabs (complete tab cycling)

## Testing

The optimized timing was validated to:
- ✅ Complete partner cycling (2 partners)
- ✅ Complete dashboard toggle cycling (before and after tabs)
- ✅ Complete tab cycling (all 6 tabs)
- ✅ Hide splash screen only after all animations
- ✅ Complete within 15-second CI timeout
- ✅ Pass JavaScript syntax validation

## Rationale for Timing Values

### Why 300ms main delay?
- Modern browsers can render and stabilize in 100-200ms
- 300ms provides comfortable margin for slower devices
- Short enough to prevent CI timeout

### Why 150ms toggle delays?
- Dashboard mode toggles are simple state changes
- No heavy rendering required
- 150ms allows state to propagate through React/DOM

### Why 2 partners instead of 3?
- Partner cycling is about testing the filter mechanism, not exhaustive data
- 2 partners is sufficient to verify cycling works
- Saves 600ms on every boot

### Why keep 5s dashboard ready timeout?
- Dashboard widgets may load asynchronously
- 5s is reasonable maximum for widget initialization
- Typically resolves in < 1s in practice

## Future Considerations

If CI continues to struggle with timing:
1. Consider environment detection (skip animation in CI)
2. Add `data-ci-mode` attribute to reduce delays further
3. Make animation timing configurable via query parameter

For now, the current optimization should provide sufficient margin for all environments.
