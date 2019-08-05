import * as cnab from "cnabjs";

import { BundleSelection } from "./bundleselection";
import { END_DIALOG_FN, dialog } from "./dialog";
import { Cancellable } from './cancellable';

export type ParameterValuesPromptResult = Cancellable<{ [key: string]: string }>;

interface ParameterDefinitionMapping extends cnab.Parameter {
    readonly name: string;
    readonly schema: cnab.Definition;
}

export async function promptForParameters(bundlePick: BundleSelection, bundleManifest: cnab.Bundle, actionId: string, actionDisplayName: string, prompt: string): Promise<ParameterValuesPromptResult> {
    const definitions = parseParameters(bundleManifest, actionId);
    if (!definitions || definitions.length === 0) {
        return { cancelled: false, value: {} };
    }

    const parameterFormId = 'pvform';

    const html = `<h1>${prompt}</h1>
    <form id='${parameterFormId}'>
    ${parameterEntryTable(definitions)}
    </form>
    <p><button onclick='${END_DIALOG_FN}'>${actionDisplayName}</button></p>`;

    const parameterValues = await dialog(`${actionDisplayName} ${bundlePick.label}`, html, parameterFormId);
    if (!parameterValues) {
        return { cancelled: true };
    }

    return { cancelled: false, value: parameterValues };
}

function parameterEntryTable(ps: ParameterDefinitionMapping[]): string {
    const rows = ps.map(parameterEntryRow).join('');
    return `<table>${rows}</table>`;
}

function parameterEntryRow(p: ParameterDefinitionMapping): string {
    return `<tr valign="baseline">
    <td><b>${p.name}</b></td>
    <td>${inputWidget(p)}</td>
</tr>
<tr>
    <td colspan="2" style="font-size:80%">${p.description || ''}</td>
</tr>
`;
}

function inputWidget(p: ParameterDefinitionMapping): string {
    if (!p.schema) {
        // This doesn't need to be fancy as it should never happen
        return `<input name="${p.name}" type="text" />`;
    }
    if (p.schema.type === "boolean") {
        return `<select name="${p.name}"><option>True</option><option>False</option></select>`;
    }
    if (p.schema.enum) {
        const opts = p.schema.enum.map((av) => `<option>${av}</option>`).join('');
        return `<select name="${p.name}">${opts}</select>`;
    }
    const defval = p.schema.default ? `${p.schema.default}` : '';
    return `<input name="${p.name}" type="text" value="${defval}" />`;
}

function parseParameters(bundle: cnab.Bundle, action: string): ParameterDefinitionMapping[] {
    const parameters = bundle.parameters;
    const schemas = bundle.definitions;
    if (!parameters || !schemas) {
        return [];
    }

    const actionParameters = cnab.Parameters.forAction(bundle, action);
    const parameterSequence = Array.of(...actionParameters).sort();

    const defs = parameterSequence.map((k) => ({ name: k, schema: schemas[parameters[k].definition], ...parameters[k] }));
    return defs;
}
