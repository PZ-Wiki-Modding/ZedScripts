/**
 * Typical scope names used in VSCode themes for syntax highlighting.
 * These are used to find back specific colors in the currently active theme
 * for custom highlighting in the hover tooltips.
 * 
 * See https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide#scope-names for more information.
 */
export enum ThemeColorScopes {
    ID = "entity.name.class",
    SCRIPT_BLOCK = "keyword.control",
    BOOLEAN = "constant.language.boolean",
    PARAMETER = "variable.parameter",
    NUMBER = "constant.numeric",
    STRING = "string.quoted.double",
    FULLTYPE = "string.quoted.double",
    TYPE = "entity.name.class",
    OPERATOR = "keyword.operator.assignment",
}