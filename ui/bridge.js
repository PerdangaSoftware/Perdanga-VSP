(function () {
    let rpcId = 0;
    const rpcResolvers = new Map();
    const eventListeners = {
        'window-maximize-state': [],
        'fullscreen-state': [],
        'load-playlist': [],
        'mpv-event': []
    };

    window.chrome.webview.addEventListener('message', (e) => {
        const data = e.data;
        if (!data) return;

        if (data.type === 'rpc-response') {
            const resolver = rpcResolvers.get(data.id);
            if (resolver) {
                resolver(data.result);
                rpcResolvers.delete(data.id);
            }
        } else if (data.type === 'window-maximize-state') {
            eventListeners['window-maximize-state'].forEach(cb => cb(data.state));
        } else if (data.type === 'fullscreen-state') {
            eventListeners['fullscreen-state'].forEach(cb => cb(data.isFullscreen));
        } else if (data.type === 'load-playlist') {
            eventListeners['load-playlist'].forEach(cb => cb(data));
        } else if (data.type === 'mpv-event') {
            eventListeners['mpv-event'].forEach(cb => cb(data.data));
        }
    });

    function callRpc(type, payload = {}) {
        return new Promise((resolve) => {
            const id = ++rpcId;
            rpcResolvers.set(id, resolve);
            window.chrome.webview.postMessage({ type, id, ...payload });
        });
    }

    window.electronAPI = {
        windowMinimize: () => window.chrome.webview.postMessage({ type: 'window-minimize' }),
        windowMaximize: () => window.chrome.webview.postMessage({ type: 'window-maximize' }),
        windowClose: () => window.chrome.webview.postMessage({ type: 'window-close' }),
        windowDrag: () => window.chrome.webview.postMessage({ type: 'window-drag' }),
        windowResize: (dir) => window.chrome.webview.postMessage({ type: 'window-resize', dir }),
        toggleFullscreen: () => window.chrome.webview.postMessage({ type: 'window-fullscreen' }),
        openFileDialog: () => window.chrome.webview.postMessage({ type: 'open-file-dialog' }),
        openSubDialog: () => window.chrome.webview.postMessage({ type: 'open-sub-dialog' }),
        changeIcon: (icon) => window.chrome.webview.postMessage({ type: 'change-icon', icon }),
        onWindowMaximizeState: (cb) => eventListeners['window-maximize-state'].push(cb),
        onFullscreenState: (cb) => eventListeners['fullscreen-state'].push(cb),
        onLoadPlaylist: (cb) => eventListeners['load-playlist'].push(cb),
        processFiles: (paths) => callRpc('process-files', { paths }),
        processSubFile: (path) => Promise.resolve(path),
        getScreenshotPath: (filename) => callRpc('get-screenshot-path', { filename }),
        getPathForFile: (file) => file.path || file.name
    };

    window.mpvAPI = {
        initialize: () => Promise.resolve(true),
        loadFile: (path) => window.chrome.webview.postMessage({ type: 'mpv-load', path }),
        command: (args) => window.chrome.webview.postMessage({ type: 'mpv-command', args }),
        seek: (time, absolute, exact = true) => window.chrome.webview.postMessage({ type: 'mpv-seek', time, absolute, exact }),
        setProperty: (name, value) => window.chrome.webview.postMessage({ type: 'mpv-set-property', name, value }),
        observeProperty: () => {},
        setRenderSize: () => {},
        requestFrame: () => {},
        onFrameData: () => {},
        onEvent: (cb) => eventListeners['mpv-event'].push(cb)
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