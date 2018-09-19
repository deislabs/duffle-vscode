import * as vscode from 'vscode';

export interface TextEdit {
    readonly document: vscode.TextDocument;
    readonly edits: vscode.TextEdit[];
}

export function insertLines(document: vscode.TextDocument, afterLine: number | 'at-end', lines: string[]): TextEdit {
    const edits: vscode.TextEdit[] = [];
    let pos: vscode.Position;
    if (afterLine === 'at-end') {
        pos = document.positionAt(document.getText().length);
        if (pos.character !== 0) {
            edits.unshift(vscode.TextEdit.insert(pos, '\n'));
            pos = new vscode.Position(pos.line + 1, 0);
        }
    } else {
        if (afterLine === document.lineCount - 1) {
            edits.unshift(vscode.TextEdit.insert(document.positionAt(document.getText().length), '\n'));
        }
        pos = new vscode.Position(afterLine + 1, 0);
    }
    for (const l of lines) {
        edits.push(vscode.TextEdit.insert(pos, l + '\n'));  // reverse order so we don't need to change pos
    }
    return { document: document, edits: edits };
}

export async function applyEdits(...edits: TextEdit[]): Promise<boolean> {
    const wsEdit = new vscode.WorkspaceEdit();
    for (const e of edits) {
        wsEdit.set(e.document.uri, e.edits);
    }
    return await vscode.workspace.applyEdit(wsEdit);
}

export async function show(edit: TextEdit): Promise<void> {
    // TODO: this ends up doing not quite what I want, because the edits don't
    // reflect the *resultant* positions, only the *insertion* positions.  But
    // it's okay for a basic 'show the user what happened' feature.
    const editRange = getRange(edit);
    if (editRange) {
        const editor = vscode.window.visibleTextEditors.find((e) => e.document === edit.document) || await vscode.window.showTextDocument(edit.document);
        editor.revealRange(editRange);
        editor.selection = new vscode.Selection(editRange.start, editRange.end);
    }
}

function getRange(edit: TextEdit): vscode.Range | undefined {
    if (edit.edits.length === 0) {
        return undefined;
    }

    let range = edit.edits[0].range;
    for (const e of edit.edits.slice(1)) {
        range = range.union(e.range);
    }
    return range;
}
