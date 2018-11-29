import * as vscode from 'vscode';

export function getTemplateParameterInsertion(jsonSymbols: vscode.SymbolInformation[], propertyName: string, newParameterDefn: any): vscode.TextEdit {
    const editProvider = templateParameterInsertionEditProvider(jsonSymbols, propertyName, newParameterDefn);
    return editProvider.getEdit();
}

interface IEditProvider {
    getEdit(): vscode.TextEdit;
}

function indentOf(symbol: vscode.SymbolInformation) {
    return symbol.location.range.start.character;
}

function indentFrom(symbol1: vscode.SymbolInformation, symbol2: vscode.SymbolInformation) {
    const offset = indentOf(symbol1) - indentOf(symbol2);
    return Math.abs(offset);
}

function indentLines(text: string, amount: number): string {
    const indent = ' '.repeat(amount);
    const lines = text.split('\n');
    const indented = lines.map((l) => indent + l);
    return indented.join('\n');
}

function isSingleLine(range: vscode.Range) {
    return range.start.line === range.end.line;
}

function lineStart(pos: vscode.Position) {
    return new vscode.Position(pos.line, 0);
}

function immediatelyBefore(pos: vscode.Position) {
    return pos.translate(0, -1);
}

function templateParameterInsertionEditProvider(jsonSymbols: vscode.SymbolInformation[], propertyName: string, newParameterDefn: any): IEditProvider {
    const parametersElement = jsonSymbols.find((s) => s.name === 'parameters' && !s.containerName);
    const parameterSymbols = jsonSymbols.filter((s) => s.containerName === 'parameters');
    const lastExistingParameter = parameterSymbols.length > 0 ? parameterSymbols.reverse()[0] : undefined;  // not sure what order guarantees the symbol provider makes, but it's not critical if this isn't actually the last one

    class InsertAfterExistingParameter implements IEditProvider {
        constructor(private readonly parametersElement: vscode.SymbolInformation, private readonly existingParameter: vscode.SymbolInformation) {
        }
        getEdit(): vscode.TextEdit {
            const indentPerLevel = indentFrom(this.existingParameter, this.parametersElement);
            const initialIndent = indentPerLevel * 2;
            const rawNewParameterDefnText = `"${propertyName}": ${JSON.stringify(newParameterDefn, null, indentPerLevel)}`;
            const newParameterDefnText = indentLines(rawNewParameterDefnText, initialIndent);
            const insertText = ',\n' + newParameterDefnText;

            const insertPos = this.existingParameter.location.range.end;
            const edit = vscode.TextEdit.insert(insertPos, insertText);

            return edit;
        }
    }

    class InsertIntoEmptyParametersSection implements IEditProvider {
        constructor(private readonly parametersElement: vscode.SymbolInformation) {
        }
        getEdit(): vscode.TextEdit {
            const indentPerLevel = this.parametersElement.location.range.start.character;
            const initialIndent = indentPerLevel * 2;

            const rawNewParameterDefnText = `"${propertyName}": ${JSON.stringify(newParameterDefn, null, indentPerLevel)}`;
            const newParameterDefnText = indentLines(rawNewParameterDefnText, initialIndent);
            const parametersElementOnOneLine = isSingleLine(this.parametersElement.location.range);  // for the "parameters": {} case

            // prefix and suffix are for fixing up cases where the parameters element is squashed on one line
            const prefix = (parametersElementOnOneLine ? '\n' : '');
            const suffix = (parametersElementOnOneLine ? (' '.repeat(indentPerLevel)) : '');
            const insertText = `${prefix}${newParameterDefnText}\n${suffix}`;  // TODO: line ending

            // if the parameters element is squashed then our insert position is to the left of the closing brace (which will push things into the right place)
            // otherwise we want to insert at the start of the line containing the closing brace
            const closingBracePos = this.parametersElement.location.range.end;
            const insertPos = (parametersElementOnOneLine ? immediatelyBefore(closingBracePos) : lineStart(closingBracePos));
            const edit = vscode.TextEdit.insert(insertPos, insertText);

            return edit;
        }
    }

    class InsertNewParametersSection implements IEditProvider {
        getEdit(): vscode.TextEdit {
            const parameters: any = {};
            parameters[propertyName] = newParameterDefn;

            const topLevelElement = jsonSymbols.find((s) => !s.containerName);
            const indentPerLevel = topLevelElement ? indentOf(topLevelElement) : 2;
            const rawParametersSection = `"parameters": ${JSON.stringify(parameters, null, indentPerLevel)}`;

            const parametersSectionText = indentLines(rawParametersSection, indentPerLevel);  // going in at top level so indent only once
            const topLevelElementSeparator = topLevelElement ? ',\n' : '\n';
            const insertText = parametersSectionText + topLevelElementSeparator;

            const insertPos = new vscode.Position(1, 0);
            const edit = vscode.TextEdit.insert(insertPos, insertText);

            return edit;
        }

    }

    if (parametersElement) {
        if (lastExistingParameter) {
            // We are appending after an existing parameter
            return new InsertAfterExistingParameter(parametersElement, lastExistingParameter);
        } else {
            // We are inserting into an empty parameters section
            return new InsertIntoEmptyParametersSection(parametersElement);
        }
    } else {
        // There is no parameters section - we need to create one and insert it at the top of the document
        return new InsertNewParametersSection();
    }
}
