import * as vscode from 'vscode';

export interface WithSymbol<T> {
    readonly value: T;
    readonly symbol: vscode.DocumentSymbol | undefined;
}

export interface SymbolInContext {
    readonly symbol: vscode.DocumentSymbol;
    readonly parent: SymbolInContext | undefined;
}

export async function activeSymbol(editor: vscode.TextEditor): Promise<SymbolInContext | undefined> {
    const symbols = await getSymbols(editor.document);
    if (symbols.length === 0) {
        return undefined;
    }

    const activeSymbol = symbolAt(editor.selection.active, symbols, undefined);
    if (!activeSymbol) {
        return undefined;
    }

    return activeSymbol;
}

export async function getSymbols(document: vscode.TextDocument): Promise<vscode.DocumentSymbol[]> {
    const sis: any = await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', document.uri);

    if (sis && sis.length) {
        return sis;
    }

    return [];
}

function symbolAt(position: vscode.Position, sis: vscode.DocumentSymbol[], context: SymbolInContext | undefined): SymbolInContext | undefined {
    const outer = sis.find((si) => si.range.contains(position));
    if (!outer) {
        return context;
    }
    const outerInContext = { symbol: outer, parent: context };
    const sic = symbolAt(position, outer.children, outerInContext);
    return sic || outerInContext;
}
