import * as vscode from 'vscode';

import * as buildDefinition from './duffle.builddefinition.linters';

export interface Linter {
    canLint(document: vscode.TextDocument): boolean;
    lint(document: vscode.TextDocument): Promise<vscode.Diagnostic[]>;
}

const linters: Linter[] = [
    new buildDefinition.ComponentNameMustBeSubdirectory(),
    new buildDefinition.ComponentNameMustMatchNameElement()
];

export function lintTo(dc: vscode.DiagnosticCollection): (document: vscode.TextDocument) => Promise<void> {
    return async (document: vscode.TextDocument) => {
        const linterPromises =
            linters
                .filter((l) => l.canLint(document))
                .map((l) => l.lint(document));
        const linterResults = await Promise.all(linterPromises);
        const diagnostics = ([] as vscode.Diagnostic[]).concat(...linterResults);
        dc.set(document.uri, diagnostics);
    };
}
