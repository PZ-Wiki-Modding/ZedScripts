import * as vscode from "vscode";
import { Position, TextDocument } from "vscode";
import { provideDefinition } from "./definition";
import path from "path";
import { itemBlockRegex } from "../models/regexPatterns";
import { DocumentBlock } from "../scriptsBlocks/blockTypes/document";


export class PZHoverProvider implements vscode.HoverProvider {
    async provideHover(
        document: TextDocument,
        position: Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Hover | undefined> {
        const range = document.getWordRangeAtPosition(position);
        if (!range) return;
        
        const word = document.getText(range);
        // const lowerWord = word.toLowerCase();


        // only proceed if the document has been diagnosed and parsed
        const documentBlock = DocumentBlock.getDocumentBlock(document);
        if (!documentBlock) return;

        // retrieve the block at the position of the word
        const block = documentBlock.getBlock(document.offsetAt(position));
        if (!block) return;

        // 1. Word is the script block
        if (block.isWord(word)) {
            return new vscode.Hover(block.getHoverText());
        }

        // 2. Word is a parameter of the block
        const parameter = block.getParameter(word);
        if (parameter) {
            const hoverText = parameter.getHoverText();
            return new vscode.Hover(hoverText);
        }
        
        // 3. Hover pour les Base.ITEM
        const baseItemRange = document.getWordRangeAtPosition(
            position,
            /\bBase\.(\w+)\b/i
        );
        if (baseItemRange) {
            const fullItemName = document.getText(baseItemRange);
            const itemName = fullItemName.split(".")[1].toLowerCase();
            
            // Utiliser le cache ou chercher la définition
            const locations = await provideDefinition(document, position, token);
            if (!locations || !Array.isArray(locations) || locations.length === 0) {
                return new vscode.Hover(
                    `No definition found for ${fullItemName}`
                );
            }
            
            // Retrieve and format the content
            const contents = new vscode.MarkdownString();
            contents.appendMarkdown(`### ${fullItemName}\n`);
            
            for (const location of locations.slice(0, 3)) {
                // Limit to 3 results
                const doc = await vscode.workspace.openTextDocument(location.uri);
                const itemContent = this.extractItemContent(doc, location.range.start);
                
                if (itemContent) {
                    contents.appendMarkdown(
                        `#### ${path.basename(location.uri.fsPath)}\n`
                    );
                    contents.appendMarkdown("```lua\n" + itemContent + "\n```\n");
                }
            }
            
            if (locations.length > 3) {
                contents.appendMarkdown(
                    `\n*... et ${locations.length - 3} autres définitions*`
                );
            }
            
            return new vscode.Hover(contents);
        }
        
        return;
    }

    private extractItemContent(
        doc: TextDocument,
        startPosition: Position
    ): string | null {
        const text = doc.getText();
        const startOffset = doc.offsetAt(startPosition);
        
        // Reset lastIndex pour s'assurer que la recherche commence du début
        itemBlockRegex.lastIndex = 0;
        
        let bestMatch: { text: string, distance: number } | null = null;
        let match;
        
        // Chercher tous les blocs items
        while ((match = itemBlockRegex.exec(text)) !== null) {
            const matchStart = match.index;
            const matchEnd = matchStart + match[0].length;
            
            // Calculer la distance entre la position du curseur et le début du bloc
            const distance = Math.abs(startOffset - matchStart);
            
            // Si c'est le premier match ou si c'est plus proche que le précédent
            if (!bestMatch || distance < bestMatch.distance) {
                bestMatch = {
                    text: match[0],
                    distance: distance
                };
            }
        }
        
        if (bestMatch) {
            let content = bestMatch.text.trim();
            const MAX_LENGTH = 10000;
            
            // Tronquer si nécessaire
            if (content.length > MAX_LENGTH) {
                content = content.slice(0, MAX_LENGTH) + "\n// ... (trunced content)";
            }
            
            return content;
        }
        
        return null;
    }
}
