(function () {
    'use strict';

    const RPC_TIMEOUT_MS = 15000;
    let rpcId = 0;
    const rpcResolvers = new Map();

    const eventListeners = {
        'window-maximize-state': [],
        'fullscreen-state': [],
        'load-playlist': [],
        'mpv-event': [],
        'thumbnail-ready': []
    };

    let host = (window.chrome && window.chrome.webview) ? window.chrome.webview : null;

    if (!host && window.app && typeof window.app.postMessage === 'function') {
        host = {
            postMessage: function (msg) {
                const str = typeof msg === 'string' ? msg : JSON.stringify(msg);
                window.app.postMessage(str);
            },
            addEventListener: function (type, cb) {
                window.__nativeMessageListeners = window.__nativeMessageListeners || [];
                window.__nativeMessageListeners.push(cb);
            }
        };
    }

    function dispatchPayload(data) {
        if (!data) return;
        if (data.type === 'rpc-response') {
            const resolver = rpcResolvers.get(data.id);
            if (resolver) {
                rpcResolvers.delete(data.id);
                resolver(data.result);
            }
        } else if (data.type === 'window-maximize-state') {
            eventListeners['window-maximize-state'].forEach(cb => cb(data.state));
        } else if (data.type === 'fullscreen-state') {
            eventListeners['fullscreen-state'].forEach(cb => cb(data.isFullscreen));
        } else if (data.type === 'load-playlist') {
            eventListeners['load-playlist'].forEach(cb => cb(data));
        } else if (data.type === 'mpv-event') {
            eventListeners['mpv-event'].forEach(cb => cb(data.data));
        } else if (data.type === 'thumbnail-ready') {
            eventListeners['thumbnail-ready'].forEach(cb => cb(data));
        } else if (data.type === 'escape-pressed') {
            if (window.App && typeof window.App.handleEscape === 'function') {
                window.App.handleEscape();
            }
        }
    }

    window.__dispatchNativeMessage = function (data) {
        let parsed = data;
        if (typeof data === 'string') {
            try {
                parsed = JSON.parse(data);
            } catch (err) {
                parsed = null;
            }
        }
        dispatchPayload(parsed);
        if (window.__nativeMessageListeners) {
            window.__nativeMessageListeners.forEach(cb => cb({ data: parsed }));
        }
    };

    function postToHost(message) {
        if (!host && window.app && typeof window.app.postMessage === 'function') {
            const str = typeof message === 'string' ? message : JSON.stringify(message);
            window.app.postMessage(str);
            return;
        }
        if (host) host.postMessage(message);
    }

    if (host && host.addEventListener) {
        host.addEventListener('message', (e) => {
            dispatchPayload(e.data);
        });
    }

    function callRpc(type, payload = {}) {
        return new Promise((resolve) => {
            if (!host && (!window.app || typeof window.app.postMessage !== 'function')) {
                resolve(null);
                return;
            }
            const id = ++rpcId;
            const timer = setTimeout(() => {
                if (rpcResolvers.has(id)) {
                    rpcResolvers.delete(id);
                    resolve(null);
                }
            }, RPC_TIMEOUT_MS);
            rpcResolvers.set(id, (result) => {
                clearTimeout(timer);
                resolve(result);
            });
            postToHost({ type, id, ...payload });
        });
    }

    window.electronAPI = {
        appReady: () => postToHost({ type: 'app-ready' }),
        windowMinimize: () => postToHost({ type: 'window-minimize' }),
        minimize: () => postToHost({ type: 'window-minimize' }),
        windowMaximize: () => postToHost({ type: 'window-maximize' }),
        windowClose: () => postToHost({ type: 'window-close' }),
        windowDrag: () => postToHost({ type: 'window-drag' }),
        windowResize: (dir) => postToHost({ type: 'window-resize', dir }),
        toggleFullscreen: () => postToHost({ type: 'window-fullscreen' }),
        openFileDialog: () => postToHost({ type: 'open-file-dialog' }),
        openSubDialog: () => postToHost({ type: 'open-sub-dialog' }),
        openAudioDialog: () => postToHost({ type: 'open-audio-dialog' }),
        changeIcon: (icon) => postToHost({ type: 'change-icon', icon }),
        onWindowMaximizeState: (cb) => eventListeners['window-maximize-state'].push(cb),
        onFullscreenState: (cb) => eventListeners['fullscreen-state'].push(cb),
        onLoadPlaylist: (cb) => eventListeners['load-playlist'].push(cb),
        processFiles: (paths) => callRpc('process-files', { paths }),
        processSubFile: (path) => Promise.resolve(path),
        getScreenshotPath: (filename) => callRpc('get-screenshot-path', { filename }),
        getPathForFile: (file) => file.path || file.name,
        setCursorHidden: (hidden) => postToHost({ type: 'set-cursor-hidden', hidden }),
        pickColor: (currentColor) => callRpc('open-color-dialog', { currentColor })
    };

    window.mpvAPI = {
        initialize: () => Promise.resolve(true),
        loadFile: (path) => postToHost({ type: 'mpv-load', path }),
        command: (args) => postToHost({ type: 'mpv-command', args }),
        seek: (time, absolute, exact = true) => postToHost({ type: 'mpv-seek', time, absolute, exact }),
        requestThumbnail: (time, exact = false, reqId = 0) => postToHost({ type: 'request-thumbnail', time, exact, reqId }),
        setProperty: (name, value) => postToHost({ type: 'mpv-set-property', name, value }),
        observeProperty: () => {},
        setRenderSize: () => {},
        requestFrame: () => {},
        onFrameData: () => {},
        onEvent: (cb) => eventListeners['mpv-event'].push(cb),
        onThumbnailReady: (cb) => eventListeners['thumbnail-ready'].push(cb)
    };

    function setupInteractions() {
        const titleBar = document.getElementById('customTitleBar');
        if (titleBar) {
            titleBar.addEventListener('mousedown', (e) => {
                if (!e.target.closest('.title-btn') && e.button === 0) {
                    window.electronAPI.windowDrag();
                }
            });
        }

        document.querySelectorAll('.resize-edge, .resize-corner').forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                if (e.button === 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    window.electronAPI.windowResize(handle.dataset.dir);
                }
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupInteractions);
    } else {
        setupInteractions();
    }
})();
