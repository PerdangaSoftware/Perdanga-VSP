#include "mpv_player.h"
#include "utils.h"
#include <iostream>
#include <sstream>
#include <cmath>
#include <filesystem>

MpvPlayer::MpvPlayer() {}

MpvPlayer::~MpvPlayer() {
    Destroy();
}

bool MpvPlayer::Initialize(HWND videoHwnd) {
    if (m_mpv) return true;

    m_mpv = mpv_create();
    if (!m_mpv) return false;

    int64_t wid = (int64_t)(intptr_t)videoHwnd;
    mpv_set_option(m_mpv, "wid", MPV_FORMAT_INT64, &wid);

    // Графический конвейер D3D11 и аппаратное декодирование
    mpv_set_option_string(m_mpv, "vo", "gpu");
    mpv_set_option_string(m_mpv, "gpu-api", "d3d11");
    mpv_set_option_string(m_mpv, "hwdec", "auto-safe");
    mpv_set_option_string(m_mpv, "hwdec-codecs", "all");
    mpv_set_option_string(m_mpv, "vd-lavc-dr", "yes");
    mpv_set_option_string(m_mpv, "d3d11-flip", "yes");
    
    // Аппаратный VSync для исключения тиринга и неравномерности кадров
    mpv_set_option_string(m_mpv, "d3d11-sync-interval", "1");
    mpv_set_option_string(m_mpv, "video-sync", "display-resample");
    mpv_set_option_string(m_mpv, "interpolation", "no");

    // Оптимизированный качественный рендеринг субтитров (Segoe UI с четкой обводкой)
    mpv_set_option_string(m_mpv, "sub-font", "Segoe UI");
    mpv_set_option_string(m_mpv, "sub-font-size", "44");
    mpv_set_option_string(m_mpv, "sub-border-size", "2.4");
    mpv_set_option_string(m_mpv, "sub-shadow-offset", "1.0");
    mpv_set_option_string(m_mpv, "sub-auto", "fuzzy");

    // Кэш шейдеров на диске для предотвращения микрофризов
    PWSTR localAppData = NULL;
    if (SUCCEEDED(SHGetKnownFolderPath(FOLDERID_LocalAppData, 0, NULL, &localAppData))) {
        std::filesystem::path cacheDir = std::filesystem::path(localAppData) / L"Perdanga VSP" / L"shader-cache";
        CoTaskMemFree(localAppData);
        std::error_code ec;
        std::filesystem::create_directories(cacheDir, ec);
        std::string cacheDirUtf8 = Utils::Utf16ToUtf8(cacheDir.wstring());
        mpv_set_option_string(m_mpv, "gpu-shader-cache-dir", cacheDirUtf8.c_str());
    }

    // Буферизация потока
    mpv_set_option_string(m_mpv, "cache", "yes");
    mpv_set_option_string(m_mpv, "demuxer-max-bytes", "268435456");
    mpv_set_option_string(m_mpv, "demuxer-max-back-bytes", "67108864");
    mpv_set_option_string(m_mpv, "demuxer-readahead-secs", "20");
    mpv_set_option_string(m_mpv, "hr-seek-framedrop", "yes");
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
    ObserveProperty("estimated-vf-fps");
    ObserveProperty("dwidth");
    ObserveProperty("dheight");

    m_running = true;
    m_eventThread = std::thread(&MpvPlayer::EventLoop, this);
    return true;
}

void MpvPlayer::Destroy() {
    m_running = false;
    if (m_mpv) {
        mpv_wakeup(m_mpv);
    }
    if (m_eventThread.joinable()) {
        m_eventThread.join();
    }
    if (m_mpv) {
        mpv_destroy(m_mpv);
        m_mpv = nullptr;
    }
}

void MpvPlayer::SetEventCallback(EventCallback cb) {
    std::lock_guard<std::mutex> lock(m_cbMutex);
    m_eventCallback = cb;
}

void MpvPlayer::LoadFile(const std::string& filePath) {
    if (!m_mpv) return;
    const char* cmd[] = { "loadfile", filePath.c_str(), "replace", NULL };
    mpv_command_async(m_mpv, 0, cmd);
}

void MpvPlayer::Command(const std::vector<std::string>& args) {
    if (!m_mpv || args.empty()) return;
    std::vector<const char*> cargs;
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
        m_isPaused.store(value);
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
            std::string s = "[";
            for (int i = 0; i < node->u.list->num; i++) {
                if (i > 0) s += ",";
                s += NodeToJson(&node->u.list->values[i]);
            }
            return s + "]";
        }
        case MPV_FORMAT_NODE_MAP: {
            std::string s = "{";
            for (int i = 0; i < node->u.list->num; i++) {
                if (i > 0) s += ",";
                s += "\"" + Utils::EscapeJson(node->u.list->keys[i]) + "\":" + NodeToJson(&node->u.list->values[i]);
            }
            return s + "}";
        }
        default:
            return "null";
    }
}

void MpvPlayer::EventLoop() {
    while (m_running) {
        mpv_event* event = mpv_wait_event(m_mpv, -1);
        if (!m_running || !event || event->event_id == MPV_EVENT_NONE) continue;

        std::string jsonStr;
        if (event->event_id == MPV_EVENT_PROPERTY_CHANGE) {
            mpv_event_property* prop = (mpv_event_property*)event->data;
            if (prop && prop->name) {
                if (strcmp(prop->name, "time-pos") == 0) {
                    if (prop->format == MPV_FORMAT_DOUBLE && prop->data) {
                        double curTime = *(double*)prop->data;
                        ULONGLONG now = GetTickCount64();
                        if (std::abs(curTime - m_lastReportedTime) < 0.04 && (now - m_lastTimeReportTick) < 33) {
                            continue;
                        }
                        m_lastReportedTime = curTime;
                        m_lastTimeReportTick = now;
                    }
                }

                std::string valStr;
                if (prop->format == MPV_FORMAT_NODE) {
                    valStr = NodeToJson((mpv_node*)prop->data);
                } else if (prop->format == MPV_FORMAT_DOUBLE) {
                    valStr = std::to_string(*(double*)prop->data);
                } else if (prop->format == MPV_FORMAT_FLAG) {
                    bool flagVal = *(int*)prop->data != 0;
                    valStr = flagVal ? "true" : "false";
                    if (strcmp(prop->name, "pause") == 0) {
                        m_isPaused.store(flagVal);
                    }
                } else if (prop->format == MPV_FORMAT_INT64) {
                    valStr = std::to_string(*(int64_t*)prop->data);
                } else if (prop->format == MPV_FORMAT_STRING) {
                    valStr = "\"" + Utils::EscapeJson(*(char**)prop->data) + "\"";
                } else {
                    valStr = "null";
                }

                if (strcmp(prop->name, "track-list") == 0 || strcmp(prop->name, "chapter-list") == 0) {
                    valStr = "\"" + Utils::EscapeJson(valStr) + "\"";
                }

                jsonStr = "{\"type\":\"property-change\",\"name\":\"" + std::string(prop->name) + "\",\"value\":" + valStr + "}";
            }
        } else if (event->event_id == MPV_EVENT_FILE_LOADED) {
            m_lastReportedTime = -1.0;
            jsonStr = "{\"type\":\"file-loaded\"}";
        } else if (event->event_id == MPV_EVENT_END_FILE) {
            mpv_event_end_file* eef = (mpv_event_end_file*)event->data;
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