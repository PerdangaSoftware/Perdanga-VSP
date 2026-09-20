// ui/timeline.js
(function () {
    'use strict';

    window.App = window.App || {};

    let scrubThrottle = false;
    let hoverRafPending = false;

    App.Timeline = {
        init() {
            const el = App.Elements;
            const state = App.State;

            App.Timeline.updateRect();
            window.addEventListener('resize', App.Timeline.updateRect, { passive: true });
            el.progressWrapper.addEventListener('mouseenter', App.Timeline.updateRect, { passive: true });

            el.progressWrapper.addEventListener('mousedown', (e) => {
                if (!state.isVideoLoaded || e.button !== 0) return;
                App.Timeline.updateRect();
                state.isMouseDownOnTimeline = true;
                state.isDraggingTimeline = false;
                state.mouseDownClientX = e.clientX;
                state.mouseDownClientY = e.clientY;
            });

            window.addEventListener('mousemove', (e) => {
                App.OSD.resetUIHider(e);
                if (!state.isMouseDownOnTimeline) return;

                if (!state.isDraggingTimeline) {
                    const deltaX = Math.abs(e.clientX - state.mouseDownClientX);
                    const deltaY = Math.abs(e.clientY - state.mouseDownClientY);
                    if (deltaX > 4 || deltaY > 4) {
                        state.isDraggingTimeline = true;
                        el.progressWrapper.classList.add('scrubbing');
                        window.mpvAPI.setProperty('pause', true);
                    }
                }

                if (state.isDraggingTimeline) {
                    const time = App.Timeline.getTimeFromMouseEvent(e);
                    App.Timeline.performSeek(time, false);
                }
            }, { passive: true });

            window.addEventListener('mouseup', (e) => {
                if (!state.isMouseDownOnTimeline) return;

                const time = App.Timeline.getTimeFromMouseEvent(e);

                if (state.isDraggingTimeline) {
                    state.isDraggingTimeline = false;
                    el.progressWrapper.classList.remove('scrubbing');
                    App.Timeline.performSeek(time, true);
                    if (state.isVideoPlayingIntent) {
                        window.mpvAPI.setProperty('pause', false);
                    }
                } else {
                    App.Timeline.performSeek(time, true);
                }

                state.isMouseDownOnTimeline = false;
            });

            el.progressWrapper.addEventListener('mousemove', (e) => {
                if (!state.isVideoLoaded || !state.mediaDuration) return;
                if (hoverRafPending) return;
                hoverRafPending = true;
                const clientX = e.clientX;

                requestAnimationFrame(() => {
                    hoverRafPending = false;
                    const hoverTime = App.Timeline.getTimeFromMouseEvent({ clientX });
                    if (isNaN(hoverTime)) return;

                    let hoverChapterName = '';
                    if (state.chaptersEnabled && state.mediaChapters.length > 0) {
                        let hoverIdx = -1;
                        for (let i = state.mediaChapters.length - 1; i >= 0; i--) {
                            if (state.mediaChapters[i].time <= hoverTime) {
                                hoverIdx = i;
                                break;
                            }
                        }
                        if (hoverIdx !== -1) {
                            const title = App.Playlist.getChapterTitle(state.mediaChapters[hoverIdx], hoverIdx);
                            hoverChapterName = `<br><span style="color: var(--accent); font-weight: 700;">${App.Utils.escapeHTML(title)}</span>`;
                        }
                    }

                    const frameNumber = state.currentFps > 0 ? Math.floor(hoverTime * state.currentFps) : 0;
                    const newHTML = `${App.Utils.formatDetailedTime(hoverTime)} | Frame: ${frameNumber}${hoverChapterName}`;
                    if (state.lastTooltipHTML !== newHTML) {
                        el.thumbText.innerHTML = newHTML;
                        state.lastTooltipHTML = newHTML;
                    }

                    el.timelineTooltip.style.display = 'flex';
                    const tooltipHalf = 110;
                    const clampedX = Math.max(tooltipHalf, Math.min(window.innerWidth - tooltipHalf, clientX));
                    el.timelineTooltip.style.left = `${clampedX}px`;

                    if (state.isAudioMode) {
                        el.thumbContainer.classList.remove('has-frame');
                        return;
                    }

                    App.Thumbnails.request(hoverTime);
                });
            }, { passive: true });

            el.progressWrapper.addEventListener('mouseleave', () => {
                el.timelineTooltip.style.display = 'none';
            });
        },

        updateRect() {
            const el = App.Elements;
            if (el.progressWrapper) {
                App.State.cachedProgressRect = el.progressWrapper.getBoundingClientRect();
            }
        },

        updateProgressBarFill(val) {
            const max = App.State.mediaDuration > 0 ? App.State.mediaDuration : 100;
            const pct = Math.max(0, Math.min(100, (val / max) * 100));
            App.Elements.progressBar.style.setProperty('--progress-pct', `${pct}%`);
        },

        getTimeFromMouseEvent(e) {
            const state = App.State;
            if (!state.mediaDuration) return 0;
            if (!state.cachedProgressRect) App.Timeline.updateRect();
            const rect = state.cachedProgressRect;
            const thumbWidth = 18;
            const clickX = e.clientX - rect.left - (thumbWidth / 2);
            const trackWidth = rect.width - thumbWidth;
            let pos = 0;
            if (trackWidth > 0) {
                pos = Math.max(0, Math.min(1, clickX / trackWidth));
            }
            return pos * state.mediaDuration;
        },

        performSeek(time, isFinal = false) {
            const state = App.State;
            const el = App.Elements;

            el.progressBar.value = time;
            state.lastProgressBarValue = time;
            App.Timeline.updateProgressBarFill(time);
            const newTimeStr = App.Utils.formatTime(time);
            el.currentTimeEl.textContent = newTimeStr;
            state.lastTimeStr = newTimeStr;

            if (isFinal) {
                state.seekLockoutUntil = Date.now() + 300;
                window.mpvAPI.seek(time, true, true);
            } else if (!scrubThrottle) {
                window.mpvAPI.seek(time, true, false);
                scrubThrottle = true;
                setTimeout(() => { scrubThrottle = false; }, 40);
            }
        },

        accumulateSeek(delta) {
            const state = App.State;
            const el = App.Elements;
            if (!state.isVideoLoaded) return;
            const duration = state.mediaDuration || 0;

            if (state.isAccumulatingSeek && state.seekAccumulator !== 0 && Math.sign(delta) !== Math.sign(state.seekAccumulator)) {
                state.baseSeekTime = Math.max(0, Math.min(duration, state.baseSeekTime + state.seekAccumulator));
                state.seekAccumulator = 0;
            }

            if (!state.isAccumulatingSeek) {
                state.baseSeekTime = state.currentTime;
                state.isAccumulatingSeek = true;
                state.smoothSeekCurrent = state.baseSeekTime;

                const animateSmoothSeek = () => {
                    if (!state.isAccumulatingSeek) return;
                    state.smoothSeekCurrent += (state.smoothSeekTarget - state.smoothSeekCurrent) * 0.35;
                    el.progressBar.value = state.smoothSeekCurrent;
                    App.Timeline.updateProgressBarFill(state.smoothSeekCurrent);
                    state.smoothSeekRaf = requestAnimationFrame(animateSmoothSeek);
                };
                state.smoothSeekRaf = requestAnimationFrame(animateSmoothSeek);
                window.mpvAPI.setProperty('pause', true);
            }

            const rawTarget = state.baseSeekTime + state.seekAccumulator + delta;
            const targetTime = Math.max(0, Math.min(duration, rawTarget));
            state.seekAccumulator = targetTime - state.baseSeekTime;
            state.smoothSeekTarget = targetTime;

            const now = Date.now();
            if (now - state.lastVisualSeekUpdate > 60) {
                state.lastVisualSeekUpdate = now;
                const newTimeStr = App.Utils.formatTime(targetTime);
                if (newTimeStr !== state.lastTimeStr) {
                    el.currentTimeEl.textContent = newTimeStr;
                    state.lastTimeStr = newTimeStr;
                }
                if (state.seekAccumulator !== 0) {
                    const direction = state.seekAccumulator > 0 ? 1 : -1;
                    App.OSD.showSeekOverlay(direction, state.seekAccumulator);
                } else {
                    App.OSD.hideSeekOverlay();
                }
                window.mpvAPI.seek(targetTime, true, false);
            }

            clearTimeout(state.seekAccumulatorTimer);
            state.seekAccumulatorTimer = setTimeout(() => {
                state.isAccumulatingSeek = false;
                cancelAnimationFrame(state.smoothSeekRaf);

                el.progressBar.value = targetTime;
                state.lastProgressBarValue = targetTime;
                App.Timeline.updateProgressBarFill(targetTime);
                const finalTimeStr = App.Utils.formatTime(targetTime);
                el.currentTimeEl.textContent = finalTimeStr;
                state.lastTimeStr = finalTimeStr;
                state.currentTime = targetTime;

                state.seekLockoutUntil = Date.now() + 300;
                window.mpvAPI.seek(targetTime, true, true);
                state.seekAccumulator = 0;
                App.OSD.hideSeekOverlay();

                if (state.isVideoPlayingIntent) {
                    window.mpvAPI.setProperty('pause', false);
                }
                if (!el.playerContainer.classList.contains('hide-ui')) {
                    App.OSD.resetUIHider();
                }
            }, 450);
        },

        renderMarkers() {
            const el = App.Elements;
            const state = App.State;
            el.markersContainer.innerHTML = '';
            if (!state.chaptersEnabled || !state.mediaDuration || state.mediaChapters.length === 0) return;

            state.mediaChapters.forEach((chap, idx) => {
                if (chap.time > state.mediaDuration) return;
                const marker = document.createElement('div');
                marker.className = 'chapter-marker';
                marker.style.left = `${(chap.time / state.mediaDuration) * 100}%`;
                marker.addEventListener('mousedown', (e) => e.stopPropagation());
                marker.addEventListener('click', (e) => {
                    e.stopPropagation();
                    state.seekLockoutUntil = Date.now() + 300;
                    window.mpvAPI.seek(parseFloat(chap.time), true, true);
                    App.OSD.show('CHAPTER', App.Playlist.getChapterTitle(chap, idx));
                });
                el.markersContainer.appendChild(marker);
            });
        }
    };
})();