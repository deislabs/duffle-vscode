import * as vscode from 'vscode';

export async function activeSymbol(editor: vscode.TextEditor): Promise<vscode.SymbolInformation | undefined> {
    const symbols = await getSymbols(editor.document);
    if (symbols.length === 0) {
        return undefined;
    }

    const activeSymbol = symbolAt(editor.selection.active, symbols);
    if (!activeSymbol) {
        return undefined;
    }

    return activeSymbol;
}

async function getSymbols(document: vscode.TextDocument): Promise<vscode.SymbolInformation[]> {
    const sis: any = await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', document.uri);

    if (sis && sis.length) {
        return sis;
    }

    return [];
}

function symbolAt(position: vscode.Position, sis: vscode.SymbolInformation[]): vscode.SymbolInformation | undefined {
    const containers = sis.filter((si) => si.location.range.contains(position));
    if (containers.length === 0) {
        return undefined;
    }
    return minimalSymbol(containers);
}

function minimalSymbol(sis: vscode.SymbolInformation[]): vscode.SymbolInformation {
    let m = sis[0];
    for (const si of sis) {
        if (m.location.range.contains(si.location.range)) {
            m = si;
        }
    }
    return m;
}
