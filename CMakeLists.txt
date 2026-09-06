cmake_minimum_required(VERSION 3.20)
project(PerdangaVSP LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Принудительная поддержка Unicode для предотвращения обрезки строк Windows API
add_definitions(-DUNICODE -D_UNICODE)

# Оптимизации компилятора MSVC для Release
set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} /O2 /Oi /GL /Gy /EHsc /DNDEBUG")
set(CMAKE_EXE_LINKER_FLAGS_RELEASE "${CMAKE_EXE_LINKER_FLAGS_RELEASE} /LTCG /OPT:REF /OPT:ICF /SUBSYSTEM:WINDOWS")

# Автоматическая загрузка WebView2 SDK через NuGet (если не установлен локально)
set(WEBVIEW2_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/packages/Microsoft.Web.WebView2")
if(NOT EXISTS "${WEBVIEW2_ROOT}/build/native/include/WebView2.h")
    message(STATUS "WebView2 SDK not found locally. Downloading from NuGet...")
    file(DOWNLOAD
        "https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/1.0.2903.40"
        "${CMAKE_BINARY_DIR}/webview2.zip"
        SHOW_PROGRESS
    )
    message(STATUS "Extracting WebView2 SDK...")
    file(ARCHIVE_EXTRACT
        INPUT "${CMAKE_BINARY_DIR}/webview2.zip"
        DESTINATION "${WEBVIEW2_ROOT}"
    )
    file(REMOVE "${CMAKE_BINARY_DIR}/webview2.zip")
endif()

# Поиск исходных файлов: проверяем папку src/, затем корень
function(find_source_file OUT_VAR FILE_NAME)
    if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/src/${FILE_NAME}")
        set(${OUT_VAR} "${CMAKE_CURRENT_SOURCE_DIR}/src/${FILE_NAME}" PARENT_SCOPE)
    elseif(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/${FILE_NAME}")
        set(${OUT_VAR} "${CMAKE_CURRENT_SOURCE_DIR}/${FILE_NAME}" PARENT_SCOPE)
    else()
        message(FATAL_ERROR "Required file '${FILE_NAME}' not found in 'src/' or in root directory!")
    endif()
endfunction()

find_source_file(SRC_MAIN "main.cpp")
find_source_file(SRC_MPV_CPP "mpv_player.cpp")
find_source_file(SRC_MPV_H "mpv_player.h")
find_source_file(SRC_UTILS_H "utils.h")

set(SOURCES
    ${SRC_MAIN}
    ${SRC_MPV_CPP}
    ${SRC_MPV_H}
    ${SRC_UTILS_H}
)

include_directories(
    "${CMAKE_CURRENT_SOURCE_DIR}/src"
    "${CMAKE_CURRENT_SOURCE_DIR}"
    "${CMAKE_CURRENT_SOURCE_DIR}/libmpv/include"
    "${WEBVIEW2_ROOT}/build/native/include"
)

# Поиск файла импорта libmpv (.lib)
find_library(MPV_LIB
    NAMES mpv libmpv libmpv-2
    PATHS
        "${CMAKE_CURRENT_SOURCE_DIR}/libmpv/lib"
        "${CMAKE_CURRENT_SOURCE_DIR}/libmpv"
    NO_DEFAULT_PATH
)

if(NOT MPV_LIB)
    message(WARNING "MPV .lib import library not found automatically. Defaulting to 'mpv'.")
    set(MPV_LIB "mpv")
endif()

link_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}/libmpv/lib
    ${CMAKE_CURRENT_SOURCE_DIR}/libmpv
    ${WEBVIEW2_ROOT}/build/native/x64
)

add_executable(PerdangaVSP WIN32 ${SOURCES})

target_link_libraries(PerdangaVSP
    ${MPV_LIB}
    WebView2LoaderStatic
    shlwapi
    user32
    gdi32
    shell32
    ole32
    oleaut32
    advapi32
    version
)

# Копирование ресурсов UI после компиляции
add_custom_command(TARGET PerdangaVSP POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_directory
        "${CMAKE_CURRENT_SOURCE_DIR}/ui"
        "$<TARGET_FILE_DIR:PerdangaVSP>/ui"
)

# Копирование mpv dll
set(POSSIBLE_MPV_DLLS
    "${CMAKE_CURRENT_SOURCE_DIR}/libmpv/libmpv-2.dll"
    "${CMAKE_CURRENT_SOURCE_DIR}/libmpv/mpv.dll"
    "${CMAKE_CURRENT_SOURCE_DIR}/libmpv/lib/libmpv-2.dll"
    "${CMAKE_CURRENT_SOURCE_DIR}/libmpv/lib/mpv.dll"
)

foreach(DLL_PATH IN LISTS POSSIBLE_MPV_DLLS)
    if(EXISTS "${DLL_PATH}")
        get_filename_component(DLL_NAME "${DLL_PATH}" NAME)
        add_custom_command(TARGET PerdangaVSP POST_BUILD
            COMMAND ${CMAKE_COMMAND} -E copy_if_different
                "${DLL_PATH}"
                "$<TARGET_FILE_DIR:PerdangaVSP>/${DLL_NAME}"
        )
    endif()
endforeach()