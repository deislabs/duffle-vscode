export interface InstallationRef {
    readonly installationName: string;
}

export interface RepoBundleRef {
    readonly bundle: RepoBundle;
}

export interface RepoBundle {
    readonly name: string;
    readonly repository: string;
    readonly version: string;
}

export interface ParameterDefinition {
    readonly type: string;
    readonly allowedValues?: (number | string | boolean)[];
    readonly defaultValue?: number | string | boolean;
    readonly metadata?: { description?: string };
}

export interface CredentialLocation {
    readonly env?: string;
    readonly path?: string;
}

export interface CredentialSetRef {
    readonly credentialSetName: string;
}

export interface BundleManifest {
    readonly name: string;
    readonly version: string;
    readonly parameters?: { [key: string]: ParameterDefinition };
    readonly credentials?: { [key: string]: CredentialLocation };
}
