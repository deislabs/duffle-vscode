import * as vscode from 'vscode';
import * as path from 'path';
import * as request from 'request-promise-native';

import { selectQuickPick } from './host';
import { RepoBundle, BundleManifest, LocalBundle } from '../duffle/duffle.objectmodel';
import { cantHappen } from './never';
import { fs } from './fs';
import { Errorable, map, failed } from './errorable';
import * as duffle from '../duffle/duffle';
import { localBundlePath } from '../duffle/duffle.paths';
import { shell } from './shell';

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

export async function promptBundleFile(prompt: string): Promise<BundleSelection | undefined> {
    const bundles = await workspaceBundleFiles();
    if (!bundles || bundles.length === 0) {
        await vscode.window.showErrorMessage("This command requires a bundle file in the current workspace.");
        return undefined;
    }

    const bundleQuickPicks = bundles.map(fileBundleSelection);

    return await promptBundle(prompt, bundleQuickPicks);
}

async function workspaceBundleFiles(): Promise<vscode.Uri[]> {
    const unsignedBundles = vscode.workspace.findFiles('**/bundle.json');
    const signedBundles = vscode.workspace.findFiles('**/bundle.cnab');
    const bundles = ((await unsignedBundles) || []).concat((await signedBundles) || []);
    return bundles;
}

export async function promptLocalBundle(prompt: string): Promise<BundleSelection | undefined> {
    const bundles = await duffle.bundles(shell);
    if (failed(bundles)) {
        await vscode.window.showErrorMessage(`Can't get the list of bundles: ${bundles.error[0]}`);
        return undefined;
    }

    if (bundles.result.length === 0) {
        await vscode.window.showErrorMessage("This command requires at least one bundle in your local store.");
        return undefined;
    }

    const bundleQuickPicks = bundles.result.map(localBundleSelection);

    return await promptBundle(prompt, bundleQuickPicks);
}

async function promptBundle(prompt: string, bundleQuickPicks: BundleSelection[]): Promise<BundleSelection | undefined> {
    const bundlePick = await selectQuickPick(bundleQuickPicks, { placeHolder: prompt });
    if (!bundlePick) {
        return undefined;
    }

    return bundlePick;
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
        bundle: repoBundleRef(bundle)
    };
}

export function localBundleSelection(bundle: LocalBundle): BundleSelection {
    return {
        kind: 'local',
        label: bundle.name,
        bundle: `${bundle.name}:${bundle.version}`
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
        return await tryReadFile(bundleFile);
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
        const bundleFile = await resolveLocalBundlePath(bundlePick);
        if (bundleFile.succeeded) {
            return await tryReadFile(bundleFile.result);
        }
        return bundleFile;
    }
    return cantHappen(bundlePick);
}

async function tryReadFile(bundleFile: string): Promise<Errorable<string>> {
    try {
        const text = await fs.readFile(bundleFile, 'utf8');
        return { succeeded: true, result: text };
    } catch (e) {
        return { succeeded: false, error: [`${e}`] };
    }
}

export function bundleFilePath(bundlePick: FileBundleSelection): string {
    return bundlePick.path;
}

async function resolveLocalBundlePath(bundlePick: LocalBundleSelection): Promise<Errorable<string>> {
    const bundleInfo = parseLocalBundle(bundlePick.bundle);
    return await localBundlePath(bundleInfo.name, bundleInfo.version);
}

export function repoBundleRef(bundle: RepoBundle): string {
    return `${bundle.repository}/${bundle.name}:${bundle.version}`;
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

function parseLocalBundle(bundle: string): LocalBundle {
    const versionDelimiter = bundle.indexOf(':');
    const name = bundle.substring(0, versionDelimiter);
    const version = bundle.substring(versionDelimiter + 1);
    return { name, version };
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
    return prefix(bundle.name);
}

export function prefix(name: string): string | undefined {
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
        const baseName = parseNameOnly(bundlePick.label);
        return safeName(baseName);
    }
}

function safeName(source: string): string {
    return source.replace(SAFE_NAME_ILLEGAL_CHARACTERS, '-');
}
