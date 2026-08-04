import * as vscode from 'vscode';
import * as fs from 'fs';

import { TranslationLocation } from "../scriptsBlocks/scriptsBlocksData"


export interface IndexRange {
    start: number;
    end: number;
}

export function createIndexRange(start: number, index: number, fullMatch: string, value: string): IndexRange {
    const rangeStart = start + index + fullMatch.indexOf(value);
    const rangeEnd = rangeStart + value.length;
    return { start: rangeStart, end: rangeEnd };
}


export function replaceCommentsWithWhitespace(text: string): string {
    // keep newlines to match original text
	return text.replace(/\/\*[\s\S]*?\*\//g, (match) => {
		return match.replace(/[^\n]/g, ' ');
	});
}

export function getTranslationLocation(translationLoc: TranslationLocation): vscode.Location | null {
    // find the location of the translationKey in the translation file
    const filePath = translationLoc.fileUri.fsPath;
    if (!fs.existsSync(filePath)) {
        console.warn(`Translation file not found: ${filePath}`);
        return null;
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const regex = new RegExp(`"${translationLoc.translationKey}"`, 'm');
    const match = regex.exec(fileContent);
    if (!match) {
        console.warn(`Translation key not found in file: ${translationLoc.translationKey}`);
        return null;
    }
    
    const startPos = fileContent.substring(0, match.index).split('\n').length - 1;
    const lineText = fileContent.split('\n')[startPos];
    const startChar = lineText.indexOf(translationLoc.translationKey);
    const endChar = startChar + translationLoc.translationKey.length;

    const startPosition = new vscode.Position(startPos, startChar);
    const endPosition = new vscode.Position(startPos, endChar);
    const range = new vscode.Range(startPosition, endPosition);

    return new vscode.Location(translationLoc.fileUri, range);
}