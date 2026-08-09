import { extensions, workspace } from "vscode";
import path from "path";
import { ThemeColorScopes } from "../models/ThemeColorType";
import { colorText } from './htmlFormat';

const TokenColorsCache = new Map<string, (token: string) => any>();
/**
* Retrieves token colors for a given theme.
* https://github.com/microsoft/vscode/issues/32813#issuecomment-3236474810
*/
function getTokenColorsForTheme(themeName: string): (token: string) => any {
    if (TokenColorsCache.has(themeName)) {
        return TokenColorsCache.get(themeName)!;
    }
    const tokenColors = new Map();
    let currentThemePath;
    for (const extension of extensions.all) {
        const themes = extension.packageJSON.contributes && extension.packageJSON.contributes.themes;
        const currentTheme = themes && themes.find((theme: any) => theme.label === themeName);
        if (currentTheme) {
            currentThemePath = path.join(extension.extensionPath, currentTheme.path);
            break;
        }
    }
    const themePaths = [];
    if (currentThemePath) { themePaths.push(currentThemePath); }
    while (themePaths.length > 0) {
        const themePath = themePaths.pop();
        if (!themePath) throw new Error("this is to make typescript happy");
        const theme: any = require(themePath);
        if (theme) {
            if (theme.include) {
                themePaths.push(path.join(path.dirname(themePath), theme.include));
            }
            if (theme.tokenColors) {
                theme.tokenColors.forEach((rule: any) => {
                    const scopes: string[] = [];
                    
                    if (typeof rule.scope === "string") {
                        // Handle comma-separated scopes in a single string
                        scopes.push(...rule.scope.split(',').map((s: string) => s.trim()));
                    } else if (rule.scope instanceof Array) {
                        scopes.push(...rule.scope);
                    }
                    
                    scopes.forEach((scope: string) => {
                        if (!tokenColors.has(scope)) {
                            tokenColors.set(scope, rule.settings);
                        }
                    });
                });
            }
        }
    }
    const tktColor = (token: string) => {
        let currentToken = token;
        while(!tokenColors.has(currentToken)) {
            if(currentToken.includes(".")) {
                currentToken = currentToken.slice(0, currentToken.lastIndexOf("."));
            } else {
                return undefined;
            }
        }
        return tokenColors.get(currentToken);
    };
    TokenColorsCache.set(themeName, tktColor);
    return tktColor;
}

function getThemeColors(): any {
    // retrieve the current theme name and colors
    const themeName = workspace.getConfiguration("workbench").get("colorTheme");
    const tokenColors = getTokenColorsForTheme(themeName as string);
    return tokenColors;
}

export function getColor(type: ThemeColorScopes): string {
    const tokenColors = getThemeColors();
    return tokenColors(type)?.foreground;
}

export function getFontStyle(type: ThemeColorScopes): string | undefined {
    const tokenColors = getThemeColors();
    return tokenColors(type)?.fontStyle;
}

export function getTokenSettings(type: ThemeColorScopes): { foreground?: string; fontStyle?: string } {
    const tokenColors = getThemeColors();
    return tokenColors(type) || {};
}

export function color(txt: string, colorType: ThemeColorScopes = ThemeColorScopes.PARAMETER): string {
    const color = getColor(colorType);
    const fontStyle = getFontStyle(colorType);
    return colorText(txt, color, fontStyle);
}
