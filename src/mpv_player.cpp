#include "mpv_player.h"
#include "utils.h"
#include <iostream>
#include <fstream>
#include <sstream>
#include <cmath>
#include <filesystem>
#include <algorithm>

namespace {
    static const char b64_table[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    std::string Base64Encode(const unsigned char* data, size_t len) {
        std::string out;
        out.reserve(((len + 2) / 3) * 4);
        for (size_t i = 0; i < len; i += 3) {
            uint32_t octet_a = i < len ? data[i] : 0;
            uint32_t octet_b = (i + 1) < len ? data[i + 1] : 0;
            uint32_t octet_c = (i + 2) < len ? data[i + 2] : 0;
            uint32_t triple = (octet_a << 16) | (octet_b << 8) | octet_c;
            out.push_back(b64_table[(triple >> 18) & 0x3F]);
            out.push_back(b64_table[(triple >> 12) & 0x3F]);
            out.push_back((i + 1) < len ? b64_table[(triple >> 6) & 0x3F] : '=');
            out.push_back((i + 2) < len ? b64_table[triple & 0x3F] : '=');
        }
        return out;
    }
}

MpvPlayer::MpvPlayer() {}

MpvPlayer::~MpvPlayer() {
    Destroy();
}

void MpvPlayer::ApplyHighFidelityRenderProfiles() {
    if (!m_mpv) return;

    mpv_set_option_string(m_mpv, "vo", "gpu");
    mpv_set_option_string(m_mpv, "gpu-api", "d3d11");
    mpv_set_option_string(m_mpv, "gpu-context", "d3d11");
    mpv_set_option_string(m_mpv, "d3d11-flip", "yes");
    mpv_set_option_string(m_mpv, "d3d11-sync-interval", "1");
    mpv_set_option_string(m_mpv, "d3d11-exclusive-fs", "no");

    mpv_set_option_string(m_mpv, "hwdec", "auto-safe");

    unsigned int hwThreads = std::thread::hardware_concurrency();
    unsigned int safeThreads = (hwThreads > 0) ? std::clamp(hwThreads, 2u, 8u) : 4u;
    mpv_set_option_string(m_mpv, "vd-lavc-threads", std::to_string(safeThreads).c_str());
    mpv_set_option_string(m_mpv, "vd-lavc-fast", "yes");
    mpv_set_option_string(m_mpv, "vd-lavc-dr", "no");

    mpv_set_option_string(m_mpv, "framedrop", "no");
    mpv_set_option_string(m_mpv, "hr-seek-framedrop", "no");

    mpv_set_option_string(m_mpv, "scale", "spline36");
    mpv_set_option_string(m_mpv, "scale-antiring", "0.7");
    mpv_set_option_string(m_mpv, "cscale", "spline36");
    mpv_set_option_string(m_mpv, "cscale-antiring", "0.7");
    mpv_set_option_string(m_mpv, "dscale", "mitchell");
    mpv_set_option_string(m_mpv, "correct-downscaling", "yes");
    mpv_set_option_string(m_mpv, "linear-downscaling", "yes");
    mpv_set_option_string(m_mpv, "sigmoid-upscaling", "yes");

    mpv_set_option_string(m_mpv, "fbo-format", "rgba16f");
    mpv_set_option_string(m_mpv, "target-colorspace-hint", "no");
    mpv_set_option_string(m_mpv, "tone-mapping", "bt.2446a");

    mpv_set_option_string(m_mpv, "deband", "yes");
    mpv_set_option_string(m_mpv, "deband-iterations", "2");
    mpv_set_option_string(m_mpv, "deband-threshold", "48");
    mpv_set_option_string(m_mpv, "deband-range", "16");
    mpv_set_option_string(m_mpv, "deband-grain", "32");

    mpv_set_option_string(m_mpv, "video-sync", "display-resample");
    mpv_set_option_string(m_mpv, "interpolation", "yes");
    mpv_set_option_string(m_mpv, "tscale", "oversample");

    mpv_set_option_string(m_mpv, "sub-font", "Segoe UI");
    mpv_set_option_string(m_mpv, "sub-font-size", "44");
    mpv_set_option_string(m_mpv, "sub-border-size", "2.4");
    mpv_set_option_string(m_mpv, "sub-shadow-offset", "1.0");
    mpv_set_option_string(m_mpv, "sub-auto", "fuzzy");

    PWSTR localAppData = NULL;
    if (SUCCEEDED(SHGetKnownFolderPath(FOLDERID_LocalAppData, 0, NULL, &localAppData))) {
        std::filesystem::path cacheDir = std::filesystem::path(localAppData) / L"Perdanga VSP" / L"shader-cache";
        CoTaskMemFree(localAppData);
        std::error_code ec;
        std::filesystem::create_directories(cacheDir, ec);
        std::string cacheDirUtf8 = Utils::Utf16ToUtf8(cacheDir.wstring());
        mpv_set_option_string(m_mpv, "gpu-shader-cache-dir", cacheDirUtf8.c_str());
    }

    mpv_set_option_string(m_mpv, "cache", "yes");
    mpv_set_option_string(m_mpv, "demuxer-max-bytes", "268435456");
    mpv_set_option_string(m_mpv, "demuxer-max-back-bytes", "67108864");
    mpv_set_option_string(m_mpv, "demuxer-readahead-secs", "6");
    mpv_set_option_string(m_mpv, "demuxer-lavf-buffersize", "1048576");
    mpv_set_option_string(m_mpv, "audio-buffer", "0.2");
    mpv_set_option_string(m_mpv, "audio-pitch-correction", "yes");

    mpv_set_option_string(m_mpv, "keepaspect", "yes");
    mpv_set_option_string(m_mpv, "keepaspect-window", "no");
    mpv_set_option_string(m_mpv, "panscan", "0.0");
    mpv_set_option_string(m_mpv, "title", "Perdanga VSP");
    mpv_set_option_string(m_mpv, "keep-open", "yes");
    mpv_set_option_string(m_mpv, "idle", "yes");
    mpv_set_option_string(m_mpv, "osc", "no");
    mpv_set_option_string(m_mpv, "osd-bar", "no");
}

bool MpvPlayer::Initialize(HWND videoHwnd) {
    if (m_mpv) return true;

    m_mpv = mpv_create();
    if (!m_mpv) return false;

    int64_t wid = (int64_t)(intptr_t)videoHwnd;
    mpv_set_option(m_mpv, "wid", MPV_FORMAT_INT64, &wid);

    ApplyHighFidelityRenderProfiles();

    if (mpv_initialize(m_mpv) < 0) {
        mpv_destroy(m_mpv);
        m_mpv = nullptr;
        return false;
    }

    ObserveProperty("time-pos");
    ObserveProperty("duration");
    ObserveProperty("pause");
    ObserveProperty("track-list");
    ObserveProperty("chapter-list");
    ObserveProperty("volume");
    ObserveProperty("speed");
    ObserveProperty("eof-reached");
    ObserveProperty("sub-delay");
    ObserveProperty("container-fps");
    ObserveProperty("fps");
    ObserveProperty("estimated-vf-fps");
    ObserveProperty("dwidth");
    ObserveProperty("dheight");

    // Off-Screen Thumbnail Worker window (parked outside the visible desktop)
    m_thumbHwnd = CreateWindowExW(WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE, L"STATIC", L"", WS_POPUP, -4000, -4000, 320, 180, NULL, NULL, GetModuleHandle(NULL), NULL);
    ShowWindow(m_thumbHwnd, SW_SHOWNOACTIVATE);

    m_thumbMpv = mpv_create();
    if (m_thumbMpv && m_thumbHwnd) {
        int64_t twid = (int64_t)(intptr_t)m_thumbHwnd;
        mpv_set_option(m_thumbMpv, "wid", MPV_FORMAT_INT64, &twid);
        mpv_set_option_string(m_thumbMpv, "vo", "gpu");
        mpv_set_option_string(m_thumbMpv, "gpu-api", "d3d11");
        mpv_set_option_string(m_thumbMpv, "hwdec", "auto-safe");
        mpv_set_option_string(m_thumbMpv, "audio", "no");
        mpv_set_option_string(m_thumbMpv, "sub", "no");
        mpv_set_option_string(m_thumbMpv, "pause", "yes");
        mpv_set_option_string(m_thumbMpv, "idle", "yes");
        mpv_set_option_string(m_thumbMpv, "scale", "bilinear");
        mpv_set_option_string(m_thumbMpv, "cscale", "bilinear");
        mpv_set_option_string(m_thumbMpv, "dscale", "bilinear");
        mpv_set_option_string(m_thumbMpv, "deband", "no");
        mpv_set_option_string(m_thumbMpv, "interpolation", "no");
        mpv_set_option_string(m_thumbMpv, "video-sync", "audio");
        mpv_set_option_string(m_thumbMpv, "demuxer-max-bytes", "33554432");
        mpv_set_option_string(m_thumbMpv, "demuxer-readahead-secs", "1");
        mpv_set_option_string(m_thumbMpv, "vd-lavc-threads", "2");
        mpv_set_option_string(m_thumbMpv, "vd-lavc-fast", "yes");
        mpv_set_option_string(m_thumbMpv, "vd-lavc-dr", "no");
        mpv_set_option_string(m_thumbMpv, "framedrop", "no");
        mpv_set_option_string(m_thumbMpv, "hr-seek-framedrop", "no");
        mpv_set_option_string(m_thumbMpv, "screenshot-format", "jpeg");
        mpv_set_option_string(m_thumbMpv, "screenshot-jpeg-quality", "75");
        mpv_set_option_string(m_thumbMpv, "screenshot-high-bit-depth", "no");
        mpv_set_option_string(m_thumbMpv, "osc", "no");
        mpv_set_option_string(m_thumbMpv, "osd-bar", "no");

        // FIX: detect thumbnail engine startup failure instead of silently
        // keeping a non-initialized handle.
        if (mpv_initialize(m_thumbMpv) < 0) {
            mpv_destroy(m_thumbMpv);
            m_thumbMpv = nullptr;
        }
    } else if (m_thumbMpv) {
        // No host window — the thumbnail engine cannot render, drop it.
        mpv_destroy(m_thumbMpv);
        m_thumbMpv = nullptr;
    }

    // FIX: never throw on temp path problems; namespaced by PID so parallel
    // processes (e.g. a second user session) never share the same JPEG file.
    std::error_code ec;
    std::filesystem::path tempBase = std::filesystem::temp_directory_path(ec);
    if (ec) {
        tempBase = std::filesystem::path(L".");
        ec.clear();
    }
    std::filesystem::path tempDir = tempBase / (L"PerdangaVSP_Thumbs_" + std::to_wstring(GetCurrentProcessId()));
    std::filesystem::create_directories(tempDir, ec);
    m_tempThumbPath = (tempDir / "thumb_worker.jpg").string();

    m_running.store(true, std::memory_order_release);
    m_eventThread = std::thread(&MpvPlayer::EventLoop, this);
    m_thumbThread = std::thread(&MpvPlayer::ThumbnailLoop, this);
    return true;
}

void MpvPlayer::Destroy() {
    m_running.store(false, std::memory_order_release);
    {
        std::lock_guard<std::mutex> lock(m_thumbMutex);
        m_thumbCv.notify_all();
    }
    if (m_mpv) {
        mpv_wakeup(m_mpv);
    }
    if (m_thumbMpv) {
        mpv_wakeup(m_thumbMpv);
    }
    if (m_eventThread.joinable()) {
        m_eventThread.join();
    }
    if (m_thumbThread.joinable()) {
        m_thumbThread.join();
    }
    if (m_thumbMpv) {
        mpv_destroy(m_thumbMpv);
        m_thumbMpv = nullptr;
    }
    if (m_thumbHwnd) {
        DestroyWindow(m_thumbHwnd);
        m_thumbHwnd = NULL;
    }
    if (m_mpv) {
        mpv_destroy(m_mpv);
        m_mpv = nullptr;
    }
}

void MpvPlayer::SetEventCallback(EventCallback cb) {
    std::lock_guard<std::mutex> lock(m_cbMutex);
    m_eventCallback = std::move(cb);
}

void MpvPlayer::LoadFile(const std::string& filePath) {
    if (!m_mpv) return;
    const char* cmd[] = { "loadfile", filePath.c_str(), "replace", NULL };
    mpv_command_async(m_mpv, 0, cmd);

    // Sync file to the thumbnail worker
    if (m_thumbMpv) {
        std::lock_guard<std::mutex> lock(m_thumbMutex);
        m_currentThumbFilePath = filePath;
        const char* tcmd[] = { "loadfile", filePath.c_str(), "replace", NULL };
        mpv_command_async(m_thumbMpv, 0, tcmd);
        mpv_set_property_string(m_thumbMpv, "pause", "yes");
    }
}

void MpvPlayer::RequestThumbnail(double time) {
    std::lock_guard<std::mutex> lock(m_thumbMutex);
    m_pendingThumbTime = time;
    m_hasPendingThumbRequest = true;
    m_thumbCv.notify_one();
}

void MpvPlayer::ThumbnailLoop() {
    while (m_running.load(std::memory_order_acquire)) {
        double targetTime = -1.0;
        {
            std::unique_lock<std::mutex> lock(m_thumbMutex);
            m_thumbCv.wait(lock, [this]() {
                return !m_running.load(std::memory_order_acquire) || m_hasPendingThumbRequest;
            });
            if (!m_running.load(std::memory_order_acquire)) break;
            targetTime = m_pendingThumbTime;
            m_hasPendingThumbRequest = false;
        }

        if (!m_thumbMpv || targetTime < 0) continue;

        // Perform seek on the thumbnail worker
        std::string timeStr = std::to_string(targetTime);
        const char* seekCmd[] = { "seek", timeStr.c_str(), "absolute+keyframes", NULL };
        mpv_command(m_thumbMpv, seekCmd);

        // Wait up to 150ms for the frame to be ready
        int waitCount = 0;
        while (waitCount < 15) {
            mpv_event* ev = mpv_wait_event(m_thumbMpv, 0.01);
            if (!m_running.load(std::memory_order_acquire)) break;
            if (ev && (ev->event_id == MPV_EVENT_PLAYBACK_RESTART || ev->event_id == MPV_EVENT_SEEK)) {
                break;
            }
            waitCount++;
        }

        // Capture frame to a temporary JPEG
        const char* ssCmd[] = { "screenshot-to-file", m_tempThumbPath.c_str(), "video", NULL };
        if (mpv_command(m_thumbMpv, ssCmd) >= 0) {
            std::ifstream file(m_tempThumbPath, std::ios::binary);
            if (file.is_open()) {
                std::vector<unsigned char> buffer(std::istreambuf_iterator<char>(file), {});
                file.close();
                if (!buffer.empty()) {
                    std::string b64 = Base64Encode(buffer.data(), buffer.size());
                    std::string jsonStr = "{\"type\":\"thumbnail-ready\",\"time\":" + std::to_string(targetTime) + ",\"data\":\"data:image/jpeg;base64," + b64 + "\"}";
                    std::lock_guard<std::mutex> lock(m_cbMutex);
                    if (m_eventCallback) {
                        m_eventCallback(jsonStr);
                    }
                }
            }
        }
    }
}

void MpvPlayer::Command(const std::vector<std::string>& args) {
    if (!m_mpv || args.empty()) return;
    std::vector<const char*> cargs;
    cargs.reserve(args.size() + 1);
    for (const auto& a : args) cargs.push_back(a.c_str());
    cargs.push_back(NULL);
    mpv_command_async(m_mpv, 0, cargs.data());
}

void MpvPlayer::Seek(double time, bool absolute, bool exact) {
    if (!m_mpv) return;
    std::string timeStr = std::to_string(time);
    std::string mode;
    if (absolute) {
        mode = exact ? "absolute+exact" : "absolute+keyframes";
    } else {
        mode = exact ? "relative+exact" : "relative+keyframes";
    }
    const char* cmd[] = { "seek", timeStr.c_str(), mode.c_str(), NULL };
    mpv_command_async(m_mpv, 0, cmd);
}

void MpvPlayer::SetProperty(const std::string& name, const std::string& value) {
    if (!m_mpv) return;
    mpv_set_property_string(m_mpv, name.c_str(), value.c_str());
}

void MpvPlayer::SetPropertyBool(const std::string& name, bool value) {
    if (!m_mpv) return;
    int v = value ? 1 : 0;
    mpv_set_property(m_mpv, name.c_str(), MPV_FORMAT_FLAG, &v);
    if (name == "pause") {
        m_isPaused.store(value, std::memory_order_relaxed);
    }
}

void MpvPlayer::SetPropertyDouble(const std::string& name, double value) {
    if (!m_mpv) return;
    mpv_set_property(m_mpv, name.c_str(), MPV_FORMAT_DOUBLE, &value);
}

void MpvPlayer::ObserveProperty(const std::string& name) {
    if (!m_mpv) return;
    mpv_observe_property(m_mpv, 0, name.c_str(), MPV_FORMAT_NODE);
}

std::string MpvPlayer::NodeToJson(const mpv_node* node) {
    if (!node) return "null";
    switch (node->format) {
        case MPV_FORMAT_STRING:
            return "\"" + Utils::EscapeJson(node->u.string ? node->u.string : "") + "\"";
        case MPV_FORMAT_FLAG:
            return node->u.flag ? "true" : "false";
        case MPV_FORMAT_INT64:
            return std::to_string(node->u.int64);
        case MPV_FORMAT_DOUBLE:
            return std::to_string(node->u.double_);
        case MPV_FORMAT_NODE_ARRAY: {
            std::string s;
            s.reserve(64);
            s += "[";
            for (int i = 0; i < node->u.list->num; i++) {
                if (i > 0) s += ",";
                s += NodeToJson(&node->u.list->values[i]);
            }
            s += "]";
            return s;
        }
        case MPV_FORMAT_NODE_MAP: {
            std::string s;
            s.reserve(128);
            s += "{";
            for (int i = 0; i < node->u.list->num; i++) {
                if (i > 0) s += ",";
                s += "\"" + Utils::EscapeJson(node->u.list->keys[i]) + "\":" + NodeToJson(&node->u.list->values[i]);
            }
            s += "}";
            return s;
        }
        default:
            return "null";
    }
}

void MpvPlayer::EventLoop() {
    while (m_running.load(std::memory_order_acquire)) {
        mpv_event* event = mpv_wait_event(m_mpv, -1);
        if (!m_running.load(std::memory_order_acquire) || !event || event->event_id == MPV_EVENT_NONE) {
            continue;
        }

        std::string jsonStr;
        if (event->event_id == MPV_EVENT_PROPERTY_CHANGE) {
            mpv_event_property* prop = static_cast<mpv_event_property*>(event->data);
            if (prop && prop->name) {
                if (strcmp(prop->name, "time-pos") == 0) {
                    if (prop->format == MPV_FORMAT_DOUBLE && prop->data) {
                        double curTime = *static_cast<double*>(prop->data);
                        ULONGLONG now = GetTickCount64();
                        if (std::abs(curTime - m_lastReportedTime) < 0.05 && (now - m_lastTimeReportTick) < 33) {
                            continue;
                        }
                        m_lastReportedTime = curTime;
                        m_lastTimeReportTick = now;
                    }
                }

                std::string valStr;
                if (prop->format == MPV_FORMAT_NODE) {
                    valStr = NodeToJson(static_cast<mpv_node*>(prop->data));
                } else if (prop->format == MPV_FORMAT_DOUBLE) {
                    valStr = std::to_string(*static_cast<double*>(prop->data));
                } else if (prop->format == MPV_FORMAT_FLAG) {
                    bool flagVal = (*static_cast<int*>(prop->data)) != 0;
                    valStr = flagVal ? "true" : "false";
                    if (strcmp(prop->name, "pause") == 0) {
                        m_isPaused.store(flagVal, std::memory_order_relaxed);
                    }
                } else if (prop->format == MPV_FORMAT_INT64) {
                    valStr = std::to_string(*static_cast<int64_t*>(prop->data));
                } else if (prop->format == MPV_FORMAT_STRING) {
                    valStr = "\"" + Utils::EscapeJson(*static_cast<char**>(prop->data)) + "\"";
                } else {
                    valStr = "null";
                }

                if (strcmp(prop->name, "track-list") == 0 || strcmp(prop->name, "chapter-list") == 0) {
                    valStr = "\"" + Utils::EscapeJson(valStr) + "\"";
                }

                jsonStr.reserve(64 + strlen(prop->name) + valStr.length());
                jsonStr += "{\"type\":\"property-change\",\"name\":\"";
                jsonStr += prop->name;
                jsonStr += "\",\"value\":";
                jsonStr += valStr;
                jsonStr += "}";
            }
        } else if (event->event_id == MPV_EVENT_FILE_LOADED) {
            m_lastReportedTime = -1.0;
            jsonStr = "{\"type\":\"file-loaded\"}";
        } else if (event->event_id == MPV_EVENT_END_FILE) {
            mpv_event_end_file* eef = static_cast<mpv_event_end_file*>(event->data);
            jsonStr = "{\"type\":\"end-file\",\"reason\":" + std::to_string(eef ? eef->reason : 0) + "}";
        }

        if (!jsonStr.empty()) {
            std::lock_guard<std::mutex> lock(m_cbMutex);
            if (m_eventCallback) {
                m_eventCallback(jsonStr);
            }
        }
    }
}