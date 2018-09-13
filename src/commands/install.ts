import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as tmp from 'tmp';

import { longRunning, showDuffleResult, refreshBundleExplorer } from '../utils/host';
import * as duffle from '../duffle/duffle';
import { RepoBundle, RepoBundleRef, ParameterDefinition } from '../duffle/duffle.objectmodel';
import { succeeded, map, Errorable } from '../utils/errorable';
import * as shell from '../utils/shell';
import { cantHappen } from '../utils/never';
import { promptBundle, BundleSelection, fileBundleSelection, repoBundleSelection } from '../utils/bundleselection';
import { dialog, END_DIALOG_FN } from '../utils/dialog';

export async function install(target?: any): Promise<void> {
    if (!target) {
        return await installPrompted();
    }
    if (target.scheme) {
        return await installFile(target as vscode.Uri);
    }
    if (target.bundle) {
        return await installRepoBundle((target as RepoBundleRef).bundle);
    }
    await vscode.window.showErrorMessage("Internal error: unexpected command target");
}

async function installPrompted(): Promise<void> {
    const bundlePick = await promptBundle("Select the bundle to install");

    if (!bundlePick) {
        return;
    }

    return await installCore(bundlePick);
}

async function installFile(file: vscode.Uri): Promise<void> {
    if (file.scheme !== 'file') {
        vscode.window.showErrorMessage("This command requires a filesystem bundle");
        return;
    }
    return await installCore(fileBundleSelection(file));
}

async function installRepoBundle(bundle: RepoBundle): Promise<void> {
    return await installCore(repoBundleSelection(bundle));
}

async function installCore(bundlePick: BundleSelection): Promise<void> {
    const name = await vscode.window.showInputBox({ prompt: `Install bundle in ${bundlePick.label} as...`, value: bundlePick.label });
    if (!name) {
        return;
    }

    const pvs = await promptForParameters(bundlePick);
    if (pvs.cancelled) {
        return;
    }

    const installResult = await installToViaTempFile(bundlePick, name, pvs.values);

    if (succeeded(installResult)) {
        await refreshBundleExplorer();
    }

    await showDuffleResult('install', (bundleId) => bundleId, installResult);
}

async function installToViaTempFile(bundlePick: BundleSelection, name: string, parameterValues: any): Promise<Errorable<string>> {
    const parametersJSON = parameterValues ? JSON.stringify(parameterValues, undefined, 2) : undefined;
    return withOptionalTempFile(parametersJSON, 'json', (paramsFile) => installTo(bundlePick, name, paramsFile));
}

async function installTo(bundlePick: BundleSelection, name: string, paramsFile: string | undefined): Promise<Errorable<string>> {
    if (bundlePick.kind === 'folder') {
        const folderPath = bundlePick.path;
        const bundlePath = path.join(folderPath, "cnab", "bundle.json");
        const installResult = await longRunning(`Duffle installing ${bundlePath}`,
            () => duffle.installFile(shell.shell, bundlePath, name, paramsFile)
        );
        return map(installResult, (_) => bundlePath);
    } else if (bundlePick.kind === 'repo') {
        const installResult = await longRunning(`Duffle installing ${bundlePick.bundle}`,
            () => duffle.installBundle(shell.shell, bundlePick.label /* because bundlePick.bundle doesn't work */, name, paramsFile)
        );
        return map(installResult, (_) => bundlePick.bundle);
    }
    return cantHappen(bundlePick);
}

// TODO: These will be needed for upgrade at some point, and should then
// be moved out into a common file.  But we have some pending changes to
// install.ts that means we should defer this for now.

async function promptForParameters(bundlePick: BundleSelection): Promise<{ cancelled: boolean; values: any }> {
    const ps = bundleParameters(bundlePick);
    if (!ps || ps.length === 0) {
        return { cancelled: false, values: undefined };
    }

    const parameterFormId = 'pvform';

    const html = `<h1>Enter installation parameters</h1>
    <form id='${parameterFormId}'>
    ${parameterEntryTable(ps)}
    </form>
    <p><button onclick='${END_DIALOG_FN}'>Install</button></p>`;

    const parameterValues = await dialog(`Install ${bundlePick.label}`, html, parameterFormId);
    if (!parameterValues) {
        return { cancelled: true, values: undefined };
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

function bundleParameters(bundlePick: BundleSelection): ParameterDefinition[] {
    if (bundlePick.kind === "folder") {
        return parseParametersFromJSONFile(path.join(bundlePick.path, "bundle.json"));
    } else if (bundlePick.kind === "repo") {
        return parseParametersFromJSONFile(path.join(process.env["USERPROFILE"]!, ".duffle", "repositories", localPath(bundlePick.bundle) + '.json'));
    }
    return cantHappen(bundlePick);
}

function parseParametersFromJSONFile(jsonFile: string): ParameterDefinition[] {
    const json = fs.readFileSync(jsonFile, 'utf8');
    const parameters = JSON.parse(json).parameters;
    const defs: ParameterDefinition[] = [];
    if (parameters) {
        for (const k in parameters) {
            defs.push({ name: k, ...parameters[k] });
        }
    }
    return defs;
}

async function withOptionalTempFile<T>(content: string | undefined, fileType: string, fn: (filename: string | undefined) => Promise<T>): Promise<T> {
    if (!content) {
        return fn(undefined);
    }

    const tempFile = tmp.fileSync({ prefix: "vsduffle-", postfix: `.${fileType}` });
    fs.writeFileSync(tempFile.name, content);

    try {
        return await fn(tempFile.name);
    } finally {
        tempFile.removeCallback();
    }
}
