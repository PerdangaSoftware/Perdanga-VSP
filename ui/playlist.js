(function () {
    'use strict';

    window.App = window.App || {};

    App.Playlist = {
        init() {
            const el = App.Elements;
            const state = App.State;

            el.playlistBtn.addEventListener('click', (e) => { e.stopPropagation(); App.Playlist.togglePlaylist(); });
            el.closePlaylistBtn.addEventListener('click', () => el.playlistPanel.classList.remove('show'));

            el.chaptersBtn.addEventListener('click', (e) => { e.stopPropagation(); App.Playlist.toggleChapters(); });
            el.closeChaptersBtn.addEventListener('click', () => el.chaptersPanel.classList.remove('show'));

            el.prevBtn.addEventListener('click', App.Playlist.skipPrevChapter);
            el.nextBtn.addEventListener('click', App.Playlist.skipNextChapter);

            el.loopBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                state.loopMode = (state.loopMode + 1) % 3;
                if (state.loopMode === 0) {
                    el.loopBtn.classList.remove('active');
                    el.loopAllIcon.style.display = 'block';
                    el.loopOneIcon.style.display = 'none';
                    el.loopBtn.title = 'Toggle Loop (Off)';
                    App.OSD.show('LOOP', 'Looping Disabled');
                } else if (state.loopMode === 1) {
                    el.loopBtn.classList.add('active');
                    el.loopAllIcon.style.display = 'block';
                    el.loopOneIcon.style.display = 'none';
                    el.loopBtn.title = 'Toggle Loop (Playlist)';
                    App.OSD.show('LOOP', 'Looping Playlist');
                } else if (state.loopMode === 2) {
                    el.loopBtn.classList.add('active');
                    el.loopAllIcon.style.display = 'none';
                    el.loopOneIcon.style.display = 'block';
                    el.loopBtn.title = 'Toggle Loop (Current)';
                    App.OSD.show('LOOP', 'Looping Current File');
                }
            });

            document.addEventListener('click', (e) => {
                if (el.playlistPanel.classList.contains('show') && !el.playlistPanel.contains(e.target) && !el.playlistBtn.contains(e.target)) {
                    el.playlistPanel.classList.remove('show');
                }
                if (el.chaptersPanel.classList.contains('show') && !el.chaptersPanel.contains(e.target) && !el.chaptersBtn.contains(e.target)) {
                    el.chaptersPanel.classList.remove('show');
                }
            });
        },

        updateNavTogglesUI() {
            const el = App.Elements;
            const state = App.State;
            const hasPlaylist = state.playlist.length > 1;
            const hasChapters = state.chaptersEnabled && state.mediaChapters.length > 0;
            el.chaptersBtn.style.display = hasChapters ? 'flex' : 'none';
            el.playlistBtn.style.display = hasPlaylist ? 'flex' : 'none';
            el.navTogglesDivider.style.display = (hasChapters && hasPlaylist) ? 'block' : 'none';
            if (hasChapters || hasPlaylist) {
                el.navTogglesBlock.style.display = 'flex';
                el.navTogglesSeparator.style.display = 'block';
            } else {
                el.navTogglesBlock.style.display = 'none';
                el.navTogglesSeparator.style.display = 'none';
            }
        },

        updatePlaylistUI() {
            if (App.State.playlist.length <= 1) App.Elements.playlistPanel.classList.remove('show');
            App.Playlist.updateNavTogglesUI();
        },

        updateChaptersUI() {
            const el = App.Elements;
            const state = App.State;
            if (state.chaptersEnabled && state.mediaChapters.length > 0) {
                el.prevBtn.style.display = 'flex';
                el.nextBtn.style.display = 'flex';
                el.prevBtn.style.opacity = '1';
                el.prevBtn.style.pointerEvents = 'all';
                el.nextBtn.style.opacity = '1';
                el.nextBtn.style.pointerEvents = 'all';
            } else {
                el.chaptersPanel.classList.remove('show');
                el.prevBtn.style.display = 'flex';
                el.nextBtn.style.display = 'flex';
                el.prevBtn.style.opacity = '0.3';
                el.prevBtn.style.pointerEvents = 'none';
                el.nextBtn.style.opacity = '0.3';
                el.nextBtn.style.pointerEvents = 'none';
            }
            App.Playlist.updateNavTogglesUI();
        },

        render() {
            const el = App.Elements;
            const state = App.State;
            el.playlistItemsContainer.innerHTML = '';
            state.playlist.forEach((p, idx) => {
                const item = document.createElement('div');
                item.className = `panel-item ${idx === state.playlistIndex ? 'active' : ''}`;
                const textSpan = document.createElement('span');
                textSpan.className = 'panel-item-text';
                textSpan.textContent = p.split('\\').pop().split('/').pop();
                item.appendChild(textSpan);
                item.onclick = () => {
                    state.playlistIndex = idx;
                    App.Main.loadMedia(state.playlist[state.playlistIndex]);
                };
                el.playlistItemsContainer.appendChild(item);
            });
        },

        getChapterTitle(chap, idx) {
            if (!chap) return `Chapter ${idx + 1}`;
            return chap.title ? chap.title : `Chapter ${idx + 1}`;
        },

        renderChapters() {
            const el = App.Elements;
            const state = App.State;
            el.chaptersItemsContainer.innerHTML = '';
            state.activeChapterIndex = -1;
            state.mediaChapters.forEach((chap, idx) => {
                const item = document.createElement('div');
                item.className = 'panel-item';
                const title = App.Playlist.getChapterTitle(chap, idx);
                const timeStr = App.Utils.formatTime(parseFloat(chap.time));
                const textSpan = document.createElement('span');
                textSpan.className = 'panel-item-text';

                const timeBadge = document.createElement('span');
                timeBadge.style.opacity = '0.75';
                timeBadge.style.marginRight = '8px';
                timeBadge.style.color = 'var(--accent)';
                timeBadge.style.fontVariantNumeric = 'tabular-nums';
                timeBadge.textContent = `[${timeStr}]`;

                textSpan.appendChild(timeBadge);
                textSpan.appendChild(document.createTextNode(title));
                item.appendChild(textSpan);

                item.onclick = () => {
                    state.seekLockoutUntil = Date.now() + 300;
                    window.mpvAPI.seek(parseFloat(chap.time), true, true);
                    App.OSD.show('CHAPTER', title);
                };
                el.chaptersItemsContainer.appendChild(item);
            });
        },

        updateHighlight() {
            const items = App.Elements.playlistItemsContainer.children;
            for (let i = 0; i < items.length; i++) {
                if (i === App.State.playlistIndex) {
                    items[i].classList.add('active');
                    items[i].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                } else {
                    items[i].classList.remove('active');
                }
            }
        },

        checkChapterHighlight(t) {
            const state = App.State;
            const el = App.Elements;
            if (!state.chaptersEnabled || state.mediaChapters.length === 0) return;
            let currentIdx = -1;
            for (let i = state.mediaChapters.length - 1; i >= 0; i--) {
                if (t >= state.mediaChapters[i].time) {
                    currentIdx = i;
                    break;
                }
            }

            if (currentIdx !== state.activeChapterIndex) {
                state.activeChapterIndex = currentIdx;
                const items = el.chaptersItemsContainer.children;
                for (let i = 0; i < items.length; i++) {
                    if (i === state.activeChapterIndex) {
                        items[i].classList.add('active');
                        if (el.chaptersPanel.classList.contains('show')) {
                            items[i].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }
                    } else {
                        items[i].classList.remove('active');
                    }
                }
            }
        },

        togglePlaylist() {
            const state = App.State;
            const el = App.Elements;
            if (!state.isVideoLoaded || state.playlist.length <= 1) return;
            el.playlistPanel.classList.toggle('show');
            el.chaptersPanel.classList.remove('show');
        },

        toggleChapters() {
            const state = App.State;
            const el = App.Elements;
            if (!state.isVideoLoaded || !state.chaptersEnabled || state.mediaChapters.length === 0) return;
            el.chaptersPanel.classList.toggle('show');
            el.playlistPanel.classList.remove('show');
            if (el.chaptersPanel.classList.contains('show') && state.activeChapterIndex >= 0) {
                el.chaptersItemsContainer.children[state.activeChapterIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        },

        skipNextChapter() {
            const state = App.State;
            if (!state.chaptersEnabled || state.mediaChapters.length === 0) return;
            const targetIdx = state.mediaChapters.findIndex(c => c.time > state.currentTime + 1);
            if (targetIdx !== -1) {
                const targetChapter = state.mediaChapters[targetIdx];
                state.seekLockoutUntil = Date.now() + 300;
                window.mpvAPI.seek(parseFloat(targetChapter.time), true, true);
                App.OSD.show('CHAPTER', App.Playlist.getChapterTitle(targetChapter, targetIdx));
            } else {
                App.Playlist.playNextFile(true);
            }
        },

        skipPrevChapter() {
            const state = App.State;
            if (!state.chaptersEnabled || state.mediaChapters.length === 0) return;
            let targetIdx = -1;
            for (let i = state.mediaChapters.length - 1; i >= 0; i--) {
                if (state.mediaChapters[i].time <= state.currentTime) {
                    if ((state.currentTime - state.mediaChapters[i].time) > 3) {
                        targetIdx = i;
                    } else if (i > 0) {
                        targetIdx = i - 1;
                    }
                    break;
                }
            }

            if (targetIdx !== -1) {
                const targetChapter = state.mediaChapters[targetIdx];
                state.seekLockoutUntil = Date.now() + 300;
                window.mpvAPI.seek(parseFloat(targetChapter.time), true, true);
                App.OSD.show('CHAPTER', App.Playlist.getChapterTitle(targetChapter, targetIdx));
            } else {
                state.seekLockoutUntil = Date.now() + 300;
                window.mpvAPI.seek(0, true, true);
                App.OSD.show('RESTART', 'Restarting File');
            }
        },

        playNextFile(forceSkip = false) {
            const state = App.State;
            if (!forceSkip && state.loopMode === 2) {
                state.seekLockoutUntil = Date.now() + 300;
                window.mpvAPI.seek(0, true, true);
                window.mpvAPI.setProperty('pause', false);
                return;
            }

            if (state.playlistIndex < state.playlist.length - 1) {
                state.playlistIndex++;
                App.Main.loadMedia(state.playlist[state.playlistIndex]);
            } else {
                if (state.loopMode === 1 && state.playlist.length > 0) {
                    state.playlistIndex = 0;
                    App.Main.loadMedia(state.playlist[state.playlistIndex]);
                } else {
                    window.mpvAPI.setProperty('pause', true);
                    App.OSD.show('END', 'End of Playlist');
                }
            }
        },

        playPrevFile() {
            const state = App.State;
            if (state.playlistIndex > 0) {
                state.playlistIndex--;
                App.Main.loadMedia(state.playlist[state.playlistIndex]);
            } else {
                state.seekLockoutUntil = Date.now() + 300;
                window.mpvAPI.seek(0, true, true);
                App.OSD.show('RESTART', 'Restarting File');
            }
        }
    };
})();