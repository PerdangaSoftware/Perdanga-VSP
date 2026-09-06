window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    const api = window.PlayerAPI;
    if (!api) return;

    api.resetUIHider();

    switch (e.code) {
        // МГНОВЕННЫЙ ЧИСТЫЙ ВЫХОД ИЗ FULLSCREEN ПО ESC
        case 'Escape':
            if (document.body.classList.contains('fullscreen')) {
                window.electronAPI.toggleFullscreen();
            } else if (document.getElementById('settingsModal').classList.contains('show')) {
                document.getElementById('settingsModal').classList.remove('show');
                api.resetUIHider();
            } else if (document.getElementById('hotkeysModal').classList.contains('show')) {
                document.getElementById('hotkeysModal').classList.remove('show');
                api.resetUIHider();
            } else if (document.getElementById('playlistPanel').classList.contains('show')) {
                document.getElementById('playlistPanel').classList.remove('show');
            } else if (document.getElementById('chaptersPanel').classList.contains('show')) {
                document.getElementById('chaptersPanel').classList.remove('show');
            } else if (document.getElementById('contextMenu').classList.contains('show')) {
                document.getElementById('contextMenu').classList.remove('show');
            }
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
            }
            break;
    }
});