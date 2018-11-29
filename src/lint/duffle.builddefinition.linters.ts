import * as vscode from 'vscode';

import { Linter } from './linters';
import * as buildDefinition from '../duffle/builddefinition';
import { subdirectoriesFromFile } from '../utils/fsutils';
import { iter, Enumerable } from '../utils/iterable';
import { matches, RegExpMatch } from '../utils/re';

export class ComponentNameMustBeSubdirectory implements Linter {
    canLint(document: vscode.TextDocument): boolean {
        return isDuffleBuildDefinition(document);
    }

    async lint(document: vscode.TextDocument): Promise<vscode.Diagnostic[]> {
        if (document.uri.scheme !== 'file') {
            return [];
        }

        const buildDefinitionPath = document.uri.fsPath;
        const subdirectories = subdirectoriesFromFile(buildDefinitionPath);

        const diagnostics =
            components(document)
                .filter((m) => !isPresent(m.componentName, subdirectories))
                .map((m) => makeNotSubdirectoryDiagnostic(document, m.index, m.matchText.length, m.componentName));

        return diagnostics.toArray();
    }
}

export class ComponentNameMustMatchNameElement implements Linter {
    canLint(document: vscode.TextDocument): boolean {
        return isDuffleBuildDefinition(document);
    }

    async lint(document: vscode.TextDocument): Promise<vscode.Diagnostic[]> {
        const diagnostics =
            components(document)
                .collect((m) => nameDiagnostics(m, document));

        return diagnostics.toArray();
    }
}

interface ComponentMatch extends RegExpMatch {
    readonly componentName: string;
}

function isDuffleBuildDefinition(document: vscode.TextDocument): boolean {
    return document.languageId === buildDefinition.languageId && document.uri.toString().endsWith(buildDefinition.definitionFile);
}

function components(document: vscode.TextDocument): Enumerable<ComponentMatch> {
    const re = /\[components\.[^\]]+\]/g;
    const text = document.getText();
    return iter(matches(re, text))
        .map((m) => ({ componentName: namePart(m.matchText), ...m }));
}

function namePart(componentHeader: string): string {
    const text = componentHeader.substring(1, componentHeader.length - 1);
    const sepIndex = text.indexOf('.');
    return text.substring(sepIndex + 1);
}

function isPresent(name: string, candidates: string[]): boolean {
    return candidates.indexOf(name) >= 0;
}

function* nameDiagnostics(component: ComponentMatch, document: vscode.TextDocument): IterableIterator<vscode.Diagnostic> {
    const nameLine = findNextNameLine(document, component.index);
    if (!nameLine) {
        yield makeNoNameDiagnostic(document, component.index, component.matchText.length);
        return;
    }
    const nameLineName = getValue(nameLine);
    if (nameLineName !== component.componentName) {
        yield makeNameMismatchDiagnostic(document, component.index, component.matchText.length, component.componentName, nameLineName);
    }
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
