// ui/utils.js
(function () {
    'use strict';

    window.App = window.App || {};

    App.Utils = {
        escapeHTML(str) {
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        },

        formatTime(secs) {
            if (isNaN(secs) || secs < 0) return '00:00';
            const h = Math.floor(secs / 3600);
            const m = Math.floor((secs % 3600) / 60);
            const s = Math.floor(secs % 60);
            return h > 0
                ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
                : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        },

        formatDetailedTime(secs) {
            if (isNaN(secs) || secs < 0) return '00:00:00.000';
            const h = Math.floor(secs / 3600);
            const m = Math.floor((secs % 3600) / 60);
            const s = Math.floor(secs % 60);
            const ms = Math.floor((secs % 1) * 1000);
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
        },

        formatSeekDelta(seconds) {
            const absSecs = Math.round(Math.abs(seconds));
            const h = Math.floor(absSecs / 3600);
            const m = Math.floor((absSecs % 3600) / 60);
            const s = absSecs % 60;
            const parts = [];
            if (h > 0) parts.push(`${h}h`);
            if (m > 0) parts.push(`${m}m`);
            if (s > 0 || parts.length === 0) parts.push(`${s}s`);
            return parts.join(' ');
        },

        isChromiumSupportedVideo(codecName, filePath) {
            if (!codecName) {
                if (!filePath) return false;
                const ext = filePath.split('.').pop().toLowerCase();
                return ['mp4', 'm4v', 'webm'].includes(ext);
            }
            const c = codecName.toLowerCase();
            return (c === 'h264' || c === 'vp8' || c === 'vp9' || c === 'av1');
        },

        pathToLocalFileUrl(path) {
            if (!path) return '';
            const normalized = path.replace(/\\/g, '/');
            const parts = normalized.split('/').map((part) => {
                if (part.endsWith(':')) return part;
                return encodeURIComponent(part);
            });
            return 'file:///' + parts.join('/').replace(/^\/+/, '');
        },

        saveProgress(time) {
            const state = App.State;
            const now = Date.now();
            if (state.currentFilePath && time > 1 && now - state.lastSaveTime > 4000) {
                if (!state.progressCache) {
                    state.progressCache = JSON.parse(localStorage.getItem('perdangaProgress')) || {};
                }
                state.progressCache[state.currentFilePath] = time;
                const keys = Object.keys(state.progressCache);
                if (keys.length > 30) delete state.progressCache[keys[0]];
                localStorage.setItem('perdangaProgress', JSON.stringify(state.progressCache));
                state.lastSaveTime = now;
            }
        },

        clearProgress() {
            const state = App.State;
            if (!state.progressCache) {
                state.progressCache = JSON.parse(localStorage.getItem('perdangaProgress')) || {};
            }
            delete state.progressCache[state.currentFilePath];
            localStorage.setItem('perdangaProgress', JSON.stringify(state.progressCache));
        },

        async takeScreenshot() {
            const state = App.State;
            if (!state.isVideoLoaded || state.isAudioMode) {
                App.OSD.show('SCREENSHOT', 'Video required for screenshot');
                return;
            }
            try {
                const baseName = state.currentFilePath
                    ? state.currentFilePath.split('\\').pop().split('/').pop().replace(/\.[^/.]+$/, '')
                    : 'screenshot';
                const timeStr = App.Utils.formatDetailedTime(state.currentTime).replace(/:/g, '-').replace('.', '-');
                const filename = `${baseName}_${timeStr}.png`;
                const screenshotPath = await window.electronAPI.getScreenshotPath(filename);
                if (!screenshotPath) {
                    App.OSD.show('SCREENSHOT ERROR', 'Failed to resolve save path');
                    return;
                }
                window.mpvAPI.command(['screenshot-to-file', screenshotPath, 'video']);
                App.OSD.show('SCREENSHOT', 'Saved to Pictures/Perdanga VSP');
            } catch (err) {
                console.error(err);
                App.OSD.show('SCREENSHOT ERROR', 'Failed to capture frame');
            }
        }
    };
})();