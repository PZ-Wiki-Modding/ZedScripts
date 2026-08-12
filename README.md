[![Visual Studio Marketplace](https://img.shields.io/badge/Visual%20Studio%20Marketplace-Available-blue?style=for-the-badge&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=SimKDT.project-zomboid-scripts)
[![OpenVSX Registry](https://img.shields.io/open-vsx/dt/simkdt/project-zomboid-scripts?color=purple&label=OpenVSX%20Downloads&style=for-the-badge)](https://open-vsx.org/extension/SimKDT/project-zomboid-scripts)
[![License](https://img.shields.io/github/license/PZ-Wiki-Modding/ZedScripts?style=for-the-badge)](https://github.com/PZ-Wiki-Modding/ZedScripts/blob/main/LICENSE)

# ZedScripts

This VS Code extension provides comprehensive support for Project Zomboid's [scripts](https://pzwiki.net/wiki/Scripts), also known as ZedScripts, including syntax highlighting, auto-formatting, and diagnostics for items, recipes, and other script blocks. This extension is a fork of [pz-syntax-extension](https://github.com/cyberbobjr/pz-syntax-extension) with an almost complete rewrite and many added features, notably the usage of a common data repository.

> [!NOTE]
> This extension is designed specifically for Build 42.

## Features
- Syntax highlighting for Project Zomboid script files.
- Diagnostics for:
  - Common errors in script definitions;
  - Mandatory, wrong, deprecated parameters;
  - Wrong types and values;
  - Missing commas;
  - And more!
- Hovering tooltips with additional information about script elements.
- Auto-completion for script elements based on the Project Zomboid data (automatic mandatory parameters and subblocks).
- Auto-formatting script files to maintain consistent style. (Ctrl + Shift + I or right-click and select "Format Document")

Syntax highlight:
![ZedScripts syntax highlighting preview in VS Code](images/ZedScripts_preview1.png)
Diagnostics:
![ZedScripts diagnostics preview in VS Code](images/ZedScripts_preview3.png)
Parameter hovering:
![ZedScripts parameter hovering preview in VS Code](images/ZedScripts_preview2.png)

## Usage
- Install the extension from the VSCode Marketplace. The extension can take a few seconds to load the library data when you launch a VSCode instance.
- Open a `.txt` script file.
- The file should automatically be recognized as a Project Zomboid script file and diagnostics should be provided.

If your file isn't recognized as a Project Zomboid script file, it means it doesn't follow any of the currently [documented root files](https://pz-wiki-modding.github.io/PZ-API-Docs/scripts.html#root-files) conditions. You can still manually set the language mode to "ZedScripts" which will default the root file type to [ROOT-Scripts](https://pz-wiki-modding.github.io/PZ-API-Docs/scripts/roots/scripts.html):
- Press Ctrl + Shift + P and select "Change Language Mode".
- Choose "ZedScripts".

When anywhere in a script file, you press Ctrl + Space to show the auto-completion suggestions which will list all the possible script blocks and parameters within a specific block. 

You can hover different elements with your mouse to show additional information about them, including a link to the [ScriptsDocs](https://pzwiki.net/wiki/ScriptsDocs) page for that element.

When an error or warning appears, you can right click on it and select "Quick Fix" to see if a quick fix is available for that specific diagnostic.

## Configurations
### Libraries
You can provide a path to a set of libraries that contain scripts to provide as references for ZedScripts. These libraries will be parsed when launching the extension, and will provide access to blocks that are referenced to.

By default, the extension sets the default Project Zomboid install directory on a Windows system as a library, which is `C:\Program Files (x86)\Steam\steamapps\common\ProjectZomboid\media\scripts`. If on a different OS or installed elsewhere, you must provide the path to your Project Zomboid install directory. You can see [here](https://pzwiki.net/wiki/Game_files#Accessing_the_game_files) on how to find your Project Zomboid install directory.

### Diagnostics
You can disable a specific diagnostic entirely by adding its ID to the `ZedScripts.disabledDiagnostics` setting. Alternatively, you can disable all diagnostics via the `ZedScripts.disableAllDiagnostics` setting.

A full list of the available diagnostic types can be found in [DiagnosticTypesList](DiagnosticTypesList.md)

### Annotations
Thanks to the use of annotations, you can deactivate specific diagnostics for specific blocks and parameters. For blocks, annotations are in the following format:
```java
/*Disable as many diagnostics as you want for this block
 *@diagnostic-off:MISSING_COMMA
 *@diagnostic-off:NOT_VALID_BLOCK
 *
 * You can also disable multiple diagnostics in a single annotation
 *@diagnostic-off:WRONG_VALUES,SPACES_IN_ITEM
 *
 *You can also mark a block as a soft override of an existing block
 *@soft-override
 */
block ID
{
  ...
}
```

For parameters, annotations are in the following format:
```java
block ID
{
  param1 = value1, /*@diagnostic-off:WRONG_VALUES*/
  param2 = value2, /*@diagnostic-off:WRONG_VALUES,MISSING_COMMA*/
}
```

| Annotation                                          | Description                                              | Blocks | Parameters |
| --------------------------------------------------- | -------------------------------------------------------- | ------ | ---------- |
| `@diagnostic-off:<DIAGNOSTIC_ID1>,<DIAGNOSTIC_ID2>` | Disables specific diagnostics for the block or parameter | ✅      | ✅          |
| `@soft-override` (WIP)                              | Marks a block as a soft override of an existing block    | ✅      | ❌          |

> [!CAUTION]
> Do not disable diagnostics without a good reason, as they are important and point to actual issues in your scripts. Only use them for false positives.

### Data Sources
> [!CAUTION]
> This is an advanced feature which can affect the behavior of the extension.

The extension uses the [pz-scripts-data](https://github.com/pz-wiki-modding/pz-scripts-data) dataset to provide the latest information about Project Zomboid scripts. By default, a bundled version of the data is included with the extension, but you can also activate the automatic fetching of the latest data from the repository via the extension settings.

The data is cached for 12 hours, after which it will be fetched again. If the fetch fails, the extension will fall back to the bundled data. This could prove unstable if the dataset format changes.

You can fetch the data manually by running the command "ZedScripts: Force fetch Scripts Data" from the Command Palette (Ctrl + Shift + P). This won't directly update the diagnostics (due to a bug to fix, see [#2](https://github.com/pz-wiki-modding/ZedScripts/issues/2)) so you will have to restart VSCode.

## Build
First setup the project by installing the dependencies:
```bash
npm install
```

To build the extension, run the following command in the terminal:
```bash
npm run build
```

Alternatively, a Makefile is provided with a `build` target that runs the same command:
```bash
make build
```

## License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Changelog
You can find a full list of changes in [[CHANGELOG]].