import { ParameterDefinition, BundleManifest } from "../duffle/duffle.objectmodel";
import { BundleSelection } from "./bundleselection";
import { END_DIALOG_FN, dialog } from "./dialog";
import { Cancellable } from './cancellable';

export type ParameterValuesPromptResult = Cancellable<{ [key: string]: string }>;

interface ParameterDefinitionMapping extends ParameterDefinition {
    readonly name: string;
}

export async function promptForParameters(bundlePick: BundleSelection, bundleManifest: BundleManifest, actionName: string, prompt: string): Promise<ParameterValuesPromptResult> {
    const definitions = parseParameters(bundleManifest);
    if (!definitions || definitions.length === 0) {
        return { cancelled: false, value: {} };
    }

    const parameterFormId = 'pvform';

    const html = `<h1>${prompt}</h1>
    <form id='${parameterFormId}'>
    ${parameterEntryTable(definitions)}
    </form>
    <p><button onclick='${END_DIALOG_FN}'>${actionName}</button></p>`;

    const parameterValues = await dialog(`${actionName} ${bundlePick.label}`, html, parameterFormId);
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
    <td colspan="2" style="font-size:80%">${p.metadata ? (p.metadata.description || '') : ''}</td>
</tr>
`;
}

function inputWidget(p: ParameterDefinitionMapping): string {
    if (p.type === "bool") {
        return `<select name="${p.name}"><option>True</option><option>False</option></select>`;
    }
    if (p.allowedValues) {
        const opts = p.allowedValues.map((av) => `<option>${av}</option>`).join('');
        return `<select name="${p.name}">${opts}</select>`;
    }
    const defval = p.defaultValue ? `${p.defaultValue}` : '';
    return `<input name="${p.name}" type="text" value="${defval}" />`;
}

function parseParameters(manifest: BundleManifest): ParameterDefinitionMapping[] {
    const parameters = manifest.parameters;
    const defs: ParameterDefinitionMapping[] = [];
    if (parameters) {
        for (const k in parameters) {
            defs.push({ name: k, ...parameters[k] });
        }
    }
    return defs;
}
