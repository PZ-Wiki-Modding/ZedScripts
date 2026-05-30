import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { DEFAULT_DIR } from "../models/enums";
import { itemCache } from "./cache";

import { DocumentBlock } from "../scriptsBlocks/scriptsBlocks";


export async function provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
): Promise<vscode.Definition | undefined> {
    const range = document.getWordRangeAtPosition(position, /\b\S+(?:\.\S+)?\b/i);
    if (!range) return;
    
    // only proceed if the document has been diagnosed and parsed
    const documentBlock = DocumentBlock.getDocumentBlock(document);
    if (!documentBlock) return;

    // retrieve the block at the position of the word
    const block = documentBlock.getBlock(document.offsetAt(position));
    if (!block) return;

    // find if the word is part of a parameter value pair
    const param = block.getParameterByIndex(document.offsetAt(position));
    if (!param) return;

    // 1. check if the word is a value of that parameter
    const word = document.getText(range);
    if (param.value && param.value.toLowerCase() === word.toLowerCase()) {
        // return the location to the ref if any
        if (param.ref) {
            const loc: vscode.Location[] = [];
            for (const refBlock of param.ref.blocks) {
                loc.push(refBlock.getDefinitionLocation());
            }
            return loc;
        }
    }
    





    return;


    const fullItemName = document.getText(range);
    const itemName = fullItemName.split('.')[1].toLowerCase();
    console.log(`Recherche de : ${itemName}`);
    
    // Vérifier le cache en premier
    const cachedLocations = itemCache.get(itemName);
    if (cachedLocations) {
        console.log("Résultat trouvé dans le cache");
        return cachedLocations;
    }
    
    const config = vscode.workspace.getConfiguration("ZedScripts");
    const searchDirectories: string[] = config.get("searchDirectories", [DEFAULT_DIR]);
    
    // Filtrage des répertoires valides
    const validDirs = searchDirectories.filter(dir => {
        const normalizedDir = path.normalize(dir);
        try {
            return fs.existsSync(normalizedDir) && fs.statSync(normalizedDir).isDirectory();
        } catch {
            return false;
        }
    });
    
    if (validDirs.length === 0) {
        vscode.window.showErrorMessage("No valid directory found !");
        return;
    }
    
    // Indexation des fichiers non analysés
    for (const dir of validDirs) {
        try {
            const files = await vscode.workspace.findFiles(
                new vscode.RelativePattern(dir, "**/*.txt")
            );
            
            for (const file of files) {
                if (itemCache.isFileIndexed(file.fsPath)) continue;
                
                console.log(`Indexation de : ${file.fsPath}`);
                const doc = await vscode.workspace.openTextDocument(file);
                const items = await parseItemsInFile(doc);
                
                items.forEach(({ name, location }) => {
                    itemCache.add(file.fsPath, name, location);
                });
                
                itemCache.markFileAsIndexed(file.fsPath);
            }
        } catch (error) {
            console.error(`Erreur avec le répertoire ${dir}:`, error);
        }
    }
    
    return itemCache.get(itemName) || undefined;
}

async function parseItemsInFile(doc: vscode.TextDocument): Promise<Array<{name: string, location: vscode.Location}>> {
    const text = doc.getText();
    const items = [];
    const pattern = /^\s*item\s+(\w+)\b\s*(\{|[\s\S]*?\{)/gmi;
    
    let match;
    while ((match = pattern.exec(text)) !== null) {
        const itemName = match[1].toLowerCase();
        const line = doc.lineAt(doc.positionAt(match.index));
        
        if (!line.text.trim().startsWith('//')) {
            const location = new vscode.Location(doc.uri, new vscode.Position(line.lineNumber, 0));
            items.push({ name: itemName, location });
        }
    }
    
    return items;
}
