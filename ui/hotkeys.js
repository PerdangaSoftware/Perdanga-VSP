(function () {
    'use strict';

    window.App = window.App || {};

    window.App.handleEscape = function () {
        const api = window.PlayerAPI;
        const appIconDropdown = document.getElementById('appIconDropdown');
        const settingsModal = document.getElementById('settingsModal');
        const hotkeysModal = document.getElementById('hotkeysModal');
        const playlistPanel = document.getElementById('playlistPanel');
        const chaptersPanel = document.getElementById('chaptersPanel');
        const contextMenu = document.getElementById('contextMenu');

        if (appIconDropdown && appIconDropdown.classList.contains('open')) {
            appIconDropdown.classList.remove('open');
            return;
        }
        if (settingsModal && settingsModal.classList.contains('show')) {
            settingsModal.classList.remove('show');
            if (api) api.resetUIHider();
            return;
        }
        if (hotkeysModal && hotkeysModal.classList.contains('show')) {
            hotkeysModal.classList.remove('show');
            if (api) api.resetUIHider();
            return;
        }
        if (playlistPanel && playlistPanel.classList.contains('show')) {
            playlistPanel.classList.remove('show');
            return;
        }
        if (chaptersPanel && chaptersPanel.classList.contains('show')) {
            chaptersPanel.classList.remove('show');
            return;
        }
        if (contextMenu && contextMenu.classList.contains('show')) {
            contextMenu.classList.remove('show');
            return;
        }
        if (document.body.classList.contains('fullscreen')) {
            window.electronAPI.toggleFullscreen();
            return;
        }
        if (window.electronAPI.windowMinimize) {
            window.electronAPI.windowMinimize();
        } else if (window.electronAPI.minimize) {
            window.electronAPI.minimize();
        }
    };

    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        const api = window.PlayerAPI;
        if (!api) return;

        const state = window.App ? window.App.State : null;
        const isArrow = e.code === 'ArrowLeft' || e.code === 'ArrowRight';
        const allowWakeOnArrow = !state || state.arrowSeekTimelineEnabled !== false;
        const isVolumeKey = e.code === 'ArrowUp' || e.code === 'ArrowDown' ||
            e.code === 'Digit0' || e.code === 'Digit9' || e.code === 'KeyM' ||
            ((e.code === 'Equal' || e.code === 'NumpadAdd' || e.code === 'Minus' || e.code === 'NumpadSubtract') && !e.ctrlKey && !e.shiftKey);

        if (e.code !== 'KeyS' && !isVolumeKey) {
            if (!isArrow) {
                api.resetUIHider();
            } else if (allowWakeOnArrow) {
                api.resetUIHider();
            }
        }

        switch (e.code) {
            case 'Escape':
                window.App.handleEscape();
                break;

            case 'Space':
                e.preventDefault();
                api.togglePlay();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                if (e.shiftKey) api.skipPrevChapter();
                else api.accumulateSeek(-5);
                break;
            case 'ArrowRight':
                e.preventDefault();
                if (e.shiftKey) api.skipNextChapter();
                else api.accumulateSeek(5);
                break;
            case 'ArrowUp':
                e.preventDefault();
                api.changeVolume(0.05);
                break;
            case 'ArrowDown':
                e.preventDefault();
                api.changeVolume(-0.05);
                break;
            case 'Comma':
                api.changePlaybackSpeed(-0.05);
                break;
            case 'Period':
                api.changePlaybackSpeed(0.05);
                break;
            case 'PageUp':
                api.playPrevFile();
                break;
            case 'PageDown':
                api.playNextFile(true);
                break;
            case 'KeyL':
                api.togglePlaylist();
                break;
            case 'KeyC':
                api.toggleChapters();
                break;
            case 'KeyS':
                api.takeScreenshot();
                break;
            case 'KeyG':
                api.setSubDelay(api.subDelay - 0.1);
                api.showOSD("SUB DELAY", `${api.subDelay.toFixed(2)}s`);
                break;
            case 'KeyH':
                api.setSubDelay(api.subDelay + 0.1);
                api.showOSD("SUB DELAY", `${api.subDelay.toFixed(2)}s`);
                break;
            case 'Equal':
            case 'NumpadAdd':
                if (e.ctrlKey) {
                    e.preventDefault();
                    let sz = Math.min(5.0, parseFloat(api.subSizeSlider.value) + 0.2);
                    api.subSizeSlider.value = sz;
                    api.saveAndApplySettings();
                    api.showOSD("SUB SIZE", sz.toFixed(1));
                } else if (e.shiftKey) {
                    e.preventDefault();
                    let pos = Math.min(100, parseInt(api.subPosSlider.value) + 2);
                    api.subPosSlider.value = pos;
                    api.saveAndApplySettings();
                    api.showOSD("SUB POSITION", `${pos}%`);
                } else {
                    e.preventDefault();
                    api.changeVolume(0.05);
                }
                break;
            case 'Minus':
            case 'NumpadSubtract':
                if (e.ctrlKey) {
                    e.preventDefault();
                    let sz = Math.max(1.0, parseFloat(api.subSizeSlider.value) - 0.2);
                    api.subSizeSlider.value = sz;
                    api.saveAndApplySettings();
                    api.showOSD("SUB SIZE", sz.toFixed(1));
                } else if (e.shiftKey) {
                    e.preventDefault();
                    let pos = Math.max(5, parseInt(api.subPosSlider.value) - 2);
                    api.subPosSlider.value = pos;
                    api.saveAndApplySettings();
                    api.showOSD("SUB POSITION", `${pos}%`);
                } else {
                    e.preventDefault();
                    api.changeVolume(-0.05);
                }
                break;
            case 'Digit0':
                e.preventDefault();
                api.changeVolume(0.05);
                break;
            case 'Digit9':
                e.preventDefault();
                api.changeVolume(-0.05);
                break;
            case 'KeyM':
                e.preventDefault();
                api.toggleMute();
                break;
        }
    });
})();
