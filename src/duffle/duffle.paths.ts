import * as path from 'path';

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

function localPath(bundleRef: string): string {
    const bits = bundleRef.split('/');
    const last = bits.pop()!;
    bits.push('bundles', last);
    return bits.join('/');
}
