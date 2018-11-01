import * as vscode from 'vscode';
import * as path from 'path';
import * as request from 'request-promise-native';

import { selectQuickPick } from './host';
import { RepoBundle, BundleManifest, LocalBundle } from '../duffle/duffle.objectmodel';
import { cantHappen } from './never';
import { fs } from './fs';
import { Errorable, map } from './errorable';

export interface FileBundleSelection {
    readonly kind: 'file';
    readonly signed: boolean;
    readonly label: string;
    readonly path: string;
}

export interface RepoBundleSelection {
    readonly kind: 'repo';
    readonly label: string;
    readonly bundle: string;
}

export interface LocalBundleSelection {
    readonly kind: 'local';
    readonly label: string;
    readonly bundle: string;
}

export type BundleSelection = FileBundleSelection | RepoBundleSelection | LocalBundleSelection;

export async function promptBundle(prompt: string): Promise<BundleSelection | undefined> {
    const bundles = await workspaceBundleFiles();
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

async function workspaceBundleFiles(): Promise<vscode.Uri[]> {
    const unsignedBundles = vscode.workspace.findFiles('**/bundle.json');
    const signedBundles = vscode.workspace.findFiles('**/bundle.cnab');
    const bundles = ((await unsignedBundles) || []).concat((await signedBundles) || []);
    return bundles;
}

export function fileBundleSelection(bundleFile: vscode.Uri): BundleSelection {
    const bundleFilePath = bundleFile.fsPath;
    const ext = path.extname(bundleFilePath);
    const containingDir = path.basename(path.dirname(bundleFilePath));
    return {
        kind: 'file',
        signed: ext === '.cnab',
        label: `${containingDir}/${path.basename(bundleFilePath)}`,
        path: bundleFilePath
    };
}

export function repoBundleSelection(bundle: RepoBundle): BundleSelection {
    return {
        kind: 'repo',
        label: bundle.name,
        bundle: `${bundle.repository}/${bundle.name}:${bundle.version}`
    };
}

export function localBundleSelection(bundle: LocalBundle): BundleSelection {
    return {
        kind: 'local',
        label: bundle.repository,
        bundle: `${bundle.repository}:${bundle.tag}`
    };
}

export async function bundleManifest(bundlePick: BundleSelection): Promise<Errorable<BundleManifest>> {
    const bundleText = await readBundleText(bundlePick);
    const jsonText = map(bundleText, jsonOnly);
    return map(jsonText, JSON.parse);
}

async function readBundleText(bundlePick: BundleSelection): Promise<Errorable<string>> {
    if (bundlePick.kind === "file") {
        const bundleFile = bundleFilePath(bundlePick);
        try {
            const text = await fs.readFile(bundleFile, 'utf8');
            return { succeeded: true, result: text };
        } catch (e) {
            return { succeeded: false, error: [`${e}`] };
        }
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
    } else if (bundlePick.kind === "local") {
        const jsonFile = bundleFilePath(bundlePick);
        try {
            return { succeeded: true, result: await fs.readFile(jsonFile, 'utf8') };
        } catch (e) {
            return { succeeded: false, error: [`${e}`] };
        }
    }
    return cantHappen(bundlePick);
}

export function bundleFilePath(bundlePick: FileBundleSelection | LocalBundleSelection) {
    if (bundlePick.kind === 'local') {
        return '/* TODO: resolve path using Fisherware */';
    }
    return bundlePick.path;
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

function jsonOnly(source: string): string {
    if (source.startsWith("-----BEGIN PGP SIGNED MESSAGE")) {
        return stripSignature(source);
    }
    return source;
}

function stripSignature(source: string): string {
    const lines = source.split('\n');
    const messageStartLine = lines.findIndex((l) => l.startsWith("-----BEGIN PGP SIGNED MESSAGE"));
    const sigStartLine = lines.findIndex((l) => l.startsWith("-----BEGIN PGP SIGNATURE"));
    const messageLines = lines.slice(messageStartLine + 1, sigStartLine);
    if (messageLines[0].startsWith("Hash:")) {
        messageLines.shift();
    }
    return messageLines.join('\n').trim();
}

export function namespace(bundle: RepoBundle): string | undefined {
    const name = bundle.name;
    const sepIndex = name.indexOf('/');
    if (sepIndex < 0) {
        return undefined;
    }
    return name.substring(0, sepIndex);
}

export function nameOnly(bundle: RepoBundle): string {
    return parseNameOnly(bundle.name);
}

export function parseNameOnly(bundleName: string): string {
    const sepIndex = bundleName.lastIndexOf('/');
    if (sepIndex < 0) {
        return bundleName;
    }
    return bundleName.substring(sepIndex + 1);
}

const SAFE_NAME_ILLEGAL_CHARACTERS = /[^A-Za-z0-9_-]/g;

export function suggestName(bundlePick: BundleSelection): string {
    if (bundlePick.kind === 'file') {
        const containingDir = path.basename(path.dirname(bundlePick.path));
        return safeName(containingDir);
    } else {
        const baseName = parseNameOnly(bundlePick.kind);
        return safeName(baseName);
    }
}

function safeName(source: string): string {
    return source.replace(SAFE_NAME_ILLEGAL_CHARACTERS, '-');
}
