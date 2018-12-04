import * as vscode from 'vscode';

import * as symbols from '../utils/symbols';
import { isParameterDefinition } from '../utils/arm';
import * as buildDefinition from '../duffle/builddefinition';
import * as textmodels from '../duffle/builddefinition.textmodels';
import * as edit from '../utils/edit';

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

    if (!activeSymbol.parent || activeSymbol.parent.symbol.name !== "parameters") {
        await vscode.window.showErrorMessage("This command requires an ARM template parameter definition to be selected.");
        return;
    }

    const parameterNameToExpose = activeSymbol.symbol.name;

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

    const buildDefinitionPath = await buildDefinition.locate();
    if (!buildDefinitionPath) {
        return;  // already showed error message
    }

    const buildDefinitionDocument = await vscode.workspace.openTextDocument(buildDefinitionPath);

    const buildDefinitionSymbols = await symbols.getSymbols(buildDefinitionDocument);

    if (hasParameter(buildDefinitionSymbols, parameterNameToExpose)) {
        vscode.window.showErrorMessage(`Parameter ${parameterNameToExpose} is already defined in ${buildDefinition.definitionFile}.`);
        return;
    }

    const newParameterDefn: any = parameterToExpose;

    const insertParamEdit = textmodels.getTemplateParameterInsertion(buildDefinitionSymbols, parameterNameToExpose, newParameterDefn);

    const e = { document: buildDefinitionDocument, edits: [insertParamEdit] };

    edit.applyEdits(e);
    edit.show(e);
}

function hasParameter(symbols: vscode.DocumentSymbol[], name: string): boolean {
    const parametersElement = symbols.find((s) => s.name === 'parameters');
    if (parametersElement) {
        const parameterElements = parametersElement.children || [];
        return parameterElements.some((e) => e.name === name);
    }
    return false;
}
