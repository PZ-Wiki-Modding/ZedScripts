import * as vscode from "vscode";

export function formatText(message: string, params: Record<string, string>, lbracket: string = '{', rbracket: string = '}'): string {
    const regex = new RegExp(`${lbracket}([^${rbracket}]+)${rbracket}`, 'g');
    return message.replace(regex, (_, key) => params[key] ?? "");
}

export function formatList(values: any[], sep: string = ", "): string {
    return values.filter(v => v != null && v !== '').map(v => `'${v}'`).join(sep);
}

/**
 * Retrieves the current configuration of the document's editor settings to determine the indentation style (spaces or tabs) and size.
 * @param document The text document to get the indentation for.
 * @returns The indentation string (spaces or tab) based on the editor settings.
 */
export function getIndentation(document: vscode.TextDocument): string {
    const config = vscode.workspace.getConfiguration("editor", document.uri);

    const insertSpaces = config.get<boolean>("insertSpaces");
    const tabSize = config.get<number | string>("tabSize");

    return insertSpaces ? " ".repeat(Number(tabSize)) : "\t";
}