(function () {
    'use strict';

    window.App = window.App || {};

    const storyboardCache = new Map();
    const exactCache = new Map();
    const MAX_CACHE_ENTRIES = 250;

    const DISPATCH_INTERVAL_MS = 60;
    const MIN_RENDER_GAP_MS = 220;
    const SETTLE_DEBOUNCE_MS = 160;

    let latestReqId = 0;
    let activeSlotIndex = -1;
    let lastSlotIndex = -1;
    let currentDisplayedSlot = -1;
    let currentDisplayedTime = -1;

    let settleTimeout = null;
    let prefetchTimeout = null;
    let throttleTimer = null;
    let renderPacingTimeout = null;

    let lastDispatchTimestamp = 0;
    let pendingTargetTime = -1;
    let pendingTargetSlot = -1;

    let lastRenderTimestamp = 0;
    let pendingRenderFrame = null;

    let lastClientX = -1;
    let lastVelocityTime = 0;
    let currentVelocity = 0;
    let scrubDirection = 1;
    let currentAspect = 0;

    function getSlotStep(duration) {
        if (!duration || duration <= 0) return 2.0;
        return Math.max(2.0, duration / 70);
    }

    function getTotalSlots(duration) {
        if (!duration || duration <= 0) return 70;
        const step = getSlotStep(duration);
        return Math.max(10, Math.ceil(duration / step));
    }

    function getSlotForTime(time, duration) {
        if (!duration || duration <= 0) return 0;
        const step = getSlotStep(duration);
        const total = getTotalSlots(duration);
        return Math.min(total - 1, Math.max(0, Math.floor(time / step)));
    }

    function getTimeForSlot(slot, duration) {
        const step = getSlotStep(duration);
        return Math.min(duration, (slot + 0.5) * step);
    }

    function findNearestCachedSlot(targetSlot, maxDeltaSlots) {
        if (storyboardCache.has(targetSlot)) return targetSlot;
        for (let d = 1; d <= maxDeltaSlots; d++) {
            const primary = targetSlot - (d * scrubDirection);
            if (primary >= 0 && storyboardCache.has(primary)) return primary;
            const secondary = targetSlot + (d * scrubDirection);
            if (secondary >= 0 && storyboardCache.has(secondary)) return secondary;
        }
        return -1;
    }

    function trimCache(map) {
        if (map.size > MAX_CACHE_ENTRIES) {
            const firstKey = map.keys().next().value;
            map.delete(firstKey);
        }
    }

    function drawImageDirect(incomingImg, frameTime, isExact, slotIndex) {
        const el = App.Elements;
        const state = App.State;
        if (!el.thumbCanvas) return;
        const canvas = el.thumbCanvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        state.lastDisplayedThumbTime = frameTime;
        currentDisplayedSlot = slotIndex !== undefined ? slotIndex : -1;
        currentDisplayedTime = frameTime;

        const iw = incomingImg.naturalWidth || 320;
        const ih = incomingImg.naturalHeight || 180;

        if (canvas.width !== iw || canvas.height !== ih) {
            canvas.width = iw;
            canvas.height = ih;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(incomingImg, 0, 0, iw, ih);

        if (el.thumbContainer) el.thumbContainer.classList.add('has-frame');
    }

    function updateAspectRatio(incomingImg) {
        const el = App.Elements;
        if (!el.thumbContainer || !incomingImg.naturalWidth || !incomingImg.naturalHeight) return;

        const iw = incomingImg.naturalWidth;
        const ih = incomingImg.naturalHeight;
        const aspect = iw / ih;

        if (Math.abs(aspect - currentAspect) > 0.02) {
            currentAspect = aspect;
            let targetW, targetH;

            if (aspect >= 1.6) {
                targetW = 200;
                targetH = Math.max(76, Math.min(125, Math.round(targetW / aspect)));
            } else if (aspect >= 1.0) {
                targetH = 120;
                targetW = Math.max(120, Math.min(200, Math.round(targetH * aspect)));
            } else {
                targetH = 135;
                targetW = Math.max(80, Math.min(160, Math.round(targetH * aspect)));
            }

            el.thumbContainer.style.width = `${targetW}px`;
            el.thumbContainer.style.height = `${targetH}px`;
        }
    }

    function renderFrameToCanvas(frameSource, frameTime, isExact, slotIndex) {
        const el = App.Elements;
        if (!el.thumbContainer || !el.thumbCanvas || !frameSource) return;

        if (slotIndex !== undefined && slotIndex === currentDisplayedSlot && Math.abs(currentDisplayedTime - frameTime) < 0.05 && !isExact) {
            return;
        }

        const now = performance.now();
        const elapsed = now - lastRenderTimestamp;

        if (!isExact && elapsed < MIN_RENDER_GAP_MS) {
            pendingRenderFrame = { frameSource, frameTime, isExact, slotIndex };
            if (!renderPacingTimeout) {
                renderPacingTimeout = setTimeout(() => {
                    renderPacingTimeout = null;
                    if (pendingRenderFrame) {
                        const target = pendingRenderFrame;
                        pendingRenderFrame = null;
                        renderFrameToCanvas(target.frameSource, target.frameTime, target.isExact, target.slotIndex);
                    }
                }, MIN_RENDER_GAP_MS - elapsed);
            }
            return;
        }

        if (renderPacingTimeout) {
            clearTimeout(renderPacingTimeout);
            renderPacingTimeout = null;
        }
        pendingRenderFrame = null;
        lastRenderTimestamp = now;

        if (frameSource instanceof HTMLImageElement && frameSource.complete && frameSource.naturalWidth > 0) {
            updateAspectRatio(frameSource);
            drawImageDirect(frameSource, frameTime, isExact, slotIndex);
            return;
        }

        const incomingImg = new Image();
        incomingImg.onload = () => {
            updateAspectRatio(incomingImg);
            drawImageDirect(incomingImg, frameTime, isExact, slotIndex);
        };
        incomingImg.src = typeof frameSource === 'string' ? frameSource : (frameSource.src || '');
    }

    function dispatchThumbnailRequest(time, exact, slotIndex) {
        latestReqId++;
        window.mpvAPI.requestThumbnail(time, exact, latestReqId);
    }

    function scheduleDispatch(time, slotIndex) {
        pendingTargetTime = time;
        pendingTargetSlot = slotIndex;
        const now = performance.now();
        const elapsed = now - lastDispatchTimestamp;

        if (elapsed >= DISPATCH_INTERVAL_MS) {
            if (throttleTimer) {
                clearTimeout(throttleTimer);
                throttleTimer = null;
            }
            lastDispatchTimestamp = now;
            dispatchThumbnailRequest(time, false, slotIndex);
        } else if (!throttleTimer) {
            throttleTimer = setTimeout(() => {
                throttleTimer = null;
                lastDispatchTimestamp = performance.now();
                if (pendingTargetTime >= 0) {
                    dispatchThumbnailRequest(pendingTargetTime, false, pendingTargetSlot);
                }
            }, DISPATCH_INTERVAL_MS - elapsed);
        }
    }

    function schedulePrefetch(slotIndex, duration) {
        clearTimeout(prefetchTimeout);
        prefetchTimeout = setTimeout(() => {
            const total = getTotalSlots(duration);
            const dir = scrubDirection;
            const steps = [dir, dir * 2, -dir];
            for (let step of steps) {
                const targetSlot = slotIndex + step;
                if (targetSlot >= 0 && targetSlot < total && !storyboardCache.has(targetSlot)) {
                    const time = getTimeForSlot(targetSlot, duration);
                    dispatchThumbnailRequest(time, false, targetSlot);
                    break;
                }
            }
        }, 80);
    }

    App.Thumbnails = {
        init() {
            const el = App.Elements;
            const state = App.State;

            window.mpvAPI.onThumbnailReady((data) => {
                if (!data || !data.data) return;

                const actualTime = typeof data.time === 'number' ? data.time : parseFloat(data.time);
                const reqTime = typeof data.requestedTime === 'number' ? data.requestedTime : parseFloat(data.requestedTime);
                const duration = state.mediaDuration || 0;
                const respReqId = data.reqId || 0;

                if (duration <= 0) return;

                const respSlot = getSlotForTime(reqTime, duration);
                const img = new Image();
                img.onload = () => {
                    storyboardCache.set(respSlot, { img, time: actualTime });
                    exactCache.set(Math.round(actualTime * 10), { img, time: actualTime });
                    trimCache(storyboardCache);
                    trimCache(exactCache);

                    const isVisible = el.timelineTooltip && el.timelineTooltip.style.display !== 'none' && state.currentHoverSec >= 0;
                    if (isVisible) {
                        const curHoverSlot = getSlotForTime(state.currentHoverSec, duration);
                        const isLatest = (respReqId >= latestReqId);
                        const isClose = Math.abs(state.currentHoverSec - actualTime) <= getSlotStep(duration) * 1.5;

                        if (isLatest || respSlot === curHoverSlot || isClose) {
                            const isExact = (respReqId === latestReqId && Math.abs(state.currentHoverSec - actualTime) < 0.2);
                            renderFrameToCanvas(img, actualTime, isExact, respSlot);
                        }
                    }
                };
                img.src = data.data;
            });
        },

        reset() {
            const el = App.Elements;
            const state = App.State;

            storyboardCache.clear();
            exactCache.clear();
            latestReqId = 0;
            lastDispatchTimestamp = 0;
            lastRenderTimestamp = 0;
            activeSlotIndex = -1;
            lastSlotIndex = -1;
            currentDisplayedSlot = -1;
            currentDisplayedTime = -1;
            lastClientX = -1;
            lastVelocityTime = 0;
            currentVelocity = 0;
            scrubDirection = 1;
            currentAspect = 0;

            clearTimeout(settleTimeout);
            settleTimeout = null;
            clearTimeout(prefetchTimeout);
            prefetchTimeout = null;
            clearTimeout(throttleTimer);
            throttleTimer = null;
            clearTimeout(renderPacingTimeout);
            renderPacingTimeout = null;
            pendingRenderFrame = null;
            pendingTargetTime = -1;
            pendingTargetSlot = -1;

            if (el.thumbContainer) el.thumbContainer.classList.remove('has-frame');
            if (el.thumbCanvas) {
                const ctx = el.thumbCanvas.getContext('2d');
                if (ctx) ctx.clearRect(0, 0, el.thumbCanvas.width, el.thumbCanvas.height);
            }
            state.isNativeVideoThumbSupported = false;
            state.lastThumbVideoSrc = '';
            state.lastDisplayedThumbTime = -1;
        },

        onMouseLeave() {
            clearTimeout(settleTimeout);
            settleTimeout = null;
            clearTimeout(prefetchTimeout);
            prefetchTimeout = null;
            clearTimeout(throttleTimer);
            throttleTimer = null;
            clearTimeout(renderPacingTimeout);
            renderPacingTimeout = null;
            pendingRenderFrame = null;
            pendingTargetTime = -1;
            pendingTargetSlot = -1;
            activeSlotIndex = -1;
            currentDisplayedSlot = -1;
            currentDisplayedTime = -1;
            lastClientX = -1;
            lastVelocityTime = 0;
            currentVelocity = 0;
            scrubDirection = 1;
            currentAspect = 0;
        },

        updateVelocity(clientX) {
            const now = performance.now();
            if (lastClientX >= 0 && lastVelocityTime > 0) {
                const dt = (now - lastVelocityTime) / 1000;
                if (dt > 0.005) {
                    const dx = clientX - lastClientX;
                    if (dx > 2) scrubDirection = 1;
                    else if (dx < -2) scrubDirection = -1;
                    const instVelocity = Math.abs(dx) / dt;
                    currentVelocity = currentVelocity * 0.7 + instVelocity * 0.3;
                }
            }
            lastClientX = clientX;
            lastVelocityTime = now;
        },

        updateTrackSupport(videoTracks) {
            App.State.isNativeVideoThumbSupported = false;
        },

        request(hoverTime) {
            const el = App.Elements;
            const state = App.State;

            if (state.isAudioMode || !state.mediaDuration || state.mediaDuration <= 0) {
                if (el.thumbContainer) el.thumbContainer.classList.remove('has-frame');
                return;
            }

            const duration = state.mediaDuration;
            const slotIndex = getSlotForTime(hoverTime, duration);
            const slotTime = getTimeForSlot(slotIndex, duration);

            const exactKey = Math.round(hoverTime * 10);
            if (exactCache.has(exactKey)) {
                activeSlotIndex = slotIndex;
                const cachedExact = exactCache.get(exactKey);
                renderFrameToCanvas(cachedExact.img, cachedExact.time, true, slotIndex);
                return;
            }

            if (storyboardCache.has(slotIndex)) {
                activeSlotIndex = slotIndex;
                const cached = storyboardCache.get(slotIndex);
                renderFrameToCanvas(cached.img, cached.time, false, slotIndex);

                clearTimeout(settleTimeout);
                settleTimeout = setTimeout(() => {
                    if (state.currentHoverSec >= 0) {
                        dispatchThumbnailRequest(state.currentHoverSec, true, slotIndex);
                    }
                }, SETTLE_DEBOUNCE_MS);

                schedulePrefetch(slotIndex, duration);
                return;
            }

            const nearestSlot = findNearestCachedSlot(slotIndex, 4);
            if (nearestSlot >= 0 && nearestSlot !== currentDisplayedSlot) {
                const cached = storyboardCache.get(nearestSlot);
                if (cached && cached.img) {
                    renderFrameToCanvas(cached.img, cached.time, false, nearestSlot);
                }
            }

            lastSlotIndex = activeSlotIndex;
            activeSlotIndex = slotIndex;
            scheduleDispatch(slotTime, slotIndex);

            clearTimeout(settleTimeout);
            settleTimeout = setTimeout(() => {
                if (state.currentHoverSec >= 0) {
                    dispatchThumbnailRequest(state.currentHoverSec, true, slotIndex);
                }
            }, SETTLE_DEBOUNCE_MS);
        }
    };
})();
