# ZedScripts

This VS Code extension provides comprehensive support for Project Zomboid's [scripts](https://pzwiki.net/wiki/Scripts), also known as ZedScripts, including syntax highlighting, auto-formatting, and diagnostics for items, recipes, and other script blocks. This extension is a fork of [pz-syntax-extension](https://github.com/cyberbobjr/pz-syntax-extension) with an almost complete rewrite and many added features, notably the usage of a common data repository.

> [!NOTE]
> This extension is designed specifically for Build 42.

## Features
- Syntax highlighting for Project Zomboid script files.
- Auto-formatting of script files to maintain consistent style.
- Diagnostics for:
  - Common errors in script definitions;
  - Mandatory, wrong, deprecated parameters;
  - Wrong types and values;
  - Missing commas;
  - And more!
- Hovering tooltips with additional information about script elements.
- Auto-completion for script elements based on the Project Zomboid data (automatic mandatory parameters and subblocks).
- Detection for script blocks used in wrong parent blocks.
- Missing IDs detection.
- Last updated Scripts data via the [pz-scripts-data](https://github.com/pz-wiki-modding/pz-scripts-data) repository, which is automatically fetched every 12 hours and cached. Currently needs to be manually actived in the extension settings.

![ZedScripts syntax highlighting preview in VS Code](images/ZedScripts_preview1.png)
![ZedScripts parameter hovering preview in VS Code](images/ZedScripts_preview2.png)
![ZedScripts diagnostics preview in VS Code](images/ZedScripts_preview3.png)

## Usage
- Install the extension from the VS Code Marketplace.
- Open a `.txt` script file.
- Press Ctrl + Shift + P and select "Change Language Mode".
- Choose from the list one of the following languages:
  - "ZedScripts" for scripts files
  - "TranslationScripts" for translation files

You can set the extension to automatically downloads the latest script data from the [pz-scripts-data](https://github.com/pz-wiki-modding/pz-scripts-data) repository via the extension settings, it will cache the data for 12 hours, which it will fetch once more after this time. If it doesn't manage to fetch this data, it will fall back to the bundled data with the extension, which may get outdated until the next update.

You can fetch data manually by running the command "ZedScripts: Force fetch Scripts Data" from the Command Palette (Ctrl + Shift + P). This won't directly update the diagnostics (due to a bug to fix, see [issue #2](https://github.com/pz-wiki-modding/ZedScripts/issues/2)) so you will have to restart VSCode.

## Configuration
By default the Project Zomboid directory is `C:\Program Files (x86)\Steam\steamapps\common\ProjectZomboid\media\scripts`, but you can change this in the settings of the extension. The extension automatically retrieves the vanilla item scripts. However this is a part of the old code I've yet to touch, so I do not know how well it works.

You can disable a specific diagnostic by adding its ID to the `zedScripts.disabledDiagnostics` setting. Alternatively, you can disable all diagnostics via the `zedScripts.disableAllDiagnostics` setting. Below are all the available diagnostics for scripts:

| ID | Description |
|---|---|
| `MISSING_COMMA` | Missing comma. |
| `INVALID_COMMA` | Invalid comma. |
| `UNMATCHED_BRACE` | Missing closing bracket '}' for '{scriptBlock}' block. |
| `NOT_VALID_BLOCK` | '{scriptBlock}' is an unknown script block. |
| `MISSING_PARENT_BLOCK` | '{scriptBlock}' block must be inside a valid parent block: {parentBlocks}. |
| `HAS_PARENT_BLOCK` | '{scriptBlock}' block cannot be inside any parent block. |
| `WRONG_PARENT_BLOCK` | '{scriptBlock}' block cannot be inside parent block '{parentBlock}'. Valid parent blocks are: {parentBlocks}. |
| `MISSING_CHILD_BLOCK` | '{scriptBlock}' block must have child blocks: {childBlocks}. This might be intentional for soft overrides of an existing block. |
| `MISSING_ID` | '{scriptBlock}' block is missing an ID. |
| `HAS_ID` | '{scriptBlock}' block cannot have an ID. |
| `INVALID_ID` | '{scriptBlock}' block has an invalid ID '{id}'. Valid IDs are: {validIDs}. |
| `HAS_ID_IN_PARENT` | '{scriptBlock}' block cannot have an ID when inside parent block '{parentBlock}', only for: {invalidBlocks}. |
| `ID_CANNOT_CONTAIN_SPACES` | ID '{id}' of '{scriptBlock}' block cannot contain spaces. |
| `UNKNOWN_PARAMETER` | '{parameter}' is an unknown parameter for '{scriptBlock}' block. [WIP: not every parameters are documented yet] |
| `MISSING_PARAMETER` | '{scriptBlock}' block is missing required parameter(s): {parameters}. |
| `DUPLICATE_PARAMETER` | '{parameter}' is defined multiple times in '{scriptBlock}' block. |
| `MISSING_VALUE` | Missing a value. |
| `INVALID_PARAMETER_VALUE` | '{parameter}' has an invalid value '{value}'. |
| `DEPRECATED_PARAMETER` | '{parameter}' parameter in '{scriptBlock}' block is deprecated. |
| `WRONG_VALUE` | '{value}' is not a valid value for parameter '{parameter}'. Valid values are: {validValues}. |
| `WRONG_VALUES` | Invalid values for parameter '{parameter}' ({invalidValues}). Valid values are: {validValues}. |
| `MISSING_DEPENDENT_PARAMETER` | '{parameter}' parameter requires dependent parameter '{dependentParameter}' to be present. |
| `DEPENDENT_PARAMETER_WRONG_VALUE` | '{parameter}' requires dependent parameter '{dependentParameter}' to have a valid value. Current value is '{value}' but valid values are: {dependentValues}. |
| `INVALID_TYPE_FOR_VALUE` | Type '{type}' of '{parameter}' is invalid for value '{value}'. Expected type is '{expectedType}'. |
| `INVALID_TYPE_FOR_VALUES_OBJECT` | Values {invalidTypeValues} of '{parameter}' don't have a valid type. Expected types are '{keyType}' for keys and '{valueType}' for values, with '{keyValueSeparator}' as separator. |
| `INVALID_OBJECT_FORMAT` | Values {values} for parameter '{parameter}' do not follow the expected 'key{keyValueSeparator}value' format. |
| `NO_BLOCK_REF` | No block reference found in value '{value}' for parameter '{parameter}'. Something might be wrong with the value or the parameter data definition. |
| `CANNOT_PROVIDE_MODULE` | Referencing a block cannot be done with the full type ('module.block') for '{parameter}'. Make sure the value only contains the ID of the block to reference. This usually means the game defaults to a 'Base' module. |
| `INVALID_BLOCK_REF` | The block reference '{value}' for parameter '{parameter}' does not match any existing block. Make sure the referenced block exists and is correctly spelled ('module.id'). |
| `MULTIPLE_BLOCK_REFS` | Multiple block references found for '{value}' for parameter '{parameter}'. Make sure duplicate block references ('module.id') are not present. |
| `INVALID_AMOUNT` | '{amount}' is not a valid amount for '{type}'. |
| `INTEGER_AMOUNT` | '{amount}' should be an integer for '{type}'. |
| `DUPLICATE_PROPERTY` | '{property}' is provided multiple times. |
| `MISSING_ONEOF_PROPERTY` | '{type}' is missing at least one of the following properties: {properties}. |
| `NO_DOTS_ITEM` | An item type (ID) cannot have dots '.' in its name. ({value}) |
| `MISSING_MODULE` | The provided item type (ID) is missing its module part: 'module.type'. ({value}) |
| `ALL_WITH_OTHERS` | '*' was provided along with other item types. '*' must be used alone. |
| `SPACES_IN_ITEM` | An item full type (module and ID) cannot contain spaces. ({value}) |
| `INVALID_VALUE` | '{value}' is not a valid value for '{property}'. Valid values are: {validValues}. |
| `UNMATCHED_CODE` | Unmatched language code between folder name '{folderCode}' and file name '{fileCode}'. They should be the same. |
| `NON_EXISTENT_CODE` | The language code '{code}' does not exist. Valid codes are: {validCodes}. |
| `IN_FIRST_LINE` | Translation key-value pairs cannot be in the first line of the file as it is not parsed. |
| `UNECESSARY_COMMA` | Unnecessary comma. Translation files do not need a comma compared to script files. |
| `INVALID_FILE_PREFIX` | The file '{filePrefix}' is not a valid translation file prefix. Make sure to separate the language code and prefix with an underscore. Valid prefixes are: {validPrefixes}. |
| `MISSING_QUOTES` | Missing quotes around value. |
| `MISSING_PREFIX` | Missing prefix {prefix} for key '{key}'. |
| `_DEBUG` | This is a debug diagnostic with value: {value}. |

## Build
To build the extension, run the following command in the terminal:
```bash
npm run build
```

Alternatively, a Makefile is provided with a `build` target that runs the same command:
```bash
make build
```

## License
This project is licensed under the MIT License. See the LICENSE file for details.

## Changelog
With each update, the extension fetches the latest data from the pz-scripts-data repository and make a local copy of it. If you're having issues, it might be because of outdated data, so make sure to fetch the latest data.

1.10.7:
- added export of script blocks to JSON file with the command "ZedScripts: Export to JSON" in the Command Palette (Ctrl + Shift + P)
- fixed a major issue that made the parser fail and stop ZedScripts working for some files with specific content

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
