#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <windowsx.h>
#include <commdlg.h>
#include <shellapi.h>
#include <shlwapi.h>
#include <shobjidl.h>
#include <ole2.h>
#include <dwmapi.h>
#include <wrl/client.h>
#include <wrl/event.h>
#include <WebView2.h>
#include <WebView2EnvironmentOptions.h>

#include "mpv_player.h"
#include "utils.h"
#include <memory>
#include <vector>
#include <string>
#include <algorithm>
#include <filesystem>

#pragma comment(lib, "dwmapi.lib")
#pragma comment(lib, "shlwapi.lib")
#pragma comment(lib, "comdlg32.lib")
#pragma comment(lib, "shell32.lib")
#pragma comment(lib, "ole32.lib")

using Microsoft::WRL::ComPtr;
using Microsoft::WRL::Callback;

#define WM_MPV_ASYNC_EVENT (WM_USER + 101)

static const wchar_t* WINDOW_CLASS_NAME = L"PerdangaVSP_HostWindow";
static HWND g_hMainWnd = NULL;
static ComPtr<ICoreWebView2Controller> g_webViewController;
static ComPtr<ICoreWebView2> g_webView;
static std::unique_ptr<MpvPlayer> g_mpv;

static bool g_isMaximized = false;
static bool g_isFullscreen = false;
static RECT g_normalRect = { 0, 0, 1024, 576 }; // Надежное хранение компактного размера окна

static std::wstring g_pendingInitialArg;
static bool g_isAppReady = false;

void SendWebMessage(const std::string& jsonMsg) {
    if (g_webView) {
        std::wstring wmsg = Utils::Utf8ToUtf16(jsonMsg);
        g_webView->PostWebMessageAsJson(wmsg.c_str());
    }
}

void ResizeViews(int width, int height) {
    if (g_webViewController) {
        RECT bounds = { 0, 0, width, height };
        g_webViewController->put_Bounds(bounds);
    }
}

void DispatchInitialFile(const std::wstring& path) {
    std::wstring clean = Utils::CleanPath(path);
    if (clean.empty()) return;

    auto res = Utils::BuildPlaylistData({ clean });
    if (res.playlist.empty()) return;

    std::string json = "{\"type\":\"load-playlist\",\"playlist\":[";
    for (size_t i = 0; i < res.playlist.size(); ++i) {
        if (i > 0) json += ",";
        json += "\"" + Utils::EscapeJson(res.playlist[i]) + "\"";
    }
    json += "],\"playlistIndex\":" + std::to_string(res.playlistIndex);
    if (!res.subPath.empty()) {
        json += ",\"subPath\":\"" + Utils::EscapeJson(res.subPath) + "\"";
    } else {
        json += ",\"subPath\":null";
    }
    json += "}";
    SendWebMessage(json);
}

class FileDropTarget : public IDropTarget {
public:
    ULONG STDMETHODCALLTYPE AddRef() override { return 1; }
    ULONG STDMETHODCALLTYPE Release() override { return 1; }
    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid, void** ppv) override {
        if (riid == IID_IUnknown || riid == IID_IDropTarget) {
            *ppv = this;
            return S_OK;
        }
        *ppv = nullptr;
        return E_NOINTERFACE;
    }

    HRESULT STDMETHODCALLTYPE DragEnter(IDataObject*, DWORD, POINTL, DWORD* pdwEffect) override {
        *pdwEffect = DROPEFFECT_COPY;
        return S_OK;
    }
    HRESULT STDMETHODCALLTYPE DragOver(DWORD, POINTL, DWORD* pdwEffect) override {
        *pdwEffect = DROPEFFECT_COPY;
        return S_OK;
    }
    HRESULT STDMETHODCALLTYPE DragLeave() override { return S_OK; }

    HRESULT STDMETHODCALLTYPE Drop(IDataObject* pDataObj, DWORD, POINTL, DWORD* pdwEffect) override {
        *pdwEffect = DROPEFFECT_COPY;
        FORMATETC fmt = { CF_HDROP, NULL, DVASPECT_CONTENT, -1, TYMED_HGLOBAL };
        STGMEDIUM stg;
        if (SUCCEEDED(pDataObj->GetData(&fmt, &stg))) {
            HDROP hDrop = (HDROP)GlobalLock(stg.hGlobal);
            if (hDrop) {
                UINT count = DragQueryFileW(hDrop, 0xFFFFFFFF, NULL, 0);
                std::vector<std::wstring> paths;
                for (UINT i = 0; i < count; ++i) {
                    wchar_t buf[MAX_PATH];
                    if (DragQueryFileW(hDrop, i, buf, MAX_PATH)) {
                        paths.push_back(buf);
                    }
                }
                GlobalUnlock(stg.hGlobal);
                if (!paths.empty()) {
                    auto res = Utils::BuildPlaylistData(paths);
                    std::string json = "{\"type\":\"load-playlist\",\"playlist\":[";
                    for (size_t i = 0; i < res.playlist.size(); ++i) {
                        if (i > 0) json += ",";
                        json += "\"" + Utils::EscapeJson(res.playlist[i]) + "\"";
                    }
                    json += "],\"playlistIndex\":" + std::to_string(res.playlistIndex);
                    if (!res.subPath.empty()) {
                        json += ",\"subPath\":\"" + Utils::EscapeJson(res.subPath) + "\"";
                    } else {
                        json += ",\"subPath\":null";
                    }
                    json += "}";
                    SendWebMessage(json);
                }
            }
            ReleaseStgMedium(&stg);
        }
        return S_OK;
    }
};

static FileDropTarget g_dropTarget;

void AttachDropTargetToTree(HWND hWnd) {
    RevokeDragDrop(hWnd);
    RegisterDragDrop(hWnd, &g_dropTarget);
    EnumChildWindows(hWnd, [](HWND hChild, LPARAM) -> BOOL {
        RevokeDragDrop(hChild);
        RegisterDragDrop(hChild, &g_dropTarget);
        return TRUE;
    }, 0);
}

void SaveCurrentNormalRectIfApplicable() {
    if (!g_isFullscreen && !IsZoomed(g_hMainWnd) && !IsIconic(g_hMainWnd)) {
        RECT rc;
        GetWindowRect(g_hMainWnd, &rc);
        HMONITOR hMon = MonitorFromWindow(g_hMainWnd, MONITOR_DEFAULTTONEAREST);
        MONITORINFO mi = { sizeof(mi) };
        GetMonitorInfoW(hMon, &mi);

        int w = rc.right - rc.left;
        int h = rc.bottom - rc.top;
        int workW = mi.rcWork.right - mi.rcWork.left;
        int workH = mi.rcWork.bottom - mi.rcWork.top;

        // Сохраняем только если окно не растянуто вручную под полный экран
        if (w < workW - 20 || h < workH - 20) {
            if (w >= 800 && h >= 450) {
                g_normalRect = rc;
            }
        }
    }
}

void ToggleWindowFullscreen() {
    g_isFullscreen = !g_isFullscreen;

    if (g_mpv) {
        g_mpv->SetProperty("fullscreen", g_isFullscreen ? "yes" : "no");
    }

    if (g_isFullscreen) {
        // Запоминаем нормальный размер перед уходом в Full Screen
        SaveCurrentNormalRectIfApplicable();

        HMONITOR hMon = MonitorFromWindow(g_hMainWnd, MONITOR_DEFAULTTONEAREST);
        MONITORINFO mi = { sizeof(mi) };
        GetMonitorInfoW(hMon, &mi);

        int monW = mi.rcMonitor.right - mi.rcMonitor.left;
        int monH = mi.rcMonitor.bottom - mi.rcMonitor.top;

        SetWindowLongPtr(g_hMainWnd, GWL_STYLE, WS_POPUP | WS_VISIBLE);
        SetWindowPos(g_hMainWnd, HWND_TOPMOST,
            mi.rcMonitor.left, mi.rcMonitor.top, monW, monH,
            SWP_NOCOPYBITS | SWP_FRAMECHANGED);

        SetForegroundWindow(g_hMainWnd);
        ResizeViews(monW, monH);
    } else {
        // ВЫХОД ИЗ FULL SCREEN: всегда возвращаем окно в нормальный компактный размер
        SetWindowLongPtr(g_hMainWnd, GWL_STYLE, WS_POPUP | WS_THICKFRAME | WS_MINIMIZEBOX | WS_MAXIMIZEBOX | WS_VISIBLE);

        if (IsZoomed(g_hMainWnd)) {
            ShowWindow(g_hMainWnd, SW_RESTORE);
        }

        int winW = g_normalRect.right - g_normalRect.left;
        int winH = g_normalRect.bottom - g_normalRect.top;
        if (winW < 800 || winH < 450) {
            winW = 1024;
            winH = 576;
        }

        HMONITOR hMon = MonitorFromWindow(g_hMainWnd, MONITOR_DEFAULTTONEAREST);
        MONITORINFO mi = { sizeof(mi) };
        GetMonitorInfoW(hMon, &mi);

        int posX = g_normalRect.left;
        int posY = g_normalRect.top;

        // Проверяем, чтобы окно не вылезло за границы экрана
        if (posX < mi.rcWork.left || posX + winW > mi.rcWork.right ||
            posY < mi.rcWork.top || posY + winH > mi.rcWork.bottom) {
            posX = mi.rcWork.left + (mi.rcWork.right - mi.rcWork.left - winW) / 2;
            posY = mi.rcWork.top + (mi.rcWork.bottom - mi.rcWork.top - winH) / 2;
        }

        SetWindowPos(g_hMainWnd, HWND_NOTOPMOST,
            posX, posY, winW, winH,
            SWP_NOCOPYBITS | SWP_FRAMECHANGED);

        ResizeViews(winW, winH);
        SetForegroundWindow(g_hMainWnd);

        if (g_isMaximized) {
            g_isMaximized = false;
            SendWebMessage("{\"type\":\"window-maximize-state\",\"state\":false}");
        }
    }

    DwmFlush();

    if (g_mpv && g_mpv->IsPaused()) {
        g_mpv->Command({ "redraw" });
    }

    SendWebMessage("{\"type\":\"fullscreen-state\",\"isFullscreen\":" + std::string(g_isFullscreen ? "true" : "false") + "}");
}

std::string ExtractJsonStringField(const std::string& json, const std::string& key) {
    std::string pattern = "\"" + key + "\"";
    size_t keyPos = 0;
    while ((keyPos = json.find(pattern, keyPos)) != std::string::npos) {
        size_t afterKey = keyPos + pattern.length();
        while (afterKey < json.length() && (json[afterKey] == ' ' || json[afterKey] == '\t' || json[afterKey] == '\r' || json[afterKey] == '\n')) {
            afterKey++;
        }
        if (afterKey < json.length() && json[afterKey] == ':') {
            size_t valStart = afterKey + 1;
            while (valStart < json.length() && (json[valStart] == ' ' || json[valStart] == '\t' || json[valStart] == '\r' || json[valStart] == '\n')) {
                valStart++;
            }
            if (valStart < json.length() && json[valStart] == '\"') {
                std::string res;
                for (size_t i = valStart + 1; i < json.length(); ++i) {
                    if (json[i] == '\\' && i + 1 < json.length()) {
                        char next = json[i + 1];
                        if (next == '\"') { res += '\"'; i++; }
                        else if (next == '\\') { res += '\\'; i++; }
                        else if (next == '/') { res += '/'; i++; }
                        else if (next == 'n') { res += '\n'; i++; }
                        else if (next == 'r') { res += '\r'; i++; }
                        else if (next == 't') { res += '\t'; i++; }
                        else { res += json[i]; }
                    } else if (json[i] == '\"') {
                        return res;
                    } else {
                        res += json[i];
                    }
                }
                return res;
            }
        }
        keyPos += pattern.length();
    }
    return "";
}

void OpenNativeFileDialog() {
    wchar_t fileBuf[32768] = { 0 };
    OPENFILENAMEW ofn = { sizeof(OPENFILENAMEW) };
    ofn.hwndOwner = g_hMainWnd;
    ofn.lpstrFile = fileBuf;
    ofn.nMaxFile = sizeof(fileBuf) / sizeof(wchar_t);
    ofn.lpstrFilter = L"Media Files\0*.mp4;*.mkv;*.webm;*.avi;*.mov;*.mp3;*.wav;*.flac;*.ogg;*.m4a\0All Files (*.*)\0*.*\0";
    ofn.nFilterIndex = 1;
    ofn.Flags = OFN_PATHMUSTEXIST | OFN_FILEMUSTEXIST | OFN_EXPLORER | OFN_ALLOWMULTISELECT;

    if (GetOpenFileNameW(&ofn)) {
        std::vector<std::wstring> selected;
        wchar_t* p = fileBuf;
        std::wstring first = p;
        p += first.length() + 1;
        if (*p == L'\0') {
            selected.push_back(first);
        } else {
            while (*p != L'\0') {
                selected.push_back(first + L"\\" + std::wstring(p));
                p += wcslen(p) + 1;
            }
        }
        auto res = Utils::BuildPlaylistData(selected);
        std::string json = "{\"type\":\"load-playlist\",\"playlist\":[";
        for (size_t i = 0; i < res.playlist.size(); ++i) {
            if (i > 0) json += ",";
            json += "\"" + Utils::EscapeJson(res.playlist[i]) + "\"";
        }
        json += "],\"playlistIndex\":" + std::to_string(res.playlistIndex);
        if (!res.subPath.empty()) {
            json += ",\"subPath\":\"" + Utils::EscapeJson(res.subPath) + "\"";
        } else {
            json += ",\"subPath\":null";
        }
        json += "}";
        SendWebMessage(json);
    }
}

void OpenNativeSubDialog() {
    wchar_t fileBuf[MAX_PATH] = { 0 };
    OPENFILENAMEW ofn = { sizeof(OPENFILENAMEW) };
    ofn.hwndOwner = g_hMainWnd;
    ofn.lpstrFile = fileBuf;
    ofn.nMaxFile = MAX_PATH;
    ofn.lpstrFilter = L"Subtitles (*.srt;*.vtt;*.ass)\0*.srt;*.vtt;*.ass\0All Files (*.*)\0*.*\0";
    ofn.nFilterIndex = 1;
    ofn.Flags = OFN_PATHMUSTEXIST | OFN_FILEMUSTEXIST | OFN_EXPLORER;

    if (GetOpenFileNameW(&ofn)) {
        std::string path = Utils::Utf16ToUtf8(fileBuf);
        if (g_mpv) {
            g_mpv->Command({ "sub-add", path, "auto" });
        }
    }
}

void HandleWebMessage(const std::wstring& msg) {
    std::string s = Utils::Utf16ToUtf8(msg);
    std::string type = ExtractJsonStringField(s, "type");

    if (type == "app-ready") {
        g_isAppReady = true;
        if (!g_pendingInitialArg.empty()) {
            DispatchInitialFile(g_pendingInitialArg);
            g_pendingInitialArg.clear();
        }
    } else if (type == "window-minimize") {
        ShowWindow(g_hMainWnd, SW_MINIMIZE);
    } else if (type == "window-maximize") {
        if (IsZoomed(g_hMainWnd)) {
            // Восстановление из максимизированного состояния строго в сохраненный компактный размер
            ShowWindow(g_hMainWnd, SW_RESTORE);

            int winW = g_normalRect.right - g_normalRect.left;
            int winH = g_normalRect.bottom - g_normalRect.top;
            if (winW < 800 || winH < 450) {
                winW = 1024;
                winH = 576;
            }

            SetWindowPos(g_hMainWnd, HWND_NOTOPMOST,
                g_normalRect.left, g_normalRect.top, winW, winH,
                SWP_NOCOPYBITS | SWP_FRAMECHANGED);

            ResizeViews(winW, winH);
        } else {
            SaveCurrentNormalRectIfApplicable();
            ShowWindow(g_hMainWnd, SW_MAXIMIZE);
        }
    } else if (type == "window-close") {
        PostMessageW(g_hMainWnd, WM_CLOSE, 0, 0);
    } else if (type == "window-drag") {
        ReleaseCapture();
        SendMessageW(g_hMainWnd, WM_NCLBUTTONDOWN, HTCAPTION, 0);
    } else if (type == "window-resize") {
        std::string dir = ExtractJsonStringField(s, "dir");
        int hit = HTCLIENT;
        if (dir == "top") hit = HTTOP;
        else if (dir == "bottom") hit = HTBOTTOM;
        else if (dir == "left") hit = HTLEFT;
        else if (dir == "right") hit = HTRIGHT;
        else if (dir == "top-left") hit = HTTOPLEFT;
        else if (dir == "top-right") hit = HTTOPRIGHT;
        else if (dir == "bottom-left") hit = HTBOTTOMLEFT;
        else if (dir == "bottom-right") hit = HTBOTTOMRIGHT;

        if (hit != HTCLIENT && !IsZoomed(g_hMainWnd) && !g_isFullscreen) {
            ReleaseCapture();
            SendMessageW(g_hMainWnd, WM_NCLBUTTONDOWN, hit, 0);
        }
    } else if (type == "window-fullscreen") {
        ToggleWindowFullscreen();
    } else if (type == "open-file-dialog") {
        OpenNativeFileDialog();
    } else if (type == "open-sub-dialog") {
        OpenNativeSubDialog();
    } else if (type == "mpv-load") {
        std::string path = ExtractJsonStringField(s, "path");
        if (g_mpv && !path.empty()) {
            g_mpv->LoadFile(path);
            std::filesystem::path fp(Utils::Utf8ToUtf16(path));
            std::wstring title = L"Perdanga VSP - " + fp.filename().wstring();
            SetWindowTextW(g_hMainWnd, title.c_str());
        }
    } else if (type == "mpv-seek") {
        size_t pos = s.find("\"time\":");
        if (pos != std::string::npos) {
            double time = std::stod(s.substr(pos + 7));
            bool abs = s.find("\"absolute\":true") != std::string::npos;
            bool exact = s.find("\"exact\":false") == std::string::npos;
            if (g_mpv) g_mpv->Seek(time, abs, exact);
        }
    } else if (type == "mpv-set-property") {
        std::string name = ExtractJsonStringField(s, "name");
        size_t vPos = s.find("\"value\":");
        if (vPos != std::string::npos && g_mpv) {
            std::string sub = s.substr(vPos + 8);
            size_t start = sub.find_first_not_of(" \t");
            if (start != std::string::npos) sub = sub.substr(start);

            std::string valStr;
            if (sub.front() == '\"') {
                size_t q2 = sub.find('\"', 1);
                if (q2 != std::string::npos) valStr = sub.substr(1, q2 - 1);
            } else {
                size_t end = sub.find_first_of(",}");
                valStr = (end != std::string::npos) ? sub.substr(0, end) : sub;
                size_t last = valStr.find_last_not_of(" \t\r\n");
                if (last != std::string::npos) valStr = valStr.substr(0, last + 1);

                if (valStr == "true") valStr = "yes";
                else if (valStr == "false") valStr = "no";
            }
            g_mpv->SetProperty(name, valStr);
        }
    } else if (type == "mpv-command") {
        std::vector<std::string> args;
        size_t aPos = s.find("\"args\":[");
        if (aPos != std::string::npos) {
            size_t curr = aPos + 8;
            while (curr < s.length() && s[curr] != ']') {
                size_t q1 = s.find('\"', curr);
                if (q1 == std::string::npos) break;
                size_t q2 = s.find('\"', q1 + 1);
                if (q2 == std::string::npos) break;
                args.push_back(s.substr(q1 + 1, q2 - q1 - 1));
                curr = q2 + 1;
            }
        }
        if (g_mpv) g_mpv->Command(args);
    } else if (type == "change-icon") {
        std::string iconRel = ExtractJsonStringField(s, "icon");
        wchar_t exePath[MAX_PATH];
        GetModuleFileNameW(NULL, exePath, MAX_PATH);
        std::filesystem::path exeDir = std::filesystem::path(exePath).parent_path();
        std::filesystem::path full = exeDir / "ui" / Utils::Utf8ToUtf16(iconRel);
        HICON hIcon = (HICON)LoadImageW(NULL, full.c_str(), IMAGE_ICON, 0, 0, LR_LOADFROMFILE | LR_DEFAULTSIZE);
        if (hIcon) {
            SendMessageW(g_hMainWnd, WM_SETICON, ICON_BIG, (LPARAM)hIcon);
            SendMessageW(g_hMainWnd, WM_SETICON, ICON_SMALL, (LPARAM)hIcon);
        }
    } else if (type == "get-screenshot-path") {
        size_t idPos = s.find("\"id\":");
        std::string id = "0";
        if (idPos != std::string::npos) {
            id = std::to_string(std::stoll(s.substr(idPos + 5)));
        }
        std::string filename = ExtractJsonStringField(s, "filename");
        std::string p = Utils::GetScreenshotPath(filename);
        SendWebMessage("{\"type\":\"rpc-response\",\"id\":" + id + ",\"result\":\"" + Utils::EscapeJson(p) + "\"}");
    } else if (type == "process-files") {
        size_t idPos = s.find("\"id\":");
        std::string id = "0";
        if (idPos != std::string::npos) {
            id = std::to_string(std::stoll(s.substr(idPos + 5)));
        }
        std::vector<std::wstring> paths;
        size_t pPos = s.find("\"paths\":[");
        if (pPos != std::string::npos) {
            size_t curr = pPos + 9;
            while (curr < s.length() && s[curr] != ']') {
                size_t q1 = s.find('\"', curr);
                if (q1 == std::string::npos) break;
                size_t q2 = s.find('\"', q1 + 1);
                if (q2 == std::string::npos) break;
                paths.push_back(Utils::Utf8ToUtf16(s.substr(q1 + 1, q2 - q1 - 1)));
                curr = q2 + 1;
            }
        }
        auto res = Utils::BuildPlaylistData(paths);
        std::string json = "{\"type\":\"load-playlist\",\"playlist\":[";
        for (size_t i = 0; i < res.playlist.size(); ++i) {
            if (i > 0) json += ",";
            json += "\"" + Utils::EscapeJson(res.playlist[i]) + "\"";
        }
        json += "],\"playlistIndex\":" + std::to_string(res.playlistIndex);
        if (!res.subPath.empty()) {
            json += ",\"subPath\":\"" + Utils::EscapeJson(res.subPath) + "\"";
        } else {
            json += ",\"subPath\":null";
        }
        json += "}}";
        SendWebMessage(json);
    }
}

LRESULT CALLBACK WndProc(HWND hWnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
        case WM_NCACTIVATE: {
            return TRUE;
        }
        case WM_NCPAINT: {
            return 0;
        }
        case WM_NCCALCSIZE: {
            if (wParam == TRUE) {
                if (g_isFullscreen) {
                    return 0;
                }
                if (IsZoomed(hWnd)) {
                    NCCALCSIZE_PARAMS* p = (NCCALCSIZE_PARAMS*)lParam;
                    HMONITOR hMon = MonitorFromWindow(hWnd, MONITOR_DEFAULTTONEAREST);
                    MONITORINFO mi = { sizeof(mi) };
                    GetMonitorInfoW(hMon, &mi);
                    p->rgrc[0] = mi.rcWork;
                    return 0;
                }
                return 0;
            }
            break;
        }
        case WM_GETMINMAXINFO: {
            LPMINMAXINFO mmi = (LPMINMAXINFO)lParam;
            if (g_isFullscreen) {
                HMONITOR hMon = MonitorFromWindow(hWnd, MONITOR_DEFAULTTONEAREST);
                MONITORINFO mi = { sizeof(mi) };
                GetMonitorInfoW(hMon, &mi);
                mmi->ptMaxSize.x = mi.rcMonitor.right - mi.rcMonitor.left;
                mmi->ptMaxSize.y = mi.rcMonitor.bottom - mi.rcMonitor.top;
                mmi->ptMaxPosition.x = mi.rcMonitor.left;
                mmi->ptMaxPosition.y = mi.rcMonitor.top;
                return 0;
            }

            HMONITOR hMon = MonitorFromWindow(hWnd, MONITOR_DEFAULTTONEAREST);
            MONITORINFO mi = { sizeof(mi) };
            GetMonitorInfoW(hMon, &mi);

            mmi->ptMaxPosition.x = mi.rcWork.left - mi.rcMonitor.left;
            mmi->ptMaxPosition.y = mi.rcWork.top - mi.rcMonitor.top;
            mmi->ptMaxSize.x = mi.rcWork.right - mi.rcWork.left;
            mmi->ptMaxSize.y = mi.rcWork.bottom - mi.rcWork.top;

            mmi->ptMinTrackSize.x = 800;
            mmi->ptMinTrackSize.y = 450;
            return 0;
        }
        case WM_ERASEBKGND: {
            HDC hdc = (HDC)wParam;
            RECT rc;
            GetClientRect(hWnd, &rc);
            FillRect(hdc, &rc, (HBRUSH)GetStockObject(BLACK_BRUSH));
            return 1;
        }
        case WM_SIZING: {
            RECT* prc = (RECT*)lParam;
            int w = prc->right - prc->left;
            int h = prc->bottom - prc->top;
            static ULONGLONG lastResize = 0;
            ULONGLONG now = GetTickCount64();
            if (now - lastResize >= 16) {
                lastResize = now;
                ResizeViews(w, h);
            }
            break;
        }
        // Запоминаем нормальный размер после окончания изменения размера или перемещения
        case WM_EXITSIZEMOVE: {
            SaveCurrentNormalRectIfApplicable();
            break;
        }
        case WM_SIZE: {
            int w = LOWORD(lParam);
            int h = HIWORD(lParam);
            if (w > 0 && h > 0) {
                ResizeViews(w, h);
                if (g_mpv && g_mpv->IsPaused()) {
                    g_mpv->Command({ "redraw" });
                }
            }

            bool maxState = (wParam == SIZE_MAXIMIZED);
            if (maxState != g_isMaximized) {
                g_isMaximized = maxState;
                SendWebMessage("{\"type\":\"window-maximize-state\",\"state\":" + std::string(g_isMaximized ? "true" : "false") + "}");
            }
            return 0;
        }
        case WM_PARENTNOTIFY: {
            if (LOWORD(wParam) == WM_CREATE) {
                AttachDropTargetToTree(hWnd);
            }
            break;
        }
        case WM_COPYDATA: {
            PCOPYDATASTRUCT cds = (PCOPYDATASTRUCT)lParam;
            if (cds && cds->lpData) {
                std::wstring incoming = (const wchar_t*)cds->lpData;
                std::wstring clean = Utils::CleanPath(incoming);
                if (!clean.empty()) {
                    if (g_isAppReady) {
                        DispatchInitialFile(clean);
                    } else {
                        g_pendingInitialArg = clean;
                    }
                }
            }
            return TRUE;
        }
        case WM_MPV_ASYNC_EVENT: {
            std::string* pStr = (std::string*)lParam;
            if (pStr) {
                SendWebMessage("{\"type\":\"mpv-event\",\"data\":" + *pStr + "}");
                delete pStr;
            }
            return 0;
        }
        case WM_DESTROY: {
            RevokeDragDrop(hWnd);
            if (g_mpv) g_mpv->Destroy();
            
            MSG queuedMsg;
            while (PeekMessageW(&queuedMsg, hWnd, WM_MPV_ASYNC_EVENT, WM_MPV_ASYNC_EVENT, PM_REMOVE)) {
                std::string* pStr = (std::string*)queuedMsg.lParam;
                delete pStr;
            }
            
            PostQuitMessage(0);
            return 0;
        }
    }
    return DefWindowProcW(hWnd, msg, wParam, lParam);
}

void InitWebView(HWND hWnd) {
    PWSTR localAppData = NULL;
    std::wstring userDataPath;
    if (SUCCEEDED(SHGetKnownFolderPath(FOLDERID_LocalAppData, 0, NULL, &localAppData))) {
        std::filesystem::path udata = std::filesystem::path(localAppData) / L"Perdanga VSP" / L"WebView2";
        CoTaskMemFree(localAppData);
        std::error_code ec;
        std::filesystem::create_directories(udata, ec);
        userDataPath = udata.wstring();
    }

    LPCWSTR pUserData = userDataPath.empty() ? nullptr : userDataPath.c_str();

    CreateCoreWebView2EnvironmentWithOptions(nullptr, pUserData, nullptr,
        Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(
            [hWnd](HRESULT hr, ICoreWebView2Environment* env) -> HRESULT {
                if (FAILED(hr) || !env) {
                    MessageBoxW(hWnd, L"Не удалось инициализировать среду WebView2.\nУбедитесь, что установлен Microsoft Edge WebView2 Runtime.", L"Perdanga VSP - Ошибка", MB_ICONERROR);
                    return hr;
                }

                env->CreateCoreWebView2Controller(hWnd,
                    Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>(
                        [hWnd](HRESULT hr, ICoreWebView2Controller* controller) -> HRESULT {
                            if (FAILED(hr) || !controller) return hr;

                            g_webViewController = controller;
                            g_webViewController->get_CoreWebView2(&g_webView);

                            ComPtr<ICoreWebView2Controller4> controller4;
                            if (SUCCEEDED(controller->QueryInterface(IID_PPV_ARGS(&controller4)))) {
                                controller4->put_AllowExternalDrop(FALSE);
                            }

                            ComPtr<ICoreWebView2Controller2> controller2;
                            if (SUCCEEDED(controller->QueryInterface(IID_PPV_ARGS(&controller2)))) {
                                COREWEBVIEW2_COLOR transparent = { 0, 0, 0, 0 };
                                controller2->put_DefaultBackgroundColor(transparent);
                            }

                            RECT rc;
                            GetClientRect(hWnd, &rc);
                            g_webViewController->put_Bounds(rc);
                            g_webViewController->put_IsVisible(TRUE);

                            ComPtr<ICoreWebView2Settings> settings;
                            g_webView->get_Settings(&settings);
                            if (settings) {
                                settings->put_AreDefaultScriptDialogsEnabled(TRUE);
                                settings->put_IsWebMessageEnabled(TRUE);
                                settings->put_AreDefaultContextMenusEnabled(FALSE);
                                settings->put_AreDevToolsEnabled(FALSE);
                            }

                            EventRegistrationToken token;
                            g_webView->add_WebMessageReceived(
                                Callback<ICoreWebView2WebMessageReceivedEventHandler>(
                                    [](ICoreWebView2*, ICoreWebView2WebMessageReceivedEventArgs* args) -> HRESULT {
                                        LPWSTR rawJson = nullptr;
                                        if (SUCCEEDED(args->get_WebMessageAsJson(&rawJson)) && rawJson) {
                                            HandleWebMessage(rawJson);
                                            CoTaskMemFree(rawJson);
                                        }
                                        return S_OK;
                                    }).Get(), &token);

                            g_webView->add_NavigationCompleted(
                                Callback<ICoreWebView2NavigationCompletedEventHandler>(
                                    [](ICoreWebView2*, ICoreWebView2NavigationCompletedEventArgs*) -> HRESULT {
                                        ShowWindow(g_hMainWnd, SW_SHOW);
                                        UpdateWindow(g_hMainWnd);
                                        SetForegroundWindow(g_hMainWnd);
                                        return S_OK;
                                    }).Get(), nullptr);

                            wchar_t exePath[MAX_PATH];
                            GetModuleFileNameW(NULL, exePath, MAX_PATH);
                            std::filesystem::path exeDir = std::filesystem::path(exePath).parent_path();
                            std::filesystem::path htmlPath = exeDir / "ui" / "index.html";

                            wchar_t fileUri[2048];
                            DWORD urlLen = 2048;
                            if (SUCCEEDED(UrlCreateFromPathW(htmlPath.c_str(), fileUri, &urlLen, 0))) {
                                g_webView->Navigate(fileUri);
                            } else {
                                std::wstring raw = L"file:///" + htmlPath.wstring();
                                std::replace(raw.begin(), raw.end(), L'\\', L'/');
                                g_webView->Navigate(raw.c_str());
                            }

                            AttachDropTargetToTree(hWnd);
                            return S_OK;
                        }).Get());
                return S_OK;
            }).Get());
}

int WINAPI wWinMain(HINSTANCE hInstance, HINSTANCE, PWSTR pCmdLine, int nCmdShow) {
    HRESULT hrOle = OleInitialize(NULL);
    if (FAILED(hrOle)) return 1;

    SetCurrentProcessExplicitAppUserModelID(L"Perdanga.VSP.Player");
    SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);

    HANDLE hMutex = CreateMutexW(NULL, TRUE, L"PerdangaVSP_SingleInstance_AppMutex");
    if (GetLastError() == ERROR_ALREADY_EXISTS) {
        HWND hExisting = FindWindowW(WINDOW_CLASS_NAME, NULL);
        if (hExisting) {
            int nArgs = 0;
            LPWSTR* szArglist = CommandLineToArgvW(GetCommandLineW(), &nArgs);
            std::wstring targetFile;

            if (szArglist && nArgs > 1) {
                targetFile = Utils::CleanPath(szArglist[1]);
                LocalFree(szArglist);
            } else if (pCmdLine && wcslen(pCmdLine) > 0) {
                targetFile = Utils::CleanPath(pCmdLine);
            }

            if (!targetFile.empty()) {
                COPYDATASTRUCT cds;
                cds.dwData = 1;
                cds.cbData = (DWORD)(targetFile.length() + 1) * sizeof(wchar_t);
                cds.lpData = (PVOID)targetFile.c_str();
                SendMessageW(hExisting, WM_COPYDATA, 0, (LPARAM)&cds);
            }

            if (IsIconic(hExisting)) {
                ShowWindow(hExisting, SW_RESTORE);
            }
            SetForegroundWindow(hExisting);
        }
        OleUninitialize();
        return 0;
    }

    wchar_t exePath[MAX_PATH];
    GetModuleFileNameW(NULL, exePath, MAX_PATH);
    std::filesystem::path exeDir = std::filesystem::path(exePath).parent_path();
    std::filesystem::path iconPath = exeDir / L"ui" / L"ico" / L"GreenOrange.ico";
    HICON hAppIcon = (HICON)LoadImageW(NULL, iconPath.c_str(), IMAGE_ICON, 0, 0, LR_LOADFROMFILE | LR_DEFAULTSIZE);

    WNDCLASSEXW wc = { sizeof(WNDCLASSEXW) };
    wc.lpfnWndProc = WndProc;
    wc.hInstance = hInstance;
    wc.lpszClassName = WINDOW_CLASS_NAME;
    wc.hCursor = LoadCursor(NULL, IDC_ARROW);
    wc.hbrBackground = (HBRUSH)GetStockObject(BLACK_BRUSH);
    wc.hIcon = hAppIcon;
    wc.hIconSm = hAppIcon;
    RegisterClassExW(&wc);

    RECT workArea;
    SystemParametersInfoW(SPI_GETWORKAREA, 0, &workArea, 0);
    int winW = 1024;
    int winH = 576;
    int posX = workArea.left + (workArea.right - workArea.left - winW) / 2;
    int posY = workArea.top + (workArea.bottom - workArea.top - winH) / 2;

    g_normalRect.left = posX;
    g_normalRect.top = posY;
    g_normalRect.right = posX + winW;
    g_normalRect.bottom = posY + winH;

    g_hMainWnd = CreateWindowExW(
        WS_EX_APPWINDOW, WINDOW_CLASS_NAME, L"Perdanga VSP",
        WS_POPUP | WS_THICKFRAME | WS_MINIMIZEBOX | WS_MAXIMIZEBOX,
        posX, posY, winW, winH,
        NULL, NULL, hInstance, NULL
    );

    if (hAppIcon) {
        SendMessageW(g_hMainWnd, WM_SETICON, ICON_BIG, (LPARAM)hAppIcon);
        SendMessageW(g_hMainWnd, WM_SETICON, ICON_SMALL, (LPARAM)hAppIcon);
    }

    MARGINS margins = { 0, 0, 0, 1 };
    DwmExtendFrameIntoClientArea(g_hMainWnd, &margins);

    DragAcceptFiles(g_hMainWnd, TRUE);

    BOOL disableTransitions = FALSE;
    DwmSetWindowAttribute(g_hMainWnd, DWMWA_TRANSITIONS_FORCEDISABLED, &disableTransitions, sizeof(disableTransitions));

    SetWindowTextW(g_hMainWnd, L"Perdanga VSP");

    g_mpv = std::make_unique<MpvPlayer>();
    g_mpv->SetEventCallback([](const std::string& jsonEvent) {
        std::string* pStr = new std::string(jsonEvent);
        PostMessageW(g_hMainWnd, WM_MPV_ASYNC_EVENT, 0, (LPARAM)pStr);
    });
    g_mpv->Initialize(g_hMainWnd);

    int nArgs = 0;
    LPWSTR* szArglist = CommandLineToArgvW(GetCommandLineW(), &nArgs);
    if (szArglist && nArgs > 1) {
        g_pendingInitialArg = Utils::CleanPath(szArglist[1]);
        LocalFree(szArglist);
    } else if (pCmdLine && wcslen(pCmdLine) > 0) {
        g_pendingInitialArg = Utils::CleanPath(pCmdLine);
    }

    InitWebView(g_hMainWnd);

    MSG msg;
    while (GetMessageW(&msg, NULL, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }

    if (hMutex) {
        ReleaseMutex(hMutex);
        CloseHandle(hMutex);
    }

    OleUninitialize();
    return (int)msg.wParam;
}