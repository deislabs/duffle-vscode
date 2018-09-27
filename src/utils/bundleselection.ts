import * as vscode from 'vscode';
import * as path from 'path';

import { selectQuickPick } from './host';
import { RepoBundle } from '../duffle/duffle.objectmodel';
import * as dufflepaths from '../duffle/duffle.paths';
import { cantHappen } from './never';

export interface FolderBundleSelection {
    readonly kind: 'folder';
    readonly label: string;
    readonly path: string;
}

export interface RepoBundleSelection {
    readonly kind: 'repo';
    readonly label: string;
    readonly bundle: string;
}

export type BundleSelection = FolderBundleSelection | RepoBundleSelection;

export async function promptBundle(prompt: string): Promise<BundleSelection | undefined> {
    const bundles = await vscode.workspace.findFiles('**/cnab/bundle.json');
    if (!bundles || bundles.length === 0) {
        await vscode.window.showErrorMessage("This command requires a bundle file in the current workspace.");
        return undefined;
    }

    const bundleQuickPicks = bundles.map(fileBundleSelection);

    const bundlePick = await selectQuickPick(bundleQuickPicks, { placeHolder: prompt });
    if (!bundlePick) {
        return undefined;
    }

    return bundlePick;
}

export function fileBundleSelection(bundleFile: vscode.Uri): BundleSelection {
    const bundleDir = path.dirname(path.dirname(bundleFile.fsPath));
    return {
        kind: 'folder',
        label: path.basename(bundleDir),
        path: bundleDir
    };
}

export function repoBundleSelection(bundle: RepoBundle): BundleSelection {
    return {
        kind: 'repo',
        label: bundle.name,
        bundle: `${bundle.repository}/${bundle.name}`
    };
}

export function bundleJSONPath(bundlePick: BundleSelection) {
    if (bundlePick.kind === "folder") {
        return path.join(bundlePick.path, "bundle.json");
    } else if (bundlePick.kind === "repo") {
        return dufflepaths.repoBundlePath(bundlePick.bundle);
    }
    return cantHappen(bundlePick);
}
