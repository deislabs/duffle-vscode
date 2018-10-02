import * as vscode from 'vscode';
import * as path from 'path';
import * as request from 'request-promise-native';

import { selectQuickPick } from './host';
import { RepoBundle, BundleManifest } from '../duffle/duffle.objectmodel';
import { cantHappen } from './never';
import { fs } from './fs';
import { Errorable, map } from './errorable';

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
        bundle: `${bundle.repository}/${bundle.name}:${bundle.version}`
    };
}

export async function bundleManifest(bundlePick: BundleSelection): Promise<Errorable<BundleManifest>> {
    const jsonText = await bundleJSONText(bundlePick);
    return map(jsonText, JSON.parse);
}

async function bundleJSONText(bundlePick: BundleSelection): Promise<Errorable<string>> {
    if (bundlePick.kind === "folder") {
        const jsonFile = path.join(bundlePick.path, "bundle.json");
        try {
            return { succeeded: true, result: await fs.readFile(jsonFile, 'utf8') };
        } catch (e) {
            return { succeeded: false, error: [`${e}`] };
        }
        return { succeeded: true, result: await fs.readFile(jsonFile, 'utf8') };
    } else if (bundlePick.kind === "repo") {
        // TODO: probably stick the RepoBundle into RepoBundleSelection to save us parsing stuff out of the bundle ref string
        try {
            const repoBundle = parseRepoBundle(bundlePick.bundle);
            const url = `https://${repoBundle.repository}/repositories/${repoBundle.name}/tags/${repoBundle.version}`;
            const json = await request.get(url);
            return { succeeded: true, result: json };
        } catch (e) {
            return { succeeded: false, error: [`${e}`] };
        }
    }
    return cantHappen(bundlePick);
}

function parseRepoBundle(bundle: string): RepoBundle {
    const repoDelimiter = bundle.indexOf('/');
    const repository = bundle.substring(0, repoDelimiter);
    const tag = bundle.substring(repoDelimiter + 1);
    const versionDelimiter = tag.indexOf(':');
    const name = tag.substring(0, versionDelimiter);
    const version = tag.substring(versionDelimiter + 1);
    return { repository, name, version };
}

export function namespace(bundle: RepoBundle) {
    const name = bundle.name;
    const sepIndex = name.indexOf('/');
    if (sepIndex < 0) {
        return name;
    }
    return name.substring(0, sepIndex);
}

export function nameOnly(bundle: RepoBundle) {
    const name = bundle.name;
    const sepIndex = name.indexOf('/');
    if (sepIndex < 0) {
        return name;
    }
    return name.substring(sepIndex + 1);
}
