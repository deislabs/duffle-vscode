import * as vscode from 'vscode';

import * as duffle from '../duffle/duffle';
import { Cancellable } from './cancellable';
import { Shell } from './shell';
import { failed } from './errorable';
import { BundleSelection, bundleJSON } from './bundleselection';

export async function promptForCredentials(bundlePick: BundleSelection, sh: Shell, prompt: string): Promise<Cancellable<string | undefined>> {
    if (!(await bundleHasCredentials(bundlePick))) {
        return { cancelled: false, value: undefined };
    }

    const credentialSets = await duffle.listCredentialSets(sh);
    if (failed(credentialSets)) {
        // Fall back to making the user type it in unaided
        const credentialSet = await vscode.window.showInputBox({ prompt: prompt });
        if (!credentialSet) {
            return { cancelled: true };
        }
        return { cancelled: false, value: credentialSet };
    }

    const credentialSet = await vscode.window.showQuickPick(credentialSets.result, { placeHolder: prompt });
    if (!credentialSet) {
        return { cancelled: true };
    }

    return { cancelled: false, value: credentialSet };
}

// TODO: deduplicate with parameters parser
async function bundleHasCredentials(bundlePick: BundleSelection): Promise<boolean> {
    const json = await bundleJSON(bundlePick);
    return await parseHasCredentialsFromJSON(json);
}

async function parseHasCredentialsFromJSON(json: string): Promise<boolean> {
    const credentials = JSON.parse(json).credentials;
    return (credentials && Object.keys(credentials).length > 0);
}
