cmake_minimum_required(VERSION 3.20)
project(PerdangaVSP LANGUAGES CXX RC)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_compile_definitions(UNICODE _UNICODE)

set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} /Os /Oi /GL /Gy /Gw /EHsc /DNDEBUG /fp:fast /GS-")
set(CMAKE_EXE_LINKER_FLAGS_RELEASE "${CMAKE_EXE_LINKER_FLAGS_RELEASE} /LTCG /OPT:REF /OPT:ICF /SUBSYSTEM:WINDOWS")

if(NOT CMAKE_SIZEOF_VOID_P EQUAL 8)
    message(FATAL_ERROR "PerdangaVSP currently supports x64 builds only.")
endif()

set(WEBVIEW2_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/packages/Microsoft.Web.WebView2")
if(NOT EXISTS "${WEBVIEW2_ROOT}/build/native/include/WebView2.h")
    message(STATUS "WebView2 SDK not found locally. Downloading from NuGet...")
    set(WEBVIEW2_URL "https://globalcdn.nuget.org/packages/microsoft.web.webview2.1.0.2903.40.nupkg")
    set(WEBVIEW2_ZIP "${CMAKE_BINARY_DIR}/webview2.zip")
    
    find_program(CURL_PROGRAM NAMES curl curl.exe PATHS "C:/Windows/System32")
    set(FETCH_SUCCESS FALSE)

    if(CURL_PROGRAM)
        execute_process(
            COMMAND "${CURL_PROGRAM}" -fSL --retry 3 -A "Mozilla/5.0" "${WEBVIEW2_URL}" -o "${WEBVIEW2_ZIP}"
            RESULT_VARIABLE CURL_STATUS
        )
        if(CURL_STATUS EQUAL 0 AND EXISTS "${WEBVIEW2_ZIP}")
            set(FETCH_SUCCESS TRUE)
        endif()
    endif()

    if(NOT FETCH_SUCCESS)
        execute_process(
            COMMAND powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol = 3072 -bor 12288; $wc = New-Object Net.WebClient; $wc.Headers.Add('User-Agent', 'Mozilla/5.0'); $wc.DownloadFile('${WEBVIEW2_URL}', '${WEBVIEW2_ZIP}')"
            RESULT_VARIABLE POWERSHELL_STATUS
        )
        if(POWERSHELL_STATUS EQUAL 0 AND EXISTS "${WEBVIEW2_ZIP}")
            set(FETCH_SUCCESS TRUE)
        endif()
    endif()

    if(NOT FETCH_SUCCESS)
        file(DOWNLOAD
            "${WEBVIEW2_URL}"
            "${WEBVIEW2_ZIP}"
            SHOW_PROGRESS
            TIMEOUT 120
            STATUS DOWNLOAD_STATUS
            TLS_VERIFY OFF
        )
        list(GET DOWNLOAD_STATUS 0 DOWNLOAD_RC)
        if(DOWNLOAD_RC EQUAL 0 AND EXISTS "${WEBVIEW2_ZIP}")
            set(FETCH_SUCCESS TRUE)
        endif()
    endif()

    if(NOT FETCH_SUCCESS)
        message(FATAL_ERROR "Failed to download the WebView2 SDK.")
    endif()

    message(STATUS "Extracting WebView2 SDK...")
    file(ARCHIVE_EXTRACT
        INPUT "${WEBVIEW2_ZIP}"
        DESTINATION "${WEBVIEW2_ROOT}"
    )
    file(REMOVE "${WEBVIEW2_ZIP}")
endif()

function(find_source_file OUT_VAR FILE_NAME)
    if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/src/${FILE_NAME}")
        set(${OUT_VAR} "${CMAKE_CURRENT_SOURCE_DIR}/src/${FILE_NAME}" PARENT_SCOPE)
    elseif(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/${FILE_NAME}")
        set(${OUT_VAR} "${CMAKE_CURRENT_SOURCE_DIR}/${FILE_NAME}" PARENT_SCOPE)
    else()
        message(FATAL_ERROR "Required file '${FILE_NAME}' not found in 'src/' or in the root directory!")
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
    "${CMAKE_CURRENT_SOURCE_DIR}/resource.rc"
)

find_library(MPV_LIB
    NAMES mpv libmpv libmpv-2
    PATHS
        "${CMAKE_CURRENT_SOURCE_DIR}/libmpv/lib"
        "${CMAKE_CURRENT_SOURCE_DIR}/libmpv"
    NO_DEFAULT_PATH
)

if(NOT MPV_LIB)
    set(MPV_LIB "mpv")
endif()

link_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}/libmpv/lib
    ${CMAKE_CURRENT_SOURCE_DIR}/libmpv
    ${WEBVIEW2_ROOT}/build/native/x64
)

add_executable(PerdangaVSP WIN32 ${SOURCES})

target_include_directories(PerdangaVSP PRIVATE
    "${CMAKE_CURRENT_SOURCE_DIR}/src"
    "${CMAKE_CURRENT_SOURCE_DIR}"
    "${CMAKE_CURRENT_SOURCE_DIR}/libmpv/include"
    "${WEBVIEW2_ROOT}/build/native/include"
)

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

add_custom_command(TARGET PerdangaVSP POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_directory
        "${CMAKE_CURRENT_SOURCE_DIR}/ui"
        "$<TARGET_FILE_DIR:PerdangaVSP>/ui"
)