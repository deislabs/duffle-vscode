export interface BundleRef {
    readonly bundleName: string;
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
    readonly name: string;
    readonly type: string;
    readonly allowedValues?: (number | string | boolean)[];
    readonly defaultValue?: number | string | boolean;
    readonly metadata?: { description?: string };
}

export interface CredentialSetRef {
    readonly credentialSetName: string;
}
