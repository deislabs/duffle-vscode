import * as vscode from 'vscode';

import * as symbols from '../utils/symbols';
import { isParameterDefinition } from '../utils/arm';

export async function exposeParameter(): Promise<void> {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
        await vscode.window.showErrorMessage("This command requires an open editor.");
        return;
    }

    const activeSymbol = await symbols.activeSymbol(editor);
    if (!activeSymbol) {
        await vscode.window.showErrorMessage("This command requires a JSON symbol to be selected.");
        return;
    }

    if (activeSymbol.containerName !== "parameters") {
        await vscode.window.showErrorMessage("This command requires an ARM template parameter definition to be selected.");
        return;
    }

    const parameterNameToExpose = activeSymbol.name;

    const template = JSON.parse(editor.document.getText());
    if (!template.parameters || !template.parameters[parameterNameToExpose]) {
        await vscode.window.showErrorMessage("This command requires an ARM template parameter definition to be selected.");
        return;
    }

    const parameterToExpose = template.parameters[parameterNameToExpose];

    // This could still be a parameter values file - try some heuristics
    if (!isParameterDefinition(parameterToExpose)) {
        await vscode.window.showErrorMessage("This command requires an ARM template parameter definition to be selected.");
        return;
    }

    // TODO: where do we add parameters to the authoring inputs?
    console.log(parameterNameToExpose);
    console.log(parameterToExpose);

    // TODO: open the duffle.toml (or whatever) file with the newly added parameter
    // selected / positioned
}
