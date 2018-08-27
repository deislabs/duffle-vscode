import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export class DuffleTOMLCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        const wordPos = document.getWordRangeAtPosition(position) || new vscode.Range(position, position);
        const line = document.lineAt(position.line).text;
        const lineUntil = line.substr(0, wordPos.start.character).trim();

        if (shouldPrompt(lineUntil)) {
            const tomlPath = document.uri.fsPath;
            const completionItems =
                subdirectories(tomlPath)
                    .filter((d) => !d.startsWith('.'))
                    .map((d) => new vscode.CompletionItem(`"${d}"`));
            return new vscode.CompletionList(completionItems);
        }

        return [];
    }
}

function subdirectories(filePath: string): string[] {
    const fileDir = path.dirname(filePath);
    const entries = fs.readdirSync(fileDir);
    return entries.filter((d) => fs.statSync(path.join(fileDir, d)).isDirectory());
}

function shouldPrompt(lineUntil: string): boolean {
    if (lineUntil.indexOf("components") < 0) {
        return false;
    }
    return (lineUntil.endsWith("["))
        || (lineUntil.endsWith(",") && lineUntil.indexOf("[") >= 0 && lineUntil.indexOf("]") < 0);
}
