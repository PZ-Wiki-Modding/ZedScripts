/**
 * Used to store default text messages for various communications with the users.
 */
export enum DefaultText {
    SCRIPT_BLOCK_DESCRIPTION = "No description available for this script block.",
    PARAMETER_DESCRIPTION = "No description available for this parameter.",
    MORE_INFORMATION = "*For more information, visit the [ScriptsDocs]({scriptsDoc}).*",

    DEPRECATION_REPLACEMENT = "This parameter is deprecated and replaced by '{replacement}'.",
    DEPRECATION_REPLACEMENT_VERSION = "This parameter is deprecated since version '{version}' and replaced by '{replacement}'.",
    DEPRECATION_VERSION = "This parameter is deprecated since version '{version}'.",

    COMMAND_CACHE_RESET_SUCCESS = "Script data cache has been reset.",
    COMMAND_CACHE_RESET_FAILED = "Project Zomboid Scripts Data fetch failed, using cached or default extension data. Information might be outdated.",

    COMMAND_EXPORT_TITLE = "Export Scripts Blocks",
    COMMAND_EXPORT_SUCCESS = "Exported script blocks to [{filename}](command:vscode.open?%5B%22{fileUri}%22%5D).",
    COMMAND_EXPORT_FAILED = "Failed to export script blocks: {errorMessage}.",
    COMMAND_DIAGNOSTIC_TYPES_QUICKPICK = "Select a diagnostic type to copy to clipboard.",

    LIBRARY_LOAD_FAILED = "Library folder does not exist or is not accessible: {folder}",
    WORKSPACE_LOAD_FAILED = "Workspace folder does not exist or is not accessible: {folder}",

    STATUS_BAR_TOOLTIP_TITLE = "**ZedScripts**",
    STATUS_BAR_TOOLTIP_LOADING = "Loading...",
    STATUS_BAR_TOOLTIP_PROCESSING = "Processing files from {workspaceType}.",
    STATUS_BAR_TOOLTIP_LOADED = "Loaded.",
}