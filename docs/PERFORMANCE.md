# Performance follow-up measurements

Measured on the local Home Assistant 2026.8.3 Docker sandbox, an unthrottled
Chrome desktop at 1440×900, October 2026. These are local fixtures and render
measurements, not physical-device fade latency or guarantees for every installation.

## Dial frames

A 400ms date-path morph advances solar events by 60 seconds, preserving the
existing easing and sampling. The harness wraps `_patchLightClock` to accumulate
its synchronous duration and observes child-list mutations beneath the dial.
Live edit is temporarily disabled during this measurement and restored afterward.
Wait for the destination scene and preview to settle first.

For the 35-light fixture, three baseline runs using the original painters took
121.1, 122.5 and 123.1ms across 26–29 calls, adding/removing 1,820–2,030 nodes.
The original painters were temporarily injected for the baseline only, then
removed by a normal reload before testing final source.

With retained solar marks, gradient stops and override dots, final-source runs
took 105.0ms on the first run and 63.6–68.7ms on warm runs, across 28 calls.
Total child-list changes fell to 30–60; warm frames added/removed **zero** solar
marks or gradient stops. Remaining changes include labels and the intentionally
settled sky paint. An earlier four-light check reduced child-list changes from
1,960 to 284 before gradient-stop retention was added; do not treat that interim
check as the final small-scene CPU result. Final four-light runs took 41–48ms
across 27–28 calls, with 30–58 child-list changes.

The remedy changes node lifetime, not paths, colors, ring samples, animation
timing, light commands or fade durations. Unit tests compare fresh and retained
geometry and order, including event/clamp topology, separate preview roots,
light/dark gradient stops and removed override dots. The baseline stylesheet is
byte-for-byte unchanged after the file split.

To repeat: load a settled scene, copy `_sunPath` as `from`/`to`, advance each
`to.events[].seconds` by 60, observe `_sunPathEl`, wrap `_patchLightClock` without
changing its arguments/return value, invoke `_morphSunPath(from, to, 400)`, wait
650ms, then restore the wrapper and preference. Use three runs and report frame
counts as well as accumulated time. Normally reload afterward. This exercises
rendering, not pointer latency or physical light fades.

## Activation serialization

Actual sandbox `scene_studio.turn_on` handlers were awaited over the existing
admin WebSocket, using four- and 35-light scenes with zero transition and manual
50% day position. Three four-light calls completed in 2.7–10.8ms; 35-light calls
in 11.4–21.9ms. Concurrent disjoint-area pairs completed in 13.7–16.5ms. These
include WebSocket round trip and virtual-light handlers. The 38 available target
light states were restored without errors; a sandbox restart cleared temporary
ownership. No scene/store preferences were changed.

Keep the instance-wide command lock. It currently protects ownership transfer
and the single pending context used to classify state reports; overlapping areas
and shared lights require the same guarantees. The observed local handler cost
does not justify parallelizing that critical section. A future slow-device case
needs measured handler latency and a design for concurrent pending contexts,
shared-light ownership and stale queued ticks before altering the lock.

## Store serialization boundary

Keep HA's event-loop serialization for now. The save payload retains references
to live variable/theme/scene records. Integration writes are mutation-locked,
but cancellation can release the transaction lock while an executor continues
to serialize its live records. A later mutation or its rollback could then
change the referenced records. Getters
also expose records to integration consumers. Moving serialization to a worker
requires an immutable payload or an explicit completion/cancellation contract.

Deep-copying the entire payload on the event loop would reintroduce the large
snapshot cost removed by scoped rollback snapshots. Do not replace the safety
boundary with an unmeasured copy or simply flip HA's serialization flag. Atomic
writes, durability/error propagation, scoped snapshots and dependency-scoped
catalog refresh remain in place. The original temporary-disk study at 500
35-light scenes measured about 6.7ms to first event-loop yield after scoped
snapshots, down from about 54.6ms; those synthetic results justify retaining the
localized improvement, not claiming large-store serialization is free.
