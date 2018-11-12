import * as path from 'path';
import { Errorable } from '../utils/errorable';
import { fs } from '../utils/fs';

export function credentialSetPath(name: string): string {
    return path.join(credentialSetDir(), name + '.yaml');
}

export function repoBundlePath(bundleRef: string): string {
    return path.join(repositoriesDir(), localPath(bundleRef) + '.json');
}

function home(): string {
    const envHome = process.env['DUFFLE_HOME'];
    if (envHome) {
        return envHome;
    }

    return path.join(osHome(), '.duffle');
}

function osHome(): string {
    const homeEnvPath = process.env["HOME"];
    if (homeEnvPath) {
        return homeEnvPath;
    }

    return process.env["USERPROFILE"] || '';
}

function credentialSetDir(): string {
    return path.join(home(), 'credentials');
}

function repositoriesDir(): string {
    return path.join(home(), 'repositories');
}

function bundlesDir(): string {
    return path.join(home(), 'bundles');
}

function localPath(bundleRef: string): string {
    const bits = bundleRef.split('/');
    const last = bits.pop()!;
    bits.push('bundles', last);
    return bits.join('/');
}

export async function localBundlePath(name: string, version: string): Promise<Errorable<string>> {
    // The error conditions in this should 'never happen' - this function is only
    // called if local bundles exist, which requires a successful init and the creation
    // of the repositories file.
    const repositoriesFile = path.join(home(), 'repositories.json');
    if (!(await fs.exists(repositoriesFile))) {
        return { succeeded: false, error: ['Local bundle storage is not yet created - run duffle init'] };
    }
    try {
        const repositoriesFileText = await fs.readFile(repositoriesFile, 'utf8');
        const repositories = JSON.parse(repositoriesFileText);
        const repository = repositories[name];
        if (!repository) {
            return { succeeded: false, error: [`${name} not found in local bundle storage`] };
        }
        const storageId = repository[version];
        if (!storageId) {
            return { succeeded: false, error: [`${name}:${version} not found in local bundle storage`] };
        }
        const storagePath = path.join(bundlesDir(), storageId as string);
        return { succeeded: true, result: storagePath };
    } catch (e) {
        return { succeeded: false, error: [`Can't read repositories file: ${e}`] };
    }
}
