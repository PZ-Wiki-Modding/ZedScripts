import * as vscode from 'vscode';

/**
 * 
 * @param document The text document in which the edit is applied.
 * @param replaceRange The range of text to replace.
 * @param newText The new text to insert.
 * @param reason The reason for the action, displayed to the user.
 * @returns A vscode.CodeAction representing the text replacement.
 */
export function registerActionTextReplace(
    document: vscode.TextDocument,
    replaceRange: vscode.Range,
    newText: string,
    reason: string = "Replace with " + newText
) {
    const fix = new vscode.CodeAction(reason, vscode.CodeActionKind.QuickFix);
    fix.edit = new vscode.WorkspaceEdit();
    fix.edit.replace(document.uri, replaceRange, newText);
    return fix;
}