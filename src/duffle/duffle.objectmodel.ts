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
