import * as cnab from 'cnabjs';

export interface InstallationRef {
    readonly installationName: string;
}

export interface RepoBundleRef {
    readonly bundleLocation: 'repo';
    readonly bundle: RepoBundle;
}

export interface LocalBundleRef {
    readonly bundleLocation: 'local';
    readonly bundle: LocalBundle;
}

export type BundleRef = RepoBundleRef | LocalBundleRef;

export interface RepoIndex {
    readonly apiVersion: string;
    readonly entries: { [key: string]: RepoBundle[] };
}

export interface RepoBundle {
    readonly name: string;
    readonly repository: string;
    readonly version: string;
}

export interface LocalBundle {
    readonly name: string;
    readonly version: string;
    readonly digest?: string;  // always present in CLI, but sometimes we need to cons up one of these in code, and since we never use the digest property...
}

export interface CredentialSetRef {
    readonly credentialSetName: string;
}

export interface Claim {
    readonly name: string;
    readonly bundle: cnab.Bundle;
    // Ignoring other fields for now
}
