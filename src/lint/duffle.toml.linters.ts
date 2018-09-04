import * as vscode from 'vscode';

import { Linter } from './linters';
import { subdirectoriesFromFile } from '../utils/fsutils';
import { iter } from '../utils/iterable';

export class ComponentNameMustBeSubdirectory implements Linter {
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
                results.push(makeNotSubdirectoryDiagnostic(document, index, matchText.length, componentName));
            }
        }

        return results;
    }
}

export class ComponentNameMustMatchNameElement implements Linter {
    canLint(document: vscode.TextDocument): boolean {
        return isDuffleTOML(document);
    }

    async lint(document: vscode.TextDocument): Promise<vscode.Diagnostic[]> {
        const re = /\[components\.[^\]]+\]/g;
        const text = document.getText();
        const results: vscode.Diagnostic[] = [];

        let match: RegExpExecArray | null;
        while ((match = re.exec(text)) !== null) {
            const index = match.index;
            const matchText = match[0];
            const componentName = namePart(matchText);
            const nameLine = findNextNameLine(document, index);
            if (!nameLine) {
                results.push(makeNoNameDiagnostic(document, index, matchText.length));
                continue;
            }
            const nameLineName = getValue(nameLine);
            if (nameLineName !== componentName) {
                results.push(makeNameMismatchDiagnostic(document, index, matchText.length, componentName, nameLineName));
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

function findNextNameLine(document: vscode.TextDocument, afterIndex: number): string | null {
    const nameExpr = /name\s*=/;
    return iter(sectionLines(document, afterIndex))
        .first((l) => nameExpr.test(l));
}

function* sectionLines(document: vscode.TextDocument, afterIndex: number): IterableIterator<string> {
    const headerLineIndex = document.positionAt(afterIndex).line;
    for (let i = headerLineIndex + 1; i < document.lineCount; ++i) {
        const line = document.lineAt(i).text.trim();
        if (line.startsWith('[')) {
            // we've entered a new section
            break;
        }
        yield line;
    }
}

function getValue(text: string): string {
    const sepIndex = text.indexOf('=');
    const value = text.substring(sepIndex + 1);
    return unquote(value);
}

function unquote(text: string): string {
    const s = text.trim();
    if (s.startsWith('"') && s.endsWith('"')) {
        return s.substring(1, s.length - 1);
    }
    return s;
}

function range(document: vscode.TextDocument, start: number, length: number): vscode.Range {
    return new vscode.Range(document.positionAt(start), document.positionAt(start + length));
}

function makeNotSubdirectoryDiagnostic(document: vscode.TextDocument, start: number, length: number, name: string): vscode.Diagnostic {
    return new vscode.Diagnostic(range(document, start, length), `${name} is not a subdirectory`, vscode.DiagnosticSeverity.Warning);
}

function makeNoNameDiagnostic(document: vscode.TextDocument, start: number, length: number) {
    return new vscode.Diagnostic(range(document, start, length), `Component does not contain a 'name' element`, vscode.DiagnosticSeverity.Warning);
}

function makeNameMismatchDiagnostic(document: vscode.TextDocument, start: number, length: number, titleName: string, containedName: string) {
    return new vscode.Diagnostic(range(document, start, length), `Component name ${titleName} does not match 'name' element ${containedName}`, vscode.DiagnosticSeverity.Warning);
}
