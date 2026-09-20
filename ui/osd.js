// ui/osd.js
(function () {
    'use strict';

    window.App = window.App || {};

    let osdTimeout = null;
    let uiTimeout = null;

    App.OSD = {
        show(title, main, sub = '') {
            const el = App.Elements;
            el.osdTitle.textContent = title;
            el.osdMain.textContent = main;
            el.osdSub.textContent = sub;
            el.osdSub.style.display = sub ? 'block' : 'none';
            el.osdAlert.classList.add('show');
            clearTimeout(osdTimeout);
            osdTimeout = setTimeout(() => {
                el.osdAlert.classList.remove('show');
            }, 2200);
        },

        showSeekOverlay(direction, accumulatedSeconds) {
            const el = App.Elements;
            if (!el.seekOverlay.classList.contains('show') || el.seekOverlay.dataset.dir != direction) {
                el.seekOverlay.classList.remove('left', 'right');
                el.seekArrows.className = 'seek-arrows';
                const arrowSvg = direction > 0
                    ? `<svg viewBox="0 0 24 24"><path d="M8 6v12l8.5-6L8 6z"/></svg>`
                    : `<svg viewBox="0 0 24 24"><path d="M16 18V6l-8.5 6 8.5 6z"/></svg>`;
                el.seekArrows.innerHTML = arrowSvg + arrowSvg + arrowSvg;
                if (direction > 0) {
                    el.seekOverlay.classList.add('right');
                    el.seekArrows.classList.add('right');
                } else {
                    el.seekOverlay.classList.add('left');
                    el.seekArrows.classList.add('left');
                }
                el.seekOverlay.classList.add('show');
                el.seekOverlay.dataset.dir = direction;
            }
            const sign = direction > 0 ? '+' : '-';
            el.seekText.textContent = `${sign}${App.Utils.formatSeekDelta(accumulatedSeconds)}`;
        },

        hideSeekOverlay() {
            const el = App.Elements;
            el.seekOverlay.classList.remove('show');
            el.seekOverlay.dataset.dir = '0';
        },

        hideUI() {
            App.Elements.playerContainer.classList.add('hide-ui');
            document.body.classList.add('hide-cursor');
        },

        showUI() {
            App.Elements.playerContainer.classList.remove('hide-ui');
            document.body.classList.remove('hide-cursor');
        },

        resetUIHider(e) {
            const state = App.State;
            const el = App.Elements;

            if (e && e.type === 'mousemove') {
                if (e.clientX === state.lastMouseX && e.clientY === state.lastMouseY) return;
                state.lastMouseX = e.clientX;
                state.lastMouseY = e.clientY;
            }

            App.OSD.showUI();
            clearTimeout(uiTimeout);

            if (!state.isVideoLoaded) return;

            if (!state.isPaused) {
                uiTimeout = setTimeout(() => {
                    const controlsHovered = document.getElementById('controls').matches(':hover');
                    const titleBarHovered = document.getElementById('customTitleBar').matches(':hover');
                    const modalOpen = el.settingsModal.classList.contains('show') ||
                                      el.hotkeysModal.classList.contains('show') ||
                                      el.contextMenu.classList.contains('show') ||
                                      el.playlistPanel.classList.contains('show') ||
                                      el.chaptersPanel.classList.contains('show');

                    if (!state.isDraggingTimeline &&
                        !state.isAccumulatingSeek &&
                        !state.isDraggingVolume &&
                        !el.volumeSlider.matches(':active') &&
                        !modalOpen &&
                        !controlsHovered &&
                        !titleBarHovered) {
                        App.OSD.hideUI();
                    }
                }, 1200);
            }
        }
    };
})();