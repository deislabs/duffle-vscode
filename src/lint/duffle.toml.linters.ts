import * as vscode from 'vscode';

import { Linter } from './linters';
import { subdirectoriesFromFile } from '../utils/fsutils';

export class DuffleTOMLComponentNameLinter implements Linter {
    canLint(document: vscode.TextDocument): boolean {
        return isDuffleTOML(document);
    }

    async lint(document: vscode.TextDocument): Promise<vscode.Diagnostic[]> {
        if (document.uri.scheme !== 'file') {
            return [];
        }

        const tomlPath = document.uri.fsPath;
        const subdirectories = subdirectoriesFromFile(tomlPath);

        const re = /\[components\.[^\]]+\]/g;
        const text = document.getText();
        const results: vscode.Diagnostic[] = [];

        let match: RegExpExecArray | null;
        while ((match = re.exec(text)) !== null) {
            const index = match.index;
            const matchText = match[0];
            const componentName = namePart(matchText);
            if (!isPresent(componentName, subdirectories)) {
                results.push(makeDiagnostic(document, index, matchText.length, componentName));
            }
        }

        return results;
    }
}

function isDuffleTOML(document: vscode.TextDocument): boolean {
    return document.languageId === 'toml' && document.uri.toString().endsWith('duffle.toml');
}

function namePart(componentHeader: string): string {
    const text = componentHeader.substring(1, componentHeader.length - 1);
    const sepIndex = text.indexOf('.');
    return text.substring(sepIndex + 1);
}

function isPresent(name: string, candidates: string[]): boolean {
    return candidates.indexOf(name) >= 0;
}

function range(document: vscode.TextDocument, start: number, length: number): vscode.Range {
    return new vscode.Range(document.positionAt(start), document.positionAt(start + length));
}

function makeDiagnostic(document: vscode.TextDocument, start: number, length: number, name: string): vscode.Diagnostic {
    return new vscode.Diagnostic(range(document, start, length), `${name} is not a subdirectory`, vscode.DiagnosticSeverity.Warning);
}