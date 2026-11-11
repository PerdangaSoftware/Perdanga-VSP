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
                el.chaptersToggle,
                el.arrowSeekTimelineToggle,
                el.timelineOpacitySlider,
                el.timelineBlurSlider
            ].forEach(element => {
                if (element) {
                    element.addEventListener('input', App.Settings.saveAndApply);
                }
            });

            if (el.appIconTrigger && el.appIconDropdown) {
                el.appIconTrigger.addEventListener('click', (e) => {
                    e.stopPropagation();
                    el.appIconDropdown.classList.toggle('open');
                });
            }

            if (el.appIconMenu) {
                el.appIconMenu.addEventListener('click', (e) => {
                    const opt = e.target.closest('.custom-select-option');
                    if (opt && opt.dataset.value) {
                        App.Settings.setAppIcon(opt.dataset.value, opt.textContent);
                        if (el.appIconDropdown) el.appIconDropdown.classList.remove('open');
                    }
                });
            }

            document.addEventListener('click', (e) => {
                if (el.appIconDropdown && !el.appIconDropdown.contains(e.target)) {
                    el.appIconDropdown.classList.remove('open');
                }
            });

            el.settingsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                el.settingsModal.classList.add('show');
            });

            el.closeSettingsBtn.addEventListener('click', () => {
                el.settingsModal.classList.remove('show');
                if (el.appIconDropdown) el.appIconDropdown.classList.remove('open');
                App.OSD.resetUIHider();
            });

            el.settingsModal.addEventListener('click', (e) => {
                if (e.target === el.settingsModal) {
                    el.settingsModal.classList.remove('show');
                    if (el.appIconDropdown) el.appIconDropdown.classList.remove('open');
                    App.OSD.resetUIHider();
                }
            });

            el.openHotkeysBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                el.settingsModal.classList.remove('show');
                if (el.appIconDropdown) el.appIconDropdown.classList.remove('open');
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

            if (el.accentPalette) {
                el.accentPalette.addEventListener('click', (e) => {
                    const swatch = e.target.closest('.accent-swatch');
                    if (swatch && swatch.dataset.color) {
                        App.Settings.setAccentColor(swatch.dataset.color);
                    }
                });
            }

            if (el.accentHexInput) {
                const handleHexCommit = () => {
                    let val = el.accentHexInput.value.trim();
                    if (!val.startsWith('#')) val = '#' + val;
                    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
                        App.Settings.setAccentColor(val.toLowerCase());
                    } else {
                        el.accentHexInput.value = el.accentColorPicker.value;
                    }
                };

                el.accentHexInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        handleHexCommit();
                        el.accentHexInput.blur();
                    }
                });
                el.accentHexInput.addEventListener('blur', handleHexCommit);
            }

            if (el.btnPickColor) {
                el.btnPickColor.addEventListener('click', async () => {
                    const current = el.accentColorPicker.value || '#a5b087';
                    if (window.electronAPI && window.electronAPI.pickColor) {
                        const picked = await window.electronAPI.pickColor(current);
                        if (picked && /^#[0-9a-fA-F]{6}$/i.test(picked)) {
                            App.Settings.setAccentColor(picked.toLowerCase());
                        }
                    }
                });
            }
        },

        getIconLabel(val) {
            const map = {
                'ico/GreenOrange.ico': 'Green Orange (Default)',
                'ico/Dark_Turquoise.ico': 'Dark Turquoise',
                'ico/perdangavsp.ico': 'Classic (Orange)',
                'ico/perdangavspblack.ico': 'Black'
            };
            return map[val] || 'Green Orange (Default)';
        },

        setAppIcon(val, label) {
            const el = App.Elements;
            if (el.appIconSelect) el.appIconSelect.value = val;
            if (el.appIconLabel) el.appIconLabel.textContent = label || App.Settings.getIconLabel(val);
            if (el.appIconMenu) {
                el.appIconMenu.querySelectorAll('.custom-select-option').forEach(opt => {
                    if (opt.dataset.value === val) opt.classList.add('selected');
                    else opt.classList.remove('selected');
                });
            }
            App.Settings.saveAndApply();
        },

        setAccentColor(color) {
            const el = App.Elements;
            const norm = color.toLowerCase();
            if (el.accentColorPicker) el.accentColorPicker.value = norm;
            if (el.accentHexInput && document.activeElement !== el.accentHexInput) {
                el.accentHexInput.value = norm;
            }
            if (el.accentPreview) {
                el.accentPreview.style.backgroundColor = norm;
            }

            if (el.accentPalette) {
                el.accentPalette.querySelectorAll('.accent-swatch').forEach(sw => {
                    if (sw.dataset.color && sw.dataset.color.toLowerCase() === norm) {
                        sw.classList.add('active');
                    } else {
                        sw.classList.remove('active');
                    }
                });
            }

            App.Settings.saveAndApply();
        },

        apply(s) {
            const el = App.Elements;
            const state = App.State;

            const accent = (s.accent || '#a5b087').toLowerCase();
            document.documentElement.style.setProperty('--accent', accent);
            if (el.accentHexInput && document.activeElement !== el.accentHexInput) {
                el.accentHexInput.value = accent;
            }
            if (el.accentPreview) {
                el.accentPreview.style.backgroundColor = accent;
            }
            if (el.accentPalette) {
                el.accentPalette.querySelectorAll('.accent-swatch').forEach(sw => {
                    if (sw.dataset.color && sw.dataset.color.toLowerCase() === accent) {
                        sw.classList.add('active');
                    } else {
                        sw.classList.remove('active');
                    }
                });
            }

            document.documentElement.style.setProperty('--controls-opacity', s.tlOpacity);
            document.documentElement.style.setProperty('--controls-blur', `${s.tlBlur}px`);

            state.chaptersEnabled = s.chapters !== false;
            state.arrowSeekTimelineEnabled = s.arrowSeekTimeline !== false;

            const iconPath = s.appIcon || 'ico/GreenOrange.ico';
            const pngPath = iconPath.replace(/\.ico$/i, '.png');
            if (el.mainLogo) {
                el.mainLogo.src = pngPath;
                el.mainLogo.onerror = () => { el.mainLogo.src = iconPath; };
            }
            if (el.audioLogo) {
                el.audioLogo.src = pngPath;
                el.audioLogo.onerror = () => { el.audioLogo.src = iconPath; };
            }
            window.electronAPI.changeIcon(iconPath);

            if (el.appIconSelect) el.appIconSelect.value = iconPath;
            if (el.appIconLabel) el.appIconLabel.textContent = App.Settings.getIconLabel(iconPath);
            if (el.appIconMenu) {
                el.appIconMenu.querySelectorAll('.custom-select-option').forEach(opt => {
                    if (opt.dataset.value === iconPath) opt.classList.add('selected');
                    else opt.classList.remove('selected');
                });
            }

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
                accent: '#a5b087',
                size: '1.0',
                pos: '100',
                appIcon: 'ico/GreenOrange.ico',
                chapters: true,
                arrowSeekTimeline: true,
                tlOpacity: '0.85',
                tlBlur: '24'
            };
            const s = { ...defaults, ...saved };

            if (el.appIconSelect) el.appIconSelect.value = s.appIcon;
            if (el.appIconLabel) el.appIconLabel.textContent = App.Settings.getIconLabel(s.appIcon);
            if (el.appIconMenu) {
                el.appIconMenu.querySelectorAll('.custom-select-option').forEach(opt => {
                    if (opt.dataset.value === s.appIcon) opt.classList.add('selected');
                    else opt.classList.remove('selected');
                });
            }

            el.accentColorPicker.value = s.accent;
            if (el.accentHexInput) el.accentHexInput.value = s.accent;
            if (el.accentPreview) el.accentPreview.style.backgroundColor = s.accent;
            el.subSizeSlider.value = s.size;
            el.subPosSlider.value = s.pos;
            el.chaptersToggle.checked = s.chapters;
            if (el.arrowSeekTimelineToggle) {
                el.arrowSeekTimelineToggle.checked = s.arrowSeekTimeline;
            }
            el.timelineOpacitySlider.value = s.tlOpacity;
            el.timelineBlurSlider.value = s.tlBlur;

            App.Settings.apply(s);
        },

        saveAndApply() {
            const el = App.Elements;
            const s = {
                appIcon: el.appIconSelect ? el.appIconSelect.value : 'ico/GreenOrange.ico',
                accent: el.accentColorPicker.value,
                size: el.subSizeSlider.value,
                pos: el.subPosSlider.value,
                chapters: el.chaptersToggle.checked,
                arrowSeekTimeline: el.arrowSeekTimelineToggle ? el.arrowSeekTimelineToggle.checked : true,
                tlOpacity: el.timelineOpacitySlider.value,
                tlBlur: el.timelineBlurSlider.value
            };
            localStorage.setItem('perdangaSettings', JSON.stringify(s));
            App.Settings.apply(s);
        }
    };
})();
