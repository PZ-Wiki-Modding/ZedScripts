import * as vscode from "vscode";

import { getColor } from "../utils/themeColors";
import { ThemeColorScopes } from "./ThemeColorType";

const cachedDecorations = new Map<string, vscode.TextEditorDecorationType>();


export function createReferenceDecoration(refBlock: string): vscode.TextEditorDecorationType {
    if (cachedDecorations.has(refBlock)) {
        return cachedDecorations.get(refBlock)!;
    }

    const decoration = vscode.window.createTextEditorDecorationType({
        color: getColor(ThemeColorScopes.FULLTYPE),
        // before: {
        //     contentText: refBlock + ':',
        //     color: 'rgba(150, 150, 150, 0.8)',
        //     backgroundColor: 'rgba(100, 100, 100, 0.15)',
        //     margin: '0 4px 0 0',
        // },
    });

    cachedDecorations.set(refBlock, decoration);
    return decoration;
}
