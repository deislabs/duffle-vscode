import * as vscode from 'vscode';

import * as symbols from '../utils/symbols';
import { isParameterDefinition } from '../utils/arm';
import * as duffleTOML from '../duffle/toml';
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

    const tomlPath = await duffleTOML.locate();
    if (!tomlPath) {
        return;  // already showed error message
    }

    const document = await vscode.workspace.openTextDocument(tomlPath);

    const text = document.getText();
    const hasThisParameter = text.indexOf(`[parameters.${parameterNameToExpose}]`) >= 0;

    if (hasThisParameter) {
        vscode.window.showErrorMessage(`Parameter ${parameterNameToExpose} is already defined in duffle.toml.`);
        return;
    }

    const parametersSectionIndex = text.indexOf('[parameters]');
    const needsParametersSection = parametersSectionIndex < 0;

    const parameterTOML = makeParameterTOML(parameterNameToExpose, parameterToExpose);
    if (needsParametersSection) {
        parameterTOML.unshift("[parameters]");
    }

    const after = needsParametersSection ? 'at-end' : document.positionAt(parametersSectionIndex).line;
    const e = edit.insertLines(document, after, parameterTOML);
    edit.applyEdits(e);
    edit.show(e);
}

function makeParameterTOML(name: string, definition: any): string[] {
    const lines = [
        `[parameters.${name}]`,
        `type = "${definition.type}"`
    ];
    const quote = (v: any) => (definition.type === 'string') ? `"${v}"` : v;
    if (definition.defaultValue !== undefined) {
        lines.push(`defaultValue = ${quote(definition.defaultValue)}`);
    }
    if (definition.allowedValues !== undefined) {
        lines.push(`allowedValues = [${definition.allowedValues.map(quote).join(', ')}]`);
    }
    for (const numericProp of ['minValue', 'maxValue', 'minLength', 'maxLength']) {
        if (definition[numericProp] !== undefined) {
            lines.push(`${numericProp} = ${definition[numericProp]}`);
        }
    }
    if (definition.metadata && definition.metadata.description) {
        lines.push(`[parameters.${name}.metadata]`);
        lines.push(`description = "${definition.metadata.description}"`);
    }
    return lines.map((l) => '    ' + l);
}
