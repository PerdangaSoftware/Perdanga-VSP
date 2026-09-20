// ui/thumbnails.js
(function () {
    'use strict';

    window.App = window.App || {};

    App.Thumbnails = {
        init() {
            const el = App.Elements;
            const state = App.State;

            window.mpvAPI.onThumbnailReady((data) => {
                if (!data || !data.data) return;
                const rounded = Math.round(data.time);

                if (state.thumbCache.size >= state.THUMB_CACHE_LIMIT && !state.thumbCache.has(rounded)) {
                    state.thumbCache.delete(state.thumbCache.keys().next().value);
                }
                state.thumbCache.set(rounded, data.data);

                if (el.timelineTooltip.style.display !== 'none') {
                    el.thumbVideo.style.display = 'none';
                    el.thumbImg.src = data.data;
                    el.thumbImg.style.display = 'block';
                    el.thumbContainer.classList.add('has-frame');
                }
            });

            el.thumbVideo.addEventListener('error', () => {
                state.isNativeVideoThumbSupported = false;
                state.lastThumbVideoSrc = '';
                el.thumbVideo.style.display = 'none';
                el.thumbContainer.classList.remove('has-frame');
            });

            el.thumbVideo.addEventListener('seeked', () => {
                if (state.isNativeVideoThumbSupported && el.thumbVideo.videoWidth > 0) {
                    el.thumbVideo.classList.add('ready');
                    el.thumbContainer.classList.add('has-frame');
                }
            });
        },

        reset() {
            const el = App.Elements;
            const state = App.State;
            state.thumbCache.clear();
            el.thumbContainer.classList.remove('has-frame');
            el.thumbVideo.classList.remove('ready');
            el.thumbVideo.removeAttribute('src');
            el.thumbVideo.load();
            el.thumbImg.src = '';
            el.thumbImg.style.display = 'none';
            state.isNativeVideoThumbSupported = false;
            state.lastThumbVideoSrc = '';
        },

        updateTrackSupport(videoTracks) {
            const el = App.Elements;
            const state = App.State;
            const currentVideo = videoTracks.find(t => t.selected) || videoTracks[0];

            if (currentVideo && App.Utils.isChromiumSupportedVideo(currentVideo.codec, state.currentFilePath)) {
                state.isNativeVideoThumbSupported = true;
                el.thumbImg.style.display = 'none';
                el.thumbVideo.style.display = 'block';
                const safeUrl = App.Utils.pathToLocalFileUrl(state.currentFilePath);
                if (state.lastThumbVideoSrc !== safeUrl) {
                    state.lastThumbVideoSrc = safeUrl;
                    el.thumbVideo.src = safeUrl;
                    el.thumbVideo.load();
                }
            } else {
                state.isNativeVideoThumbSupported = false;
                state.lastThumbVideoSrc = '';
                el.thumbVideo.removeAttribute('src');
                el.thumbVideo.load();
                el.thumbVideo.style.display = 'none';
            }
        },

        request(hoverTime) {
            const el = App.Elements;
            const state = App.State;

            if (state.isNativeVideoThumbSupported) {
                el.thumbImg.style.display = 'none';
                el.thumbVideo.style.display = 'block';
                if (el.thumbVideo.readyState >= 2 && !el.thumbVideo.seeking) {
                    try {
                        if (typeof el.thumbVideo.fastSeek === 'function') {
                            el.thumbVideo.fastSeek(hoverTime);
                        } else {
                            el.thumbVideo.currentTime = hoverTime;
                        }
                    } catch (err) { /* seek before metadata ready */ }
                }
            } else {
                const cacheKey = Math.round(hoverTime);
                if (state.thumbCache.has(cacheKey)) {
                    el.thumbVideo.style.display = 'none';
                    el.thumbImg.src = state.thumbCache.get(cacheKey);
                    el.thumbImg.style.display = 'block';
                    el.thumbContainer.classList.add('has-frame');
                } else {
                    const now = Date.now();
                    if (now - state.lastThumbRequestTime > 120) {
                        window.mpvAPI.requestThumbnail(hoverTime);
                        state.lastThumbRequestTime = now;
                    }
                }
            }
        }
    };
})();