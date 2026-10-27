(function () {
    'use strict';

    window.App = window.App || {};

    let audioWheelTimeout = null;
    let subWheelTimeout = null;

    App.Tracks = {
        init() {
            const el = App.Elements;
            const state = App.State;

            el.audioSwitchBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (state.audioStreams.length <= 1) return App.OSD.show('INFO', 'No alternative audio available');
                App.Tracks.cycleAudio(1);
            });

            el.subSwitchBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                App.Tracks.cycleSub(1);
            });

            el.audioSwitchWrap.addEventListener('wheel', (e) => {
                e.preventDefault();
                if (state.audioStreams.length <= 1 || audioWheelTimeout) return;
                audioWheelTimeout = setTimeout(() => { audioWheelTimeout = null; }, 150);
                App.Tracks.cycleAudio(e.deltaY > 0 ? 1 : -1);
            }, { passive: false });

            el.subSwitchWrap.addEventListener('wheel', (e) => {
                e.preventDefault();
                if (subWheelTimeout) return;
                subWheelTimeout = setTimeout(() => { subWheelTimeout = null; }, 150);
                App.Tracks.cycleSub(e.deltaY > 0 ? 1 : -1);
            }, { passive: false });

            el.volumeWrap.addEventListener('wheel', (e) => {
                e.preventDefault();
                let curVol = (state.currentVolume !== undefined && state.currentVolume !== null) ? state.currentVolume : 1.0;
                let vol = curVol + (e.deltaY < 0 ? 0.05 : -0.05);
                vol = Math.max(0, Math.min(1.5, Math.round(vol * 100) / 100));
                state.currentVolume = vol;
                if (vol > 0) state.lastVolume = vol;
                window.mpvAPI.setProperty('volume', vol * 100);
                App.Tracks.updateVolumeUI();
                App.OSD.showVolumeBar(vol);
            }, { passive: false });

            el.muteBtn.addEventListener('click', () => {
                let curVol = (state.currentVolume !== undefined && state.currentVolume !== null) ? state.currentVolume : 1.0;
                if (curVol > 0) {
                    state.lastVolume = curVol;
                    state.currentVolume = 0;
                } else {
                    state.currentVolume = state.lastVolume || 1.0;
                }
                const newVol = state.currentVolume;
                window.mpvAPI.setProperty('volume', newVol * 100);
                App.Tracks.updateVolumeUI();
                App.OSD.showVolumeBar(newVol, newVol === 0);
            });

            el.speedWrap.addEventListener('wheel', (e) => {
                e.preventDefault();
                const step = e.shiftKey ? 0.25 : 0.05;
                App.Tracks.updatePlaybackSpeed(state.userPlaybackRate + (e.deltaY < 0 ? step : -step));
            }, { passive: false });

            el.speedBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                App.Tracks.updatePlaybackSpeed(1.0);
            });

            window.addEventListener('contextmenu', App.Tracks.openContextMenu);
            el.contextMenu.addEventListener('wheel', (e) => e.stopPropagation());
            document.addEventListener('click', (e) => {
                if (!el.contextMenu.contains(e.target)) el.contextMenu.classList.remove('show');
            });
        },

        updateVolumeUI() {
            const el = App.Elements;
            const state = App.State;
            const realVol = (state.currentVolume !== undefined && state.currentVolume !== null) ? state.currentVolume : 1.0;
            if (realVol === 0) {
                el.volUpIcon.style.display = 'none';
                el.volMuteIcon.style.display = 'block';
            } else {
                el.volUpIcon.style.display = 'block';
                el.volMuteIcon.style.display = 'none';
            }
            if (el.volBoostBadge) {
                if (realVol > 1.0) {
                    el.volBoostBadge.textContent = `${Math.round(realVol * 100)}%`;
                    el.volBoostBadge.style.display = 'inline-block';
                } else {
                    el.volBoostBadge.style.display = 'none';
                }
            }
        },

        updatePlaybackSpeed(rate) {
            const state = App.State;
            state.userPlaybackRate = Math.max(0.25, Math.min(4.0, rate));
            const formatted = state.userPlaybackRate.toFixed(2).replace(/\.00$/, '.0') + 'x';
            App.Elements.speedLabel.textContent = formatted;
            if (state.mpvInitialized) {
                window.mpvAPI.setProperty('speed', state.userPlaybackRate);
            }
            App.OSD.show('SPEED', formatted);
        },

        getDetailedTrackLabel(track) {
            let titleStr = track.title;
            if ((!titleStr || (track.codec && titleStr.toLowerCase() === track.codec.toLowerCase())) && track['external-filename']) {
                const raw = track['external-filename'];
                const slashIdx = Math.max(raw.lastIndexOf('/'), raw.lastIndexOf('\\'));
                const rawName = slashIdx >= 0 ? raw.substring(slashIdx + 1) : raw;
                const lastDot = rawName.lastIndexOf('.');
                titleStr = lastDot > 0 ? rawName.substring(0, lastDot) : rawName;
            }
            if (!titleStr) {
                titleStr = `${track.type === 'audio' ? 'Audio' : 'Subtitle'} Track ${track.id}`;
            }
            const lang = (track.lang && track.lang !== 'und') ? track.lang.toUpperCase() : '';
            const mainLabel = lang ? `${lang} - ${titleStr}` : titleStr;

            const codec = track.codec ? track.codec.toUpperCase() : '';
            const extra = [];
            if (track.external) {
                extra.push('External');
            }
            if (track.type === 'audio') {
                if (track['demux-channel-count'] === 1) extra.push('Mono');
                else if (track['demux-channel-count'] === 2) extra.push('Stereo');
                else if (track['demux-channel-count'] === 6) extra.push('5.1 Surround');
                else if (track['demux-channel-count'] === 8) extra.push('7.1 Surround');
                else if (track['demux-channel-count']) extra.push(`${track['demux-channel-count']} Ch`);

                if (track['demux-samplerate']) extra.push(`${Math.round(track['demux-samplerate'] / 1000)}kHz`);
            }
            return { mainLabel, subLabel: [codec, ...extra].filter(Boolean).join(' • ') };
        },

        updateTrackCounters() {
            const el = App.Elements;
            const state = App.State;
            el.audioTrackCount.textContent = state.audioStreams.length > 0
                ? `${state.audioStreams.findIndex(t => t.id === state.currentAudioTrack) + 1}/${state.audioStreams.length}`
                : '0/0';

            if (state.currentSubTrack === 'off') {
                el.subTrackCount.textContent = 'Off';
            } else {
                const idx = state.subStreams.findIndex(t => t.id === state.currentSubTrack);
                el.subTrackCount.textContent = idx >= 0
                    ? `${idx + 1}/${state.subStreams.length}`
                    : (state.subStreams.length > 0 ? `1/${state.subStreams.length}` : 'Off');
            }
        },

        setAudioTrack(trackId) {
            if (App.State.isAudioMode) return;
            App.State.currentAudioTrack = trackId;
            window.mpvAPI.setProperty('aid', trackId);
            App.Tracks.updateTrackCounters();
        },

        setSubtitle(trackId) {
            const state = App.State;
            state.currentSubTrack = trackId;
            if (trackId === 'off') {
                window.mpvAPI.setProperty('sid', 'no');
            } else {
                window.mpvAPI.setProperty('sub-visibility', 'yes');
                window.mpvAPI.setProperty('sid', trackId);
            }
            App.Tracks.updateTrackCounters();
        },

        cycleAudio(direction) {
            const state = App.State;
            if (state.audioStreams.length === 0 || state.isAudioMode) return;
            const currentIdx = state.audioStreams.findIndex(t => t.id === state.currentAudioTrack);
            const nextIdx = (currentIdx + direction + state.audioStreams.length) % state.audioStreams.length;
            const nextTrack = state.audioStreams[nextIdx];
            App.Tracks.setAudioTrack(nextTrack.id);
            const details = App.Tracks.getDetailedTrackLabel(nextTrack);
            App.OSD.show('AUDIO TRACK', details.mainLabel, details.subLabel);
        },

        cycleSub(direction) {
            const state = App.State;
            if (state.isAudioMode) return;
            const subOptions = [{ id: 'off', main: 'Subtitles Off', sub: '' }];
            state.subStreams.forEach(s => {
                const details = App.Tracks.getDetailedTrackLabel(s);
                subOptions.push({ id: s.id, main: details.mainLabel, sub: details.subLabel });
            });

            if (subOptions.length <= 1) return App.OSD.show('INFO', 'No subtitle tracks available');
            const currentIdx = subOptions.findIndex(o => o.id == state.currentSubTrack);
            const nextIdx = (currentIdx + direction + subOptions.length) % subOptions.length;
            const nextOpt = subOptions[nextIdx];

            App.Tracks.setSubtitle(nextOpt.id);
            App.OSD.show('SUBTITLE', nextOpt.main, nextOpt.sub);
        },

        loadExternalSubtitle(filePath) {
            if (!filePath) return;
            const fileName = App.Utils.getFileName(filePath);
            const lastDot = fileName.lastIndexOf('.');
            const cleanTitle = lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
            window.mpvAPI.setProperty('sub-visibility', 'yes');
            window.mpvAPI.command(['sub-add', filePath, 'select', cleanTitle]);
            App.OSD.show('EXTERNAL SUBTITLE', cleanTitle);
        },

        loadExternalAudio(filePath) {
            if (!filePath) return;
            const fileName = App.Utils.getFileName(filePath);
            const lastDot = fileName.lastIndexOf('.');
            const cleanTitle = lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
            window.mpvAPI.command(['audio-add', filePath, 'select', cleanTitle]);
            App.OSD.show('EXTERNAL AUDIO', cleanTitle);
        },

        openContextMenu(e) {
            e.preventDefault();
            const state = App.State;
            const el = App.Elements;
            if (!state.currentFilePath || state.isAudioMode) return;

            el.contextAudioList.innerHTML = '';
            el.contextSubList.innerHTML = '';

            if (state.audioStreams.length === 0) {
                el.contextAudioList.innerHTML = `<div class="ctx-item"><span class="ctx-sub">No Audio Tracks</span></div>`;
            } else {
                state.audioStreams.forEach((s) => {
                    const details = App.Tracks.getDetailedTrackLabel(s);
                    const item = document.createElement('div');
                    item.className = `ctx-item ${state.currentAudioTrack == s.id ? 'active' : ''}`;
                    item.innerHTML = `<span class="ctx-main">${App.Utils.escapeHTML(details.mainLabel)}</span><span class="ctx-sub">${App.Utils.escapeHTML(details.subLabel)}</span>`;
                    item.onclick = () => {
                        App.Tracks.setAudioTrack(s.id);
                        App.OSD.show('AUDIO', details.mainLabel);
                        el.contextMenu.classList.remove('show');
                        App.OSD.resetUIHider();
                    };
                    el.contextAudioList.appendChild(item);
                });
            }

            const offItem = document.createElement('div');
            offItem.className = `ctx-item ${state.currentSubTrack === 'off' ? 'active' : ''}`;
            offItem.innerHTML = `<span class="ctx-main">Disabled</span><span class="ctx-sub">Turn off subtitles</span>`;
            offItem.onclick = () => {
                App.Tracks.setSubtitle('off');
                App.OSD.show('SUBTITLE', 'Subtitles Off');
                el.contextMenu.classList.remove('show');
                App.OSD.resetUIHider();
            };
            el.contextSubList.appendChild(offItem);

            state.subStreams.forEach((s) => {
                const details = App.Tracks.getDetailedTrackLabel(s);
                const item = document.createElement('div');
                item.className = `ctx-item ${state.currentSubTrack == s.id ? 'active' : ''}`;
                item.innerHTML = `<span class="ctx-main">${App.Utils.escapeHTML(details.mainLabel)}</span><span class="ctx-sub">${App.Utils.escapeHTML(details.subLabel)}</span>`;
                item.onclick = () => {
                    App.Tracks.setSubtitle(s.id);
                    App.OSD.show('SUBTITLE', details.mainLabel);
                    el.contextMenu.classList.remove('show');
                    App.OSD.resetUIHider();
                };
                el.contextSubList.appendChild(item);
            });

            el.contextMenu.classList.add('show');
            let x = e.pageX;
            let y = e.pageY;
            const rect = el.contextMenu.getBoundingClientRect();
            if (x + rect.width > window.innerWidth) x = Math.max(0, window.innerWidth - rect.width - 10);
            if (y + rect.height > window.innerHeight) y = Math.max(0, window.innerHeight - rect.height - 10);
            el.contextMenu.style.left = `${x}px`;
            el.contextMenu.style.top = `${y}px`;
        }
    };
})();