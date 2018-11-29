import * as vscode from 'vscode';

export function getTemplateParameterInsertion(destSymbols: vscode.DocumentSymbol[], newParameterName: string, newParameterDefn: any): vscode.TextEdit {
    const editProvider = templateParameterInsertionEditProvider(destSymbols, newParameterName, newParameterDefn);
    return editProvider.getEdit();
}

interface IEditProvider {
    getEdit(): vscode.TextEdit;
}

function indentOf(symbol: vscode.DocumentSymbol) {
    return symbol.range.start.character;
}

function indentFrom(symbol1: vscode.DocumentSymbol, symbol2: vscode.DocumentSymbol) {
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

function templateParameterInsertionEditProvider(destSymbols: vscode.DocumentSymbol[], newParameterName: string, newParameterDefn: any): IEditProvider {
    const parametersElement = destSymbols.find((s) => s.name === 'parameters');
    const parameterSymbols = parametersElement ? parametersElement.children : [];
    const lastExistingParameter = parameterSymbols.length > 0 ? parameterSymbols.reverse()[0] : undefined;  // not sure what order guarantees the symbol provider makes, but it's not critical if this isn't actually the last one

    class InsertAfterExistingParameter implements IEditProvider {
        constructor(private readonly parametersElement: vscode.DocumentSymbol, private readonly existingParameter: vscode.DocumentSymbol) {
        }
        getEdit(): vscode.TextEdit {
            const indentPerLevel = indentFrom(this.existingParameter, this.parametersElement);
            const initialIndent = indentPerLevel * 2;
            const rawNewParameterDefnText = `"${newParameterName}": ${JSON.stringify(newParameterDefn, null, indentPerLevel)}`;
            const newParameterDefnText = indentLines(rawNewParameterDefnText, initialIndent);
            const insertText = ',\n' + newParameterDefnText;

            const insertPos = this.existingParameter.range.end;
            const edit = vscode.TextEdit.insert(insertPos, insertText);

            return edit;
        }
    }

    class InsertIntoEmptyParametersSection implements IEditProvider {
        constructor(private readonly parametersElement: vscode.DocumentSymbol) {
        }
        getEdit(): vscode.TextEdit {
            const indentPerLevel = this.parametersElement.range.start.character;
            const initialIndent = indentPerLevel * 2;

            const rawNewParameterDefnText = `"${newParameterName}": ${JSON.stringify(newParameterDefn, null, indentPerLevel)}`;
            const newParameterDefnText = indentLines(rawNewParameterDefnText, initialIndent);
            const parametersElementOnOneLine = isSingleLine(this.parametersElement.range);  // for the "parameters": {} case

            // prefix and suffix are for fixing up cases where the parameters element is squashed on one line
            const prefix = (parametersElementOnOneLine ? '\n' : '');
            const suffix = (parametersElementOnOneLine ? (' '.repeat(indentPerLevel)) : '');
            const insertText = `${prefix}${newParameterDefnText}\n${suffix}`;  // TODO: line ending

            // if the parameters element is squashed then our insert position is to the left of the closing brace (which will push things into the right place)
            // otherwise we want to insert at the start of the line containing the closing brace
            const closingBracePos = this.parametersElement.range.end;
            const insertPos = (parametersElementOnOneLine ? immediatelyBefore(closingBracePos) : lineStart(closingBracePos));
            const edit = vscode.TextEdit.insert(insertPos, insertText);

            return edit;
        }
    }

    class InsertNewParametersSection implements IEditProvider {
        getEdit(): vscode.TextEdit {
            const parameters: any = {};
            parameters[newParameterName] = newParameterDefn;

            const topLevelElement = destSymbols[0];
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
