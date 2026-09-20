cmake_minimum_required(VERSION 3.20)
project(PerdangaVSP LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Force Unicode Windows API usage to prevent string truncation issues
add_compile_definitions(UNICODE _UNICODE)

# MSVC Release optimizations
set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} /O2 /Oi /GL /Gy /EHsc /DNDEBUG")
set(CMAKE_EXE_LINKER_FLAGS_RELEASE "${CMAKE_EXE_LINKER_FLAGS_RELEASE} /LTCG /OPT:REF /OPT:ICF /SUBSYSTEM:WINDOWS")

# WebView2LoaderStatic is linked from the x64 package folder
if(NOT CMAKE_SIZEOF_VOID_P EQUAL 8)
    message(FATAL_ERROR "PerdangaVSP currently supports x64 builds only.")
endif()

# Automatic WebView2 SDK download via NuGet when not present locally
set(WEBVIEW2_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/packages/Microsoft.Web.WebView2")
if(NOT EXISTS "${WEBVIEW2_ROOT}/build/native/include/WebView2.h")
    message(STATUS "WebView2 SDK not found locally. Downloading from NuGet...")
    file(DOWNLOAD
        "https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/1.0.2903.40"
        "${CMAKE_BINARY_DIR}/webview2.zip"
        SHOW_PROGRESS
        TIMEOUT 120
        STATUS DOWNLOAD_STATUS
    )
    list(GET DOWNLOAD_STATUS 0 DOWNLOAD_RC)
    if(NOT DOWNLOAD_RC EQUAL 0)
        message(FATAL_ERROR "Failed to download the WebView2 SDK (error code: ${DOWNLOAD_RC}). Check your network connection.")
    endif()
    message(STATUS "Extracting WebView2 SDK...")
    file(ARCHIVE_EXTRACT
        INPUT "${CMAKE_BINARY_DIR}/webview2.zip"
        DESTINATION "${WEBVIEW2_ROOT}"
    )
    file(REMOVE "${CMAKE_BINARY_DIR}/webview2.zip")
endif()

# Locate source files: check the src/ folder first, then the project root
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
)

# mpv import library (.lib). Note: libmpv-2.dll ships without a .lib file —
# generate one (e.g. "lib /def:mpv.def /out:mpv.lib" or llvm-dlltool) and put
# it into libmpv/lib/ if the automatic lookup below fails.
find_library(MPV_LIB
    NAMES mpv libmpv libmpv-2
    PATHS
        "${CMAKE_CURRENT_SOURCE_DIR}/libmpv/lib"
        "${CMAKE_CURRENT_SOURCE_DIR}/libmpv"
    NO_DEFAULT_PATH
)

if(NOT MPV_LIB)
    message(WARNING "MPV import library not found automatically. Defaulting to 'mpv'. The link will fail unless mpv.lib is on the library path.")
    set(MPV_LIB "mpv")
endif()

# Must be called before add_executable to affect the target
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

# Copy UI resources after the build
add_custom_command(TARGET PerdangaVSP POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_directory
        "${CMAKE_CURRENT_SOURCE_DIR}/ui"
        "$<TARGET_FILE_DIR:PerdangaVSP>/ui"
)

# Copy the mpv runtime DLL next to the executable
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