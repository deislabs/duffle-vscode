export interface RegExpMatch {
    readonly index: number;
    readonly matchText: string;
}

export function* matches(re: RegExp, text: string): IterableIterator<RegExpMatch> {
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
        yield {
            index: match.index,
            matchText: match[0]
        };
    }
}
