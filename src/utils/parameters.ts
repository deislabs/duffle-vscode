import * as path from 'path';

import { fs } from './fs';
import { ParameterDefinition } from "../duffle/duffle.objectmodel";
import { BundleSelection } from "./bundleselection";
import { END_DIALOG_FN, dialog } from "./dialog";
import { cantHappen } from './never';

interface ParameterValues {
    readonly cancelled: false;
    readonly values: any;
}

interface Cancelled {
    readonly cancelled: true;
}

export type ParameterValuesPromptResult = ParameterValues | Cancelled;

export async function promptForParameters(bundlePick: BundleSelection, actionName: string, prompt: string): Promise<ParameterValuesPromptResult> {
    const definitions = await bundleParameters(bundlePick);
    if (!definitions || definitions.length === 0) {
        return { cancelled: false, values: {} };
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

    return { cancelled: false, values: parameterValues };
}

function parameterEntryTable(ps: ParameterDefinition[]): string {
    const rows = ps.map(parameterEntryRow).join('');
    return `<table>${rows}</table>`;
}

function parameterEntryRow(p: ParameterDefinition): string {
    return `<tr valign="baseline">
    <td><b>${p.name}</b></td>
    <td>${inputWidget(p)}</td>
</tr>
<tr>
    <td colspan="2" style="font-size:80%">${p.metadata ? p.metadata.description : ''}</td>
</tr>
`;
}

function inputWidget(p: ParameterDefinition): string {
    if (p.type === "boolean") {
        return `<select name="${p.name}"><option>True</option><option>False</option></select>`;
    }
    if (p.allowedValues) {
        const opts = p.allowedValues.map((av) => `<option>${av}</option>`).join('');
        return `<select name="${p.name}">${opts}</select>`;
    }
    const defval = p.defaultValue ? `${p.defaultValue}` : '';
    return `<input name="${p.name}" type="text" value="${defval}" />`;
}

function localPath(bundleRef: string): string {
    const bits = bundleRef.split('/');
    const last = bits.pop()!;
    bits.push('bundles', last);
    return bits.join('/');
}

async function bundleParameters(bundlePick: BundleSelection): Promise<ParameterDefinition[]> {
    if (bundlePick.kind === "folder") {
        return await parseParametersFromJSONFile(path.join(bundlePick.path, "bundle.json"));
    } else if (bundlePick.kind === "repo") {
        return await parseParametersFromJSONFile(path.join(process.env["USERPROFILE"]!, ".duffle", "repositories", localPath(bundlePick.bundle) + '.json'));
    }
    return cantHappen(bundlePick);
}

async function parseParametersFromJSONFile(jsonFile: string): Promise<ParameterDefinition[]> {
    const json = await fs.readFile(jsonFile, 'utf8');
    const parameters = JSON.parse(json).parameters;
    const defs: ParameterDefinition[] = [];
    if (parameters) {
        for (const k in parameters) {
            defs.push({ name: k, ...parameters[k] });
        }
    }
    return defs;
}
