# Changelog
1.14.0:
- update root files handling to fit the new pz-scripts-data format and [Root Files](https://pz-wiki-modding.github.io/PZ-API-Docs/scripts/root_files.html) PZ API Docs
- improved diagnostics
  - diagnostics now use keys then metadata are retrieved
  - this means tags are now supported (unecessary=greyed out, deprecated=crossed)
  - next to diagnostics is now shown "ZedScripts" and the ID of the diagnostic
  - list diagnostic types by using the new command "ZedScripts: Show Diagnostic IDs"
  - the list of diagnostic IDs is now in [DiagnosticTypesList](DiagnosticTypesList.md) and is automatically generated every updates
  - tweaked some diagnostics
  - fixed duplicated diagnostics
  - fixed disabling diagnostics not working properly
- added icons to ZedScripts files (icon themes that add icons to .txt files will overwrite it)
- added new configuration option to toggle file decorators (adds a "Z" marker next to files that are ZedScripts)
- updated packages
- fixed status bar tooltip showing "Loaded" when loading, now shows "Loading..."

1.13.1:
- fix translation diagnostics spamming errors
- moved logging system to an output channel instead of console

1.13.0:
- implement translation diagnostics 
  - for script block translations (items, craftRecipe)
  - for some parameters (i.e. category of craftRecipe)
  - ability to CTRL + Left click the ID of blocks or value of parameters that link to a translation
  - takes into account the current active version of the file to find the proper translation file
  - takes into account workspace and libraries translation files
  - the default game path has been modified to point to the media folder instead of media/scripts, to properly find the vanilla translation files
- added new configuration parameter to not parse specific files based on provided regex patterns
  - notably used to skip parsing some very large documents that can slow down the loading process of the extension
- cleanup some file headers and some variables
- required elements now automatically reload when changing configurations
  - diagnostic rules changes will revalidate workspace
  - library modifications will reload libraries
  - parsing rule changes and data source will reload everything
- tweak auto completion to trigger on any key strokes
- improve export to JSON command
  - now request a file path to chose where to save the export
  - only exports workspace, not libraries
- fix console spam

1.12.0:
- major rewrite of the workspace and library handling
  - now each script files get their folder recognized, that is their versioning folder (42, 42.20, common, pre-build 41 etc)
  - references to other blocks will only search in the valid folders, that is for 42.20, files in 42 are not loaded so references there can't be used
  - the common folder script files will use the latest version (so 42.20 for example, if 42.20 and 42 are provided)
- added a status bar item to show the current workspace and its loading state
  - indicates when pre-loading libraries and workspaces
  - indicates when loading libraries and workspaces
  - indicates when validating workspace
  - indicates when running normally
- indentation of the formatter will use the file settings (no more fixed 4 spaces)
  - tabs / spaces
  - 2, 3, 4 spaces...
- improved the language highlight a bit for some edge cases ([#22](https://github.com/PZ-Wiki-Modding/ZedScripts/issues/22))
- diagnostics for extra closing bracket ([#19](https://github.com/PZ-Wiki-Modding/ZedScripts/issues/19))
- tweaked the hovering description of parameters and blocks, now no longer links to the wiki but only to the PZ API Docs
- extra fixes here and there

1.11.0:
- cleanup README, [CONTRIBUTING](CONTRIBUTING.md) and [LICENSE](LICENSE) files
- reordered files for easier management and expansion
- cleanup some outdated files and improve data access to not require a pre-commit anymore
- fixed npm install process
- validation now happens AFTER data parsing
- added noAutoImport property of script parameters type
- fixed workspace parsing to only include valid script files and manually set files to ZedScripts. Should make load time faster
- definitions access of script blocks towards parameters that reference them (ctrl + left click on ID or block name)
- added quick fix for missing ID
- reworked formatter ([#17](https://github.com/PZ-Wiki-Modding/ZedScripts/issues/17))

1.10.11:
- hotfixes
- fixed decorations not being properly updated when swapping file
- fix diagnostics for valid empty empty values for block references
- improve hovering for parameters taking block references

1.10.10:
- hotfixes

1.10.9:
- hotfixes

1.10.8:
- update dataset

1.10.7:
- added export of script blocks to JSON file with the command "ZedScripts: Export to JSON" in the Command Palette (Ctrl + Shift + P) [EXPERIMENTAL, LIKELY TO BE CHANGED]
- fixed a major issue that made the parser fail and stop ZedScripts working for some files with specific content
- tweak syntax highlighting, now block references are all highlighted with the same color
- improved performances by adding a delay before making diagnostics
- remove newly deleted files from the cached data to avoid issues with missing/duplicate refs

1.10.6:
- adjust to new ScriptsDocs link

1.10.4:
- fixed some diagnostics regarding dependent parameters
- large dataset update from pz-scripts-data

1.10.3:
- adjust type handling to new format from pz-scripts-data
- removed wip notice on unknown parameters since most parameters are properly documented now
- fixed forbidden values not being properly detected due to them not being purely handled as strings for comparison with parser output
- fixed link to pz-scripts-data and ScriptsDocs to new repository link

1.10.2:
- adjusted syntax highlight to accept `block id{` as a valid block declaration

1.10.1:
- fix documentation link for parameters

1.10.0:
- Proper libraries handling
  - An option for the extension allows you to link to libraries that contain scripts. These will be parsed when launching the extension
  - These parsed libraries provide access to blocks that are referenced to (see following point)
  - Later down the line, diagnostics for duplicate blocks across libraries and workspace will be added (ignoring those that accept [soft overrides](https://pzwiki.net/wiki/Scripts#Soft_overrides))
  - Your whole workspace is parsed now too when launching the extension
- Added block refs for parameters
  - diagnostics for block refs not found, multiple block refs found
  - go to definition for block refs (CTRL + click on the value)
- Type handling for array values (`value1;value2;value3`) of parameters
- Type handling for object values (`key:value;key:value`) of parameters
- Improved type hovering for arrays and objects
- Removed deprecated translation diagnostics since Build 42 versions that supported pre-JSON era are no longer available
- Diagnostics for block IDs that shouldn't contain spaces

1.9.5:
- better deprecated parameter diagnostic handling. It now indicates the version, the replacement parameter if any, and a description which explains the deprecation
- added quick fixes for some diagnostics. Currently only for: deprecated parameter with replacement, missing comma and wrong comma format
- tweaked the highlight of blocks

1.9.4:
- swap config for forced local data to true by default, since the extension is actively being developped and worked on, should reduce problems when the format changes for the data

1.9.3:
- improved the logo
- added tests for script files identification to run
- add diagnostics for dependent parameters and type (parameters that require another parameter to be present with a specific value)
- improved handling for types of parameters
- adjusted parameter-value combo identification to take `//` comments in the parameter name since those are not valid for scripts
- added some script blocks to be ignored for parsing
- implemented handling for optional ID for blocks
- added a link to the [ScriptsDocs](https://pzwiki.net/wiki/ScriptsDocs) in the hovering of blocks and parameters
- fix hovering showing description and wiki page link for unrecognized parameters
- fix small mistake which made some wiki page links broken

1.9.2:
- patched any file being marked as a script file by default

1.9.1:
- properly handle comments /* */ in script files now by replacing them with whitespaces before parsing, which allows to keep the correct character positions for diagnostics and syntax highlighting

1.9.0:
- update to new document files "ROOT-" files from pz-scripts-data
- improved diagnostics for script files by splitting their handling into different document block types. This allows for specific parameters and child blocks to be defined for each document types (sandbox-options.txt, mod.info, generic script files and more)
- now properly detects script files for automatic language activation
- fixed some syntax highlighting and diagnostic issues for script blocks

1.8.1:
- fix missing changelog

1.8.0:
- added a master switch to disable all diagnostics at once
- added ability to disable specific diagnostics via configuration

1.7.1:
- minor handling tweaks for the file activation
- force translation data to use an old copy of the translation data which dates pre-42.15, and force fetch to retrieve from an old copy from the new translation files dataset
