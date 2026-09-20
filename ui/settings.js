// ui/settings.js
(function () {
    'use strict';

    window.App = window.App || {};

    App.Settings = {
        init() {
            const el = App.Elements;

            [
                el.appIconSelect,
                el.accentColorPicker,
                el.subSizeSlider,
                el.subPosSlider,
                el.glowToggle,
                el.chaptersToggle,
                el.timelineOpacitySlider,
                el.timelineBlurSlider
            ].forEach(element => {
                element.addEventListener('input', App.Settings.saveAndApply);
            });

            el.settingsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                el.settingsModal.classList.add('show');
            });

            el.closeSettingsBtn.addEventListener('click', () => {
                el.settingsModal.classList.remove('show');
                App.OSD.resetUIHider();
            });

            el.settingsModal.addEventListener('click', (e) => {
                if (e.target === el.settingsModal) {
                    el.settingsModal.classList.remove('show');
                    App.OSD.resetUIHider();
                }
            });

            el.openHotkeysBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                el.settingsModal.classList.remove('show');
                el.hotkeysModal.classList.add('show');
            });

            el.closeHotkeysBtn.addEventListener('click', () => {
                el.hotkeysModal.classList.remove('show');
                App.OSD.resetUIHider();
            });

            el.hotkeysModal.addEventListener('click', (e) => {
                if (e.target === el.hotkeysModal) {
                    el.hotkeysModal.classList.remove('show');
                    App.OSD.resetUIHider();
                }
            });
        },

        apply(s) {
            const el = App.Elements;
            const state = App.State;

            document.documentElement.style.setProperty('--accent', s.accent);
            document.documentElement.style.setProperty('--controls-opacity', s.tlOpacity);
            document.documentElement.style.setProperty('--controls-blur', `${s.tlBlur}px`);

            if (s.glow === false) document.body.classList.add('disable-glow');
            else document.body.classList.remove('disable-glow');

            state.chaptersEnabled = s.chapters !== false;

            const iconPath = s.appIcon || 'ico/GreenOrange.ico';
            el.mainLogo.src = iconPath;
            el.audioLogo.src = iconPath;
            window.electronAPI.changeIcon(iconPath);

            if (state.mpvInitialized) {
                window.mpvAPI.setProperty('sub-scale', parseFloat(s.size));
                window.mpvAPI.setProperty('sub-pos', parseFloat(s.pos));
            }

            App.Timeline.updateProgressBarFill(parseFloat(el.progressBar.value));
            App.Tracks.updateVolumeUI();

            if (state.isVideoLoaded) {
                App.Playlist.updateChaptersUI();
                App.Timeline.renderMarkers();
            }
        },

        load() {
            const el = App.Elements;
            const saved = JSON.parse(localStorage.getItem('perdangaSettings')) || {};
            const defaults = {
                accent: '#c4c9b6',
                size: '1.0',
                pos: '100',
                glow: false,
                appIcon: 'ico/GreenOrange.ico',
                chapters: true,
                tlOpacity: '0.85',
                tlBlur: '24'
            };
            const s = { ...defaults, ...saved };

            el.appIconSelect.value = s.appIcon;
            el.accentColorPicker.value = s.accent;
            el.subSizeSlider.value = s.size;
            el.subPosSlider.value = s.pos;
            el.glowToggle.checked = s.glow;
            el.chaptersToggle.checked = s.chapters;
            el.timelineOpacitySlider.value = s.tlOpacity;
            el.timelineBlurSlider.value = s.tlBlur;

            App.Settings.apply(s);
        },

        saveAndApply() {
            const el = App.Elements;
            const s = {
                appIcon: el.appIconSelect.value,
                accent: el.accentColorPicker.value,
                size: el.subSizeSlider.value,
                pos: el.subPosSlider.value,
                glow: el.glowToggle.checked,
                chapters: el.chaptersToggle.checked,
                tlOpacity: el.timelineOpacitySlider.value,
                tlBlur: el.timelineBlurSlider.value
            };
            localStorage.setItem('perdangaSettings', JSON.stringify(s));
            App.Settings.apply(s);
        }
    };
})();