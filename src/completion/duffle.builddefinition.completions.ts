// TODO: rewrite for JSON

// import * as vscode from 'vscode';

// import { subdirectoriesFromFile } from '../utils/fsutils';

// export class DuffleBuildDefinitionCompletionProvider implements vscode.CompletionItemProvider {
//     provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
//         const wordPos = document.getWordRangeAtPosition(position) || new vscode.Range(position, position);
//         const line = document.lineAt(position.line).text;
//         const lineUntil = line.substr(0, wordPos.start.character).trim();

//         if (shouldPrompt(lineUntil)) {
//             const tomlPath = document.uri.fsPath;
//             const completionItems =
//                 subdirectoriesFromFile(tomlPath)
//                     .filter((d) => !d.startsWith('.'))
//                     .map((d) => new vscode.CompletionItem(`${d}`));
//             return new vscode.CompletionList(completionItems);
//         }

//         return [];
//     }
// }

// function shouldPrompt(lineUntil: string): boolean {
//     return lineUntil.endsWith("components.");
// }
