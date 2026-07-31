export enum DefaultText {
    SCRIPT_BLOCK_DESCRIPTION = "No description available for this script block.",
    PARAMETER_DESCRIPTION = "No description available for this parameter.",
    MORE_INFORMATION = "*For more information, visit the [ScriptsDocs]({scriptsDoc}).*",

    DEPRECATION_REPLACEMENT = "This parameter is deprecated and replaced by '{replacement}'.",
    DEPRECATION_REPLACEMENT_VERSION = "This parameter is deprecated since version '{version}' and replaced by '{replacement}'.",
    DEPRECATION_VERSION = "This parameter is deprecated since version '{version}'.",

    CACHE_RESET = "Script data cache has been reset.",
    CACHE_RESET_FAILED = "Project Zomboid Scripts Data fetch failed, using cached or default extension data. Information might be outdated.",

    LIBRARY_LOAD_FAILED = "Library folder does not exist or is not accessible: {folder}",
    WORKSPACE_LOAD_FAILED = "Workspace folder does not exist or is not accessible: {folder}",
}